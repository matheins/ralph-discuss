// Core types
export type {
  DiscussionId,
  ParticipantRole,
  DiscussionPhase,
  StoppingReason,
  Participant,
  Turn,
  ConsensusVote,
  ConsensusResult,
  Round,
  DiscussionConfig,
  DiscussionOptions,
  DiscussionState,
  DiscussionEvent,
  DiscussionEventType,
  DiscussionError,
  DiscussionErrorCode,
  BaseDiscussionEvent,
  DiscussionStartedEvent,
  RoundStartedEvent,
  TurnStartedEvent,
  TurnChunkEvent,
  TurnCompletedEvent,
  ConsensusCheckStartedEvent,
  ConsensusVoteEvent,
  ConsensusResultEvent,
  RoundCompletedEvent,
  DiscussionCompletedEvent,
  DiscussionErrorEvent,
  DiscussionAbortedEvent,
} from './core/types';

export { DEFAULT_DISCUSSION_OPTIONS, createDiscussionId } from './core/types';

// Errors
export {
  DiscussionEngineError,
  TurnTimeoutError,
  ConsensusParseFailed,
  StateTransitionError,
  DiscussionTimeoutError,
  InitializationError,
} from './core/errors';

// Constants
export { PROTOCOL, ROLE_DESCRIPTIONS, KEEP_ALIVE_INTERVAL_MS } from './core/constants';

// Engine
export { DiscussionEngine, type EventHandler } from './engine/discussion-engine';
export { DiscussionStateMachine } from './engine/state-machine';
export { TurnManager, type TurnExecutionContext, type TurnResult, type ChunkCallback } from './engine/turn-manager';
export { ConsensusDetector, type ConsensusContext, type ConsensusVoteCallback } from './engine/consensus-detector';

// Streaming
export { SSEEmitter } from './streaming/sse-emitter';
export { toSSEEvent, formatSSE, formatKeepAlive, type SSEEvent } from './streaming/event-types';

// Protocol (for customization/testing)
export {
  buildDiscussionSystemPrompt,
  buildConsensusSystemPrompt,
  buildInitialTurnMessage,
  buildFollowUpTurnMessage,
  buildConsensusPrompt,
} from './protocol/prompts';

export {
  buildTurnMessages,
  buildConsensusMessages,
  addTurnToHistory,
  type MessageContext,
} from './protocol/message-builder';

export {
  parseConsensusResponse,
  toConsensusVote,
  type ParsedConsensusResponse,
} from './protocol/response-parser';
