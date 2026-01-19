import type { NormalizedMessage, ProviderId } from '@/lib/ai';
import type { ParticipantRole, Turn, DiscussionConfig } from '../core/types';
import {
  buildDiscussionSystemPrompt,
  buildConsensusSystemPrompt,
  buildInitialTurnMessage,
  buildFollowUpTurnMessage,
  buildConsensusPrompt,
} from './prompts';

export interface MessageContext {
  config: DiscussionConfig;
  conversationHistory: NormalizedMessage[];
  currentRound: number;
}

export function buildTurnMessages(
  role: ParticipantRole,
  context: MessageContext
): { systemPrompt: string; messages: NormalizedMessage[] } {
  const participant = role === 'model-a'
    ? context.config.participants.modelA
    : context.config.participants.modelB;

  const otherParticipant = role === 'model-a'
    ? context.config.participants.modelB
    : context.config.participants.modelA;

  const systemPrompt = buildDiscussionSystemPrompt(participant, otherParticipant, context.config);

  const messages: NormalizedMessage[] = [];

  // Add instruction based on round
  const isFirstTurn = context.conversationHistory.length === 0;
  const instruction = isFirstTurn
    ? buildInitialTurnMessage(role)
    : buildFollowUpTurnMessage(role, context.currentRound);

  // Add conversation history with role labels
  for (const msg of context.conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
    });
  }

  // Add the instruction for this turn
  messages.push({
    role: 'user',
    content: instruction,
    metadata: { timestamp: Date.now() },
  });

  return { systemPrompt, messages };
}

export function buildConsensusMessages(
  role: ParticipantRole,
  context: MessageContext
): { systemPrompt: string; messages: NormalizedMessage[] } {
  const participant = role === 'model-a'
    ? context.config.participants.modelA
    : context.config.participants.modelB;

  const systemPrompt = buildConsensusSystemPrompt(participant, context.config);

  const messages: NormalizedMessage[] = [];

  for (const msg of context.conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
    });
  }

  messages.push({
    role: 'user',
    content: buildConsensusPrompt(context.currentRound),
    metadata: { timestamp: Date.now() },
  });

  return { systemPrompt, messages };
}

export function addTurnToHistory(
  history: NormalizedMessage[],
  turn: Turn,
  providerId: ProviderId,
  modelId: string
): NormalizedMessage[] {
  const roleLabel = turn.role === 'model-a' ? '[Model A]' : '[Model B]';

  return [
    ...history,
    {
      role: 'assistant' as const,
      content: `${roleLabel} ${turn.content}`,
      metadata: {
        modelId,
        providerId,
        timestamp: turn.timestamp,
      },
    },
  ];
}
