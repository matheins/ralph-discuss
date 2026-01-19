import type {
  DiscussionId,
  ParticipantRole,
  DiscussionPhase,
  StoppingReason,
  Turn,
  ConsensusVote,
  ConsensusResult,
  DiscussionError,
} from '@/lib/discussion';
import type { ProviderId } from '@/lib/ai';

// ============================================================================
// Model Selection Types
// ============================================================================

export interface ModelOption {
  id: string;
  providerId: ProviderId;
  displayName: string;
  description?: string;
}

export interface SelectedModel {
  modelId: string;
  providerId: ProviderId;
  displayName: string;
}

// ============================================================================
// Discussion UI State
// ============================================================================

export type UIPhase =
  | 'setup'           // Initial form state
  | 'connecting'      // Establishing SSE connection
  | 'active'          // Discussion in progress
  | 'completed'       // Discussion finished
  | 'error';          // Error state

export interface StreamingTurn {
  role: ParticipantRole;
  content: string;
  isComplete: boolean;
}

export interface RoundDisplay {
  number: number;
  modelATurn?: Turn;
  modelBTurn?: Turn;
  consensusResult?: ConsensusResult;
  isComplete: boolean;
}

export interface DiscussionUIState {
  // Connection state
  uiPhase: UIPhase;
  discussionId: DiscussionId | null;
  serverPhase: DiscussionPhase;

  // Configuration
  prompt: string;
  modelA: SelectedModel | null;
  modelB: SelectedModel | null;

  // Discussion progress
  rounds: RoundDisplay[];
  currentRound: number;
  streamingTurn: StreamingTurn | null;

  // Consensus
  consensusVotes: ConsensusVote[];
  finalConsensus: {
    solution: string;
    achievedAtRound: number;
  } | null;

  // Stopping
  stoppingReason: StoppingReason | null;

  // Error handling
  error: DiscussionError | null;

  // Timestamps
  startedAt: number | null;
  completedAt: number | null;
}

// ============================================================================
// SSE Event Types (Client-side parsing)
// ============================================================================

export interface SSEDiscussionStarted {
  discussionId: string;
  timestamp: number;
  config: {
    prompt: string;
    modelA: { modelId: string; providerId: string; displayName: string };
    modelB: { modelId: string; providerId: string; displayName: string };
  };
}

export interface SSETurnStarted {
  discussionId: string;
  timestamp: number;
  role: ParticipantRole;
  roundNumber: number;
  modelId: string;
}

export interface SSETurnChunk {
  discussionId: string;
  timestamp: number;
  role: ParticipantRole;
  chunk: string;
}

export interface SSETurnCompleted {
  discussionId: string;
  timestamp: number;
  turn: Turn;
}

export interface SSEConsensusVote {
  discussionId: string;
  timestamp: number;
  vote: ConsensusVote;
}

export interface SSEConsensusResult {
  discussionId: string;
  timestamp: number;
  result: ConsensusResult;
}

export interface SSERoundStarted {
  discussionId: string;
  timestamp: number;
  roundNumber: number;
}

export interface SSERoundCompleted {
  discussionId: string;
  timestamp: number;
  roundNumber: number;
}

export interface SSEDiscussionCompleted {
  discussionId: string;
  timestamp: number;
  stoppingReason: StoppingReason;
  finalConsensus?: {
    solution: string;
    achievedAtRound: number;
  };
}

export interface SSEDiscussionError {
  discussionId: string;
  timestamp: number;
  error: DiscussionError;
}

export interface SSEDiscussionAborted {
  discussionId: string;
  timestamp: number;
}

export type SSEEvent =
  | { type: 'discussion-started'; data: SSEDiscussionStarted }
  | { type: 'round-started'; data: SSERoundStarted }
  | { type: 'turn-started'; data: SSETurnStarted }
  | { type: 'turn-chunk'; data: SSETurnChunk }
  | { type: 'turn-completed'; data: SSETurnCompleted }
  | { type: 'consensus-check-started'; data: { discussionId: string; roundNumber: number } }
  | { type: 'consensus-vote'; data: SSEConsensusVote }
  | { type: 'consensus-result'; data: SSEConsensusResult }
  | { type: 'round-completed'; data: SSERoundCompleted }
  | { type: 'discussion-completed'; data: SSEDiscussionCompleted }
  | { type: 'discussion-error'; data: SSEDiscussionError }
  | { type: 'discussion-aborted'; data: SSEDiscussionAborted };

// ============================================================================
// Action Types for Reducer
// ============================================================================

export type DiscussionAction =
  | { type: 'SET_PROMPT'; payload: string }
  | { type: 'SET_MODEL_A'; payload: SelectedModel }
  | { type: 'SET_MODEL_B'; payload: SelectedModel }
  | { type: 'START_CONNECTING' }
  | { type: 'SSE_EVENT'; payload: SSEEvent }
  | { type: 'CONNECTION_ERROR'; payload: Error }
  | { type: 'ABORT' }
  | { type: 'RESET' };
