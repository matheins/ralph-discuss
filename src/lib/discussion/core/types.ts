import type { ProviderId, NormalizedMessage } from '@/lib/ai';

// ============================================================================
// Identification Types
// ============================================================================

export type DiscussionId = string & { readonly __brand: 'DiscussionId' };

export function createDiscussionId(): DiscussionId {
  return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` as DiscussionId;
}

export type ParticipantRole = 'model-a' | 'model-b';

// ============================================================================
// State Machine Types
// ============================================================================

export type DiscussionPhase =
  | 'idle'              // Not started
  | 'initializing'      // Setting up discussion
  | 'model-a-turn'      // Model A is responding
  | 'model-b-turn'      // Model B is responding
  | 'consensus-check-a' // Model A evaluating consensus
  | 'consensus-check-b' // Model B evaluating consensus
  | 'completed'         // Finished (consensus or stopped)
  | 'error'             // Error state
  | 'aborted';          // User aborted

export type StoppingReason =
  | 'consensus_reached'      // Both models agree on consensus
  | 'max_iterations'         // Hit maximum iteration limit
  | 'user_abort'             // User requested stop
  | 'error'                  // Unrecoverable error
  | 'model_unavailable'      // Model became unavailable
  | 'timeout';               // Overall discussion timeout

// ============================================================================
// Participant Types
// ============================================================================

export interface Participant {
  role: ParticipantRole;
  modelId: string;
  providerId: ProviderId;
  displayName: string;
}

// ============================================================================
// Turn and Round Types
// ============================================================================

export interface Turn {
  id: string;
  role: ParticipantRole;
  roundNumber: number;
  content: string;
  timestamp: number;
  durationMs: number;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
  finishReason: string;
}

export interface ConsensusVote {
  role: ParticipantRole;
  hasConsensus: boolean;
  confidence: number;           // 0-100
  reasoning: string;
  proposedSolution?: string;
  timestamp: number;
}

export interface ConsensusResult {
  isUnanimous: boolean;
  modelAVote: ConsensusVote;
  modelBVote: ConsensusVote;
  finalSolution?: string;       // Only if unanimous
  roundNumber: number;
}

export interface Round {
  number: number;
  modelATurn: Turn;
  modelBTurn: Turn;
  consensusCheck?: ConsensusResult;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DiscussionConfig {
  prompt: string;
  participants: {
    modelA: Participant;
    modelB: Participant;
  };
  options: DiscussionOptions;
}

export interface DiscussionOptions {
  maxIterations: number;
  temperature: number;
  maxTokensPerTurn: number;
  turnTimeoutMs: number;
  totalTimeoutMs: number;
  requireBothConsensus: boolean;
  minRoundsBeforeConsensus: number;
}

export const DEFAULT_DISCUSSION_OPTIONS: DiscussionOptions = {
  maxIterations: 10,              // Maximum discussion rounds
  temperature: 0.7,               // Creativity vs consistency balance
  maxTokensPerTurn: 2048,         // Per-turn response limit
  turnTimeoutMs: 120000,          // 2 minutes per turn
  totalTimeoutMs: 1800000,        // 30 minutes total
  requireBothConsensus: true,     // Both models must agree
  minRoundsBeforeConsensus: 1,    // Prevent premature agreement
};

// ============================================================================
// State Types
// ============================================================================

export interface DiscussionState {
  id: DiscussionId;
  phase: DiscussionPhase;
  config: DiscussionConfig;
  rounds: Round[];
  currentRound: number;
  conversationHistory: NormalizedMessage[];
  consensusHistory: ConsensusResult[];
  finalConsensus?: {
    solution: string;
    achievedAtRound: number;
    modelAContribution: string;
    modelBContribution: string;
  };
  stoppingReason?: StoppingReason;
  error?: DiscussionError;
  startedAt?: number;
  completedAt?: number;
  totalTokensUsed: {
    modelA: { prompt: number; completion: number };
    modelB: { prompt: number; completion: number };
  };
}

// ============================================================================
// Event Types (for streaming) - 12 distinct event types
// ============================================================================

export type DiscussionEventType =
  | 'discussion_started'
  | 'round_started'
  | 'turn_started'
  | 'turn_chunk'
  | 'turn_completed'
  | 'consensus_check_started'
  | 'consensus_vote'
  | 'consensus_result'
  | 'round_completed'
  | 'discussion_completed'
  | 'discussion_error'
  | 'discussion_aborted';

export interface BaseDiscussionEvent {
  type: DiscussionEventType;
  discussionId: DiscussionId;
  timestamp: number;
}

export interface DiscussionStartedEvent extends BaseDiscussionEvent {
  type: 'discussion_started';
  config: DiscussionConfig;
}

export interface RoundStartedEvent extends BaseDiscussionEvent {
  type: 'round_started';
  roundNumber: number;
}

export interface TurnStartedEvent extends BaseDiscussionEvent {
  type: 'turn_started';
  role: ParticipantRole;
  modelId: string;
  providerId: ProviderId;
  roundNumber: number;
}

export interface TurnChunkEvent extends BaseDiscussionEvent {
  type: 'turn_chunk';
  role: ParticipantRole;
  chunk: string;
}

export interface TurnCompletedEvent extends BaseDiscussionEvent {
  type: 'turn_completed';
  turn: Turn;
}

export interface ConsensusCheckStartedEvent extends BaseDiscussionEvent {
  type: 'consensus_check_started';
  roundNumber: number;
}

export interface ConsensusVoteEvent extends BaseDiscussionEvent {
  type: 'consensus_vote';
  vote: ConsensusVote;
}

export interface ConsensusResultEvent extends BaseDiscussionEvent {
  type: 'consensus_result';
  result: ConsensusResult;
}

export interface RoundCompletedEvent extends BaseDiscussionEvent {
  type: 'round_completed';
  round: Round;
}

export interface DiscussionCompletedEvent extends BaseDiscussionEvent {
  type: 'discussion_completed';
  stoppingReason: StoppingReason;
  finalConsensus?: DiscussionState['finalConsensus'];
  totalTokensUsed: DiscussionState['totalTokensUsed'];
  durationMs: number;
}

export interface DiscussionErrorEvent extends BaseDiscussionEvent {
  type: 'discussion_error';
  error: DiscussionError;
}

export interface DiscussionAbortedEvent extends BaseDiscussionEvent {
  type: 'discussion_aborted';
  reason: string;
}

export type DiscussionEvent =
  | DiscussionStartedEvent
  | RoundStartedEvent
  | TurnStartedEvent
  | TurnChunkEvent
  | TurnCompletedEvent
  | ConsensusCheckStartedEvent
  | ConsensusVoteEvent
  | ConsensusResultEvent
  | RoundCompletedEvent
  | DiscussionCompletedEvent
  | DiscussionErrorEvent
  | DiscussionAbortedEvent;

// ============================================================================
// Error Types
// ============================================================================

export type DiscussionErrorCode =
  | 'INITIALIZATION_FAILED'
  | 'TURN_FAILED'
  | 'TURN_TIMEOUT'
  | 'CONSENSUS_PARSE_FAILED'
  | 'PROVIDER_ERROR'
  | 'STATE_INVALID'
  | 'DISCUSSION_TIMEOUT'
  | 'UNKNOWN';

export interface DiscussionError {
  code: DiscussionErrorCode;
  message: string;
  role?: ParticipantRole;
  roundNumber?: number;
  recoverable: boolean;
  originalError?: unknown;
}
