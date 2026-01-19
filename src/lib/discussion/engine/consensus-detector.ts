import type { AIProvider, GenerationRequest, NormalizedMessage } from '@/lib/ai';
import { withRetry } from '@/lib/ai';
import type {
  ConsensusVote,
  ConsensusResult,
  ParticipantRole,
  Participant,
  DiscussionOptions,
  DiscussionConfig,
} from '../core/types';
import { parseConsensusResponse, toConsensusVote } from '../protocol/response-parser';
import { buildConsensusMessages } from '../protocol/message-builder';
import { PROTOCOL } from '../core/constants';
import { ConsensusParseFailed } from '../core/errors';

export interface ConsensusContext {
  config: DiscussionConfig;
  conversationHistory: NormalizedMessage[];
  currentRound: number;
  options: DiscussionOptions;
  abortSignal?: AbortSignal;
}

export type ConsensusVoteCallback = (vote: ConsensusVote) => void;

export class ConsensusDetector {
  constructor(
    private getProvider: (providerId: string) => AIProvider
  ) {}

  async checkConsensus(
    context: ConsensusContext,
    onVote?: ConsensusVoteCallback
  ): Promise<ConsensusResult> {
    const { config, conversationHistory, currentRound, options, abortSignal } = context;

    // Check if we've completed minimum rounds
    if (currentRound < options.minRoundsBeforeConsensus) {
      return {
        isUnanimous: false,
        modelAVote: this.createSkippedVote('model-a', 'Minimum rounds not yet completed'),
        modelBVote: this.createSkippedVote('model-b', 'Minimum rounds not yet completed'),
        roundNumber: currentRound,
      };
    }

    // Get consensus vote from Model A
    const modelAVote = await this.getConsensusVote(
      'model-a',
      config.participants.modelA,
      { config, conversationHistory, currentRound },
      options,
      abortSignal
    );
    onVote?.(modelAVote);

    // Get consensus vote from Model B
    const modelBVote = await this.getConsensusVote(
      'model-b',
      config.participants.modelB,
      { config, conversationHistory, currentRound },
      options,
      abortSignal
    );
    onVote?.(modelBVote);

    // Determine if consensus is reached
    const isUnanimous = options.requireBothConsensus
      ? modelAVote.hasConsensus && modelBVote.hasConsensus
      : modelAVote.hasConsensus || modelBVote.hasConsensus;

    // If unanimous, determine final solution
    let finalSolution: string | undefined;
    if (isUnanimous) {
      finalSolution = this.determineFinalSolution(modelAVote, modelBVote);
    }

    return {
      isUnanimous,
      modelAVote,
      modelBVote,
      finalSolution,
      roundNumber: currentRound,
    };
  }

  private async getConsensusVote(
    role: ParticipantRole,
    participant: Participant,
    messageContext: { config: DiscussionConfig; conversationHistory: NormalizedMessage[]; currentRound: number },
    options: DiscussionOptions,
    abortSignal?: AbortSignal
  ): Promise<ConsensusVote> {
    const provider = this.getProvider(participant.providerId);
    const { systemPrompt, messages } = buildConsensusMessages(role, messageContext);

    let attempts = 0;
    let lastError: unknown;
    const localMessages = [...messages];

    while (attempts <= PROTOCOL.MAX_CONSENSUS_RETRIES) {
      try {
        const request: GenerationRequest = {
          modelId: participant.modelId,
          providerId: participant.providerId,
          messages: localMessages,
          systemPrompt,
          temperature: 0.3, // Lower temperature for consistent evaluation
          maxTokens: 1024,
          abortSignal,
        };

        const response = await withRetry(
          () => provider.generateText(request),
          { maxRetries: 1 }
        );

        const parsed = parseConsensusResponse(response.text, role);
        return toConsensusVote(parsed, role);
      } catch (error) {
        lastError = error;
        attempts++;

        if (error instanceof ConsensusParseFailed && attempts <= PROTOCOL.MAX_CONSENSUS_RETRIES) {
          localMessages.push({
            role: 'user',
            content: 'Please provide your response in the exact structured format requested, starting with [CONSENSUS_CHECK].',
          });
          continue;
        }

        break;
      }
    }

    // If all retries failed, return uncertain vote
    return {
      role,
      hasConsensus: false,
      confidence: 0,
      reasoning: `Failed to obtain valid consensus response: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
      timestamp: Date.now(),
    };
  }

  private createSkippedVote(role: ParticipantRole, reason: string): ConsensusVote {
    return {
      role,
      hasConsensus: false,
      confidence: 0,
      reasoning: reason,
      timestamp: Date.now(),
    };
  }

  private determineFinalSolution(voteA: ConsensusVote, voteB: ConsensusVote): string {
    if (voteA.proposedSolution && voteB.proposedSolution) {
      return voteA.confidence >= voteB.confidence
        ? voteA.proposedSolution
        : voteB.proposedSolution;
    }

    return voteA.proposedSolution || voteB.proposedSolution || 'Consensus reached but solution text not extracted.';
  }
}
