import type { AIProvider, NormalizedMessage } from '@/lib/ai';
import { providerRegistry } from '@/lib/ai';
import type {
  DiscussionId,
  DiscussionConfig,
  DiscussionState,
  DiscussionEvent,
  DiscussionPhase,
  ParticipantRole,
  Round,
  Turn,
  ConsensusResult,
  StoppingReason,
} from '../core/types';
import { createDiscussionId, DEFAULT_DISCUSSION_OPTIONS } from '../core/types';
import {
  DiscussionEngineError,
  DiscussionTimeoutError,
  InitializationError,
} from '../core/errors';
import { DiscussionStateMachine } from './state-machine';
import { TurnManager, type ChunkCallback } from './turn-manager';
import { ConsensusDetector } from './consensus-detector';
import { buildTurnMessages, addTurnToHistory } from '../protocol/message-builder';

export type EventHandler = (event: DiscussionEvent) => void;

export class DiscussionEngine {
  private state!: DiscussionState;
  private stateMachine: DiscussionStateMachine;
  private turnManager: TurnManager;
  private consensusDetector: ConsensusDetector;
  private eventHandlers: Set<EventHandler> = new Set();
  private abortController: AbortController | null = null;
  private totalTimeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.stateMachine = new DiscussionStateMachine();

    const getProvider = (providerId: string): AIProvider => {
      return providerRegistry.get(providerId as 'openai' | 'anthropic' | 'ollama');
    };

    this.turnManager = new TurnManager(getProvider);
    this.consensusDetector = new ConsensusDetector(getProvider);
  }

  async start(config: DiscussionConfig): Promise<void> {
    if (this.stateMachine.isActive()) {
      throw new DiscussionEngineError({
        code: 'STATE_INVALID',
        message: 'A discussion is already in progress',
        recoverable: false,
      });
    }

    // Reset state machine if needed
    if (this.stateMachine.phase !== 'idle') {
      this.stateMachine.reset();
    }

    // Initialize state
    const id = createDiscussionId();
    this.state = this.createInitialState(id, config);

    // Set up abort controller
    this.abortController = new AbortController();

    // Set up total timeout
    this.totalTimeoutId = setTimeout(() => {
      this.handleTotalTimeout();
    }, config.options.totalTimeoutMs);

    try {
      // Transition to initializing
      this.stateMachine.transition('initializing');
      this.state.phase = 'initializing';

      // Initialize providers
      await this.initializeProviders(config);

      // Emit discussion started event
      this.state.startedAt = Date.now();
      this.emitEvent({
        type: 'discussion_started',
        discussionId: id,
        timestamp: Date.now(),
        config,
      });

      // Run the discussion
      await this.runDiscussion();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.cleanup();
    }
  }

  abort(): void {
    if (!this.stateMachine.isActive()) {
      return;
    }

    this.abortController?.abort();

    if (this.stateMachine.canTransition('aborted')) {
      this.stateMachine.transition('aborted');
      this.state.phase = 'aborted';
      this.state.stoppingReason = 'user_abort';
      this.state.completedAt = Date.now();

      this.emitEvent({
        type: 'discussion_aborted',
        discussionId: this.state.id,
        timestamp: Date.now(),
        reason: 'User requested abort',
      });
    }
  }

  getState(): DiscussionState {
    return { ...this.state };
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private createInitialState(id: DiscussionId, config: DiscussionConfig): DiscussionState {
    return {
      id,
      phase: 'idle',
      config: {
        ...config,
        options: { ...DEFAULT_DISCUSSION_OPTIONS, ...config.options },
      },
      rounds: [],
      currentRound: 0,
      conversationHistory: [],
      consensusHistory: [],
      totalTokensUsed: {
        modelA: { prompt: 0, completion: 0 },
        modelB: { prompt: 0, completion: 0 },
      },
    };
  }

  private async initializeProviders(config: DiscussionConfig): Promise<void> {
    try {
      const providerA = providerRegistry.get(config.participants.modelA.providerId);
      const providerB = providerRegistry.get(config.participants.modelB.providerId);

      if (!providerA.isInitialized) {
        await providerA.initialize();
      }
      if (!providerB.isInitialized && config.participants.modelA.providerId !== config.participants.modelB.providerId) {
        await providerB.initialize();
      }
    } catch (error) {
      throw new InitializationError(
        'Failed to initialize AI providers',
        error
      );
    }
  }

  private async runDiscussion(): Promise<void> {
    const options = this.state.config.options;

    while (this.state.currentRound < options.maxIterations) {
      if (this.abortController?.signal.aborted) break;

      // Start new round
      this.state.currentRound++;
      this.emitEvent({
        type: 'round_started',
        discussionId: this.state.id,
        timestamp: Date.now(),
        roundNumber: this.state.currentRound,
      });

      // Model A turn
      this.stateMachine.transition('model-a-turn');
      this.state.phase = 'model-a-turn';
      const turnA = await this.executeTurn('model-a');
      if (!turnA || this.abortController?.signal.aborted) break;

      // Model B turn
      this.stateMachine.transition('model-b-turn');
      this.state.phase = 'model-b-turn';
      const turnB = await this.executeTurn('model-b');
      if (!turnB || this.abortController?.signal.aborted) break;

      // Create round record (will be completed after consensus check)
      const round: Round = {
        number: this.state.currentRound,
        modelATurn: turnA,
        modelBTurn: turnB,
      };

      // Check for consensus
      this.stateMachine.transition('consensus-check-a');
      this.state.phase = 'consensus-check-a';

      this.emitEvent({
        type: 'consensus_check_started',
        discussionId: this.state.id,
        timestamp: Date.now(),
        roundNumber: this.state.currentRound,
      });

      const consensusResult = await this.checkConsensus();

      // Transition through consensus-check-b
      this.stateMachine.transition('consensus-check-b');
      this.state.phase = 'consensus-check-b';

      round.consensusCheck = consensusResult;
      this.state.rounds.push(round);
      this.state.consensusHistory.push(consensusResult);

      this.emitEvent({
        type: 'consensus_result',
        discussionId: this.state.id,
        timestamp: Date.now(),
        result: consensusResult,
      });

      this.emitEvent({
        type: 'round_completed',
        discussionId: this.state.id,
        timestamp: Date.now(),
        round,
      });

      // Stop if consensus reached
      if (consensusResult.isUnanimous) {
        this.completeDiscussion('consensus_reached', consensusResult);
        return;
      }

      // Continue to next round
      if (this.state.currentRound < options.maxIterations) {
        this.stateMachine.transition('model-a-turn');
      }
    }

    // Max iterations reached
    if (!this.stateMachine.isTerminal()) {
      this.completeDiscussion('max_iterations');
    }
  }

  private async executeTurn(role: ParticipantRole): Promise<Turn | null> {
    const participant = role === 'model-a'
      ? this.state.config.participants.modelA
      : this.state.config.participants.modelB;

    this.emitEvent({
      type: 'turn_started',
      discussionId: this.state.id,
      timestamp: Date.now(),
      role,
      modelId: participant.modelId,
      providerId: participant.providerId,
      roundNumber: this.state.currentRound,
    });

    const { systemPrompt, messages } = buildTurnMessages(role, {
      config: this.state.config,
      conversationHistory: this.state.conversationHistory,
      currentRound: this.state.currentRound,
    });

    const onChunk: ChunkCallback = (chunk, chunkRole) => {
      this.emitEvent({
        type: 'turn_chunk',
        discussionId: this.state.id,
        timestamp: Date.now(),
        role: chunkRole,
        chunk,
      });
    };

    try {
      const { turn, response } = await this.turnManager.executeTurn(
        {
          role,
          participant,
          roundNumber: this.state.currentRound,
          systemPrompt,
          messages,
          options: this.state.config.options,
          abortSignal: this.abortController?.signal,
        },
        onChunk
      );

      // Update conversation history
      this.state.conversationHistory = addTurnToHistory(
        this.state.conversationHistory,
        turn,
        participant.providerId,
        participant.modelId
      );

      // Update token usage
      const tokenKey = role === 'model-a' ? 'modelA' : 'modelB';
      this.state.totalTokensUsed[tokenKey].prompt += response.usage.promptTokens;
      this.state.totalTokensUsed[tokenKey].completion += response.usage.completionTokens;

      this.emitEvent({
        type: 'turn_completed',
        discussionId: this.state.id,
        timestamp: Date.now(),
        turn,
      });

      return turn;
    } catch (error) {
      if (this.abortController?.signal.aborted) {
        return null;
      }
      throw error;
    }
  }

  private async checkConsensus(): Promise<ConsensusResult> {
    const result = await this.consensusDetector.checkConsensus(
      {
        config: this.state.config,
        conversationHistory: this.state.conversationHistory,
        currentRound: this.state.currentRound,
        options: this.state.config.options,
        abortSignal: this.abortController?.signal,
      },
      (vote) => {
        this.emitEvent({
          type: 'consensus_vote',
          discussionId: this.state.id,
          timestamp: Date.now(),
          vote,
        });
      }
    );

    return result;
  }

  private completeDiscussion(reason: StoppingReason, consensusResult?: ConsensusResult): void {
    this.stateMachine.transition('completed');
    this.state.phase = 'completed';
    this.state.stoppingReason = reason;
    this.state.completedAt = Date.now();

    if (reason === 'consensus_reached' && consensusResult?.finalSolution) {
      // Get the last contributions from each model
      const lastRound = this.state.rounds[this.state.rounds.length - 1];

      this.state.finalConsensus = {
        solution: consensusResult.finalSolution,
        achievedAtRound: this.state.currentRound,
        modelAContribution: lastRound?.modelATurn.content || '',
        modelBContribution: lastRound?.modelBTurn.content || '',
      };
    }

    this.emitEvent({
      type: 'discussion_completed',
      discussionId: this.state.id,
      timestamp: Date.now(),
      stoppingReason: reason,
      finalConsensus: this.state.finalConsensus,
      totalTokensUsed: this.state.totalTokensUsed,
      durationMs: this.state.startedAt ? Date.now() - this.state.startedAt : 0,
    });
  }

  private handleTotalTimeout(): void {
    if (!this.stateMachine.isTerminal()) {
      this.abortController?.abort();

      const error = new DiscussionTimeoutError(this.state.config.options.totalTimeoutMs);
      this.state.error = error.toJSON();

      if (this.stateMachine.canTransition('error')) {
        this.stateMachine.transition('error');
        this.state.phase = 'error';
        this.state.stoppingReason = 'timeout';
        this.state.completedAt = Date.now();

        this.emitEvent({
          type: 'discussion_error',
          discussionId: this.state.id,
          timestamp: Date.now(),
          error: error.toJSON(),
        });
      }
    }
  }

  private handleError(error: unknown): void {
    const discussionError = error instanceof DiscussionEngineError
      ? error
      : new DiscussionEngineError({
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: false,
          originalError: error,
        });

    this.state.error = discussionError.toJSON();

    if (this.stateMachine.canTransition('error')) {
      this.stateMachine.transition('error');
      this.state.phase = 'error';
      this.state.stoppingReason = 'error';
      this.state.completedAt = Date.now();

      this.emitEvent({
        type: 'discussion_error',
        discussionId: this.state.id,
        timestamp: Date.now(),
        error: discussionError.toJSON(),
      });
    }
  }

  private cleanup(): void {
    if (this.totalTimeoutId) {
      clearTimeout(this.totalTimeoutId);
      this.totalTimeoutId = null;
    }
    this.abortController = null;
  }

  private emitEvent(event: DiscussionEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }
}
