import type { DiscussionEvent } from '../core/types';

export interface SSEEvent {
  event: string;
  data: string; // JSON stringified
}

export function toSSEEvent(event: DiscussionEvent): SSEEvent {
  // Convert snake_case to kebab-case for SSE event names
  const eventType = event.type.replace(/_/g, '-');

  // Create payload based on event type
  const payload = createEventPayload(event);

  return {
    event: eventType,
    data: JSON.stringify(payload),
  };
}

function createEventPayload(event: DiscussionEvent): Record<string, unknown> {
  const base = {
    discussionId: event.discussionId,
    timestamp: event.timestamp,
  };

  switch (event.type) {
    case 'discussion_started':
      return {
        ...base,
        config: {
          prompt: event.config.prompt,
          modelA: {
            modelId: event.config.participants.modelA.modelId,
            providerId: event.config.participants.modelA.providerId,
            displayName: event.config.participants.modelA.displayName,
          },
          modelB: {
            modelId: event.config.participants.modelB.modelId,
            providerId: event.config.participants.modelB.providerId,
            displayName: event.config.participants.modelB.displayName,
          },
          options: event.config.options,
        },
      };

    case 'round_started':
      return {
        ...base,
        roundNumber: event.roundNumber,
      };

    case 'turn_started':
      return {
        ...base,
        role: event.role,
        modelId: event.modelId,
        providerId: event.providerId,
        roundNumber: event.roundNumber,
      };

    case 'turn_chunk':
      return {
        ...base,
        role: event.role,
        chunk: event.chunk,
      };

    case 'turn_completed':
      return {
        ...base,
        turn: {
          id: event.turn.id,
          role: event.turn.role,
          roundNumber: event.turn.roundNumber,
          content: event.turn.content,
          durationMs: event.turn.durationMs,
          tokenUsage: event.turn.tokenUsage,
          finishReason: event.turn.finishReason,
        },
      };

    case 'consensus_check_started':
      return {
        ...base,
        roundNumber: event.roundNumber,
      };

    case 'consensus_vote':
      return {
        ...base,
        vote: event.vote,
      };

    case 'consensus_result':
      return {
        ...base,
        result: event.result,
      };

    case 'round_completed':
      return {
        ...base,
        round: {
          number: event.round.number,
          modelATurn: {
            id: event.round.modelATurn.id,
            role: event.round.modelATurn.role,
            content: event.round.modelATurn.content,
            durationMs: event.round.modelATurn.durationMs,
          },
          modelBTurn: {
            id: event.round.modelBTurn.id,
            role: event.round.modelBTurn.role,
            content: event.round.modelBTurn.content,
            durationMs: event.round.modelBTurn.durationMs,
          },
          consensusCheck: event.round.consensusCheck,
        },
      };

    case 'discussion_completed':
      return {
        ...base,
        stoppingReason: event.stoppingReason,
        finalConsensus: event.finalConsensus,
        totalTokensUsed: event.totalTokensUsed,
        durationMs: event.durationMs,
      };

    case 'discussion_error':
      return {
        ...base,
        error: event.error,
      };

    case 'discussion_aborted':
      return {
        ...base,
        reason: event.reason,
      };

    default:
      return base;
  }
}

export function formatSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${event.data}\n\n`;
}

export function formatKeepAlive(): string {
  return `: keep-alive\n\n`;
}
