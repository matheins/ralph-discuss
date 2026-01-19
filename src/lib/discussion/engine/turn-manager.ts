import type {
  AIProvider,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  NormalizedMessage,
} from '@/lib/ai';
import { withRetry } from '@/lib/ai';
import type {
  Turn,
  ParticipantRole,
  Participant,
  DiscussionOptions,
} from '../core/types';
import { TurnTimeoutError } from '../core/errors';

export interface TurnExecutionContext {
  role: ParticipantRole;
  participant: Participant;
  roundNumber: number;
  systemPrompt: string;
  messages: NormalizedMessage[];
  options: DiscussionOptions;
  abortSignal?: AbortSignal;
}

export interface TurnResult {
  turn: Turn;
  response: GenerationResponse;
}

export type ChunkCallback = (chunk: string, role: ParticipantRole) => void;

export class TurnManager {
  constructor(
    private getProvider: (providerId: string) => AIProvider
  ) {}

  async executeTurn(
    context: TurnExecutionContext,
    onChunk?: ChunkCallback
  ): Promise<TurnResult> {
    const { role, participant, roundNumber, systemPrompt, messages, options, abortSignal } = context;

    const provider = this.getProvider(participant.providerId);
    const startTime = Date.now();
    let content = '';

    // Set up timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, options.turnTimeoutMs);

    // Combine signals if both exist
    const combinedSignal = abortSignal
      ? combineAbortSignals(abortSignal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const request: GenerationRequest = {
        modelId: participant.modelId,
        providerId: participant.providerId,
        messages,
        systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokensPerTurn,
        abortSignal: combinedSignal,
      };

      const streamOptions: StreamOptions = {
        onChunk: (chunk) => {
          content += chunk;
          onChunk?.(chunk, role);
        },
        onStart: () => {},
        onComplete: (fullText) => {
          content = fullText;
        },
        onError: () => {},
      };

      const response = await withRetry(
        () => provider.streamText(request, streamOptions),
        { maxRetries: 2, initialDelayMs: 1000 }
      );

      const turn: Turn = {
        id: `turn_${roundNumber}_${role}_${Date.now()}`,
        role,
        roundNumber,
        content: content || response.text,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        tokenUsage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
        },
        finishReason: response.finishReason,
      };

      return { turn, response };
    } catch (error) {
      if (timeoutController.signal.aborted && !abortSignal?.aborted) {
        throw new TurnTimeoutError(role, roundNumber, options.turnTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}
