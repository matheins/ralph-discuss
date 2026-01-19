import type { DiscussionError, DiscussionErrorCode, ParticipantRole } from './types';

export class DiscussionEngineError extends Error implements DiscussionError {
  public readonly code: DiscussionErrorCode;
  public readonly role?: ParticipantRole;
  public readonly roundNumber?: number;
  public readonly recoverable: boolean;
  public readonly originalError?: unknown;

  constructor(params: DiscussionError) {
    super(params.message);
    this.name = 'DiscussionEngineError';
    this.code = params.code;
    this.role = params.role;
    this.roundNumber = params.roundNumber;
    this.recoverable = params.recoverable;
    this.originalError = params.originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DiscussionEngineError);
    }
  }

  toJSON(): DiscussionError {
    return {
      code: this.code,
      message: this.message,
      role: this.role,
      roundNumber: this.roundNumber,
      recoverable: this.recoverable,
    };
  }
}

export class TurnTimeoutError extends DiscussionEngineError {
  constructor(role: ParticipantRole, roundNumber: number, timeoutMs: number) {
    super({
      code: 'TURN_TIMEOUT',
      message: `Turn timed out after ${timeoutMs}ms for ${role} in round ${roundNumber}`,
      role,
      roundNumber,
      recoverable: true,
    });
    this.name = 'TurnTimeoutError';
  }
}

export class ConsensusParseFailed extends DiscussionEngineError {
  constructor(role: ParticipantRole, rawResponse: string) {
    super({
      code: 'CONSENSUS_PARSE_FAILED',
      message: `Failed to parse consensus response from ${role}`,
      role,
      recoverable: true,
      originalError: { rawResponse },
    });
    this.name = 'ConsensusParseFailed';
  }
}

export class StateTransitionError extends DiscussionEngineError {
  constructor(fromPhase: string, toPhase: string, reason: string) {
    super({
      code: 'STATE_INVALID',
      message: `Invalid state transition from ${fromPhase} to ${toPhase}: ${reason}`,
      recoverable: false,
    });
    this.name = 'StateTransitionError';
  }
}

export class DiscussionTimeoutError extends DiscussionEngineError {
  constructor(totalTimeoutMs: number) {
    super({
      code: 'DISCUSSION_TIMEOUT',
      message: `Discussion timed out after ${totalTimeoutMs}ms`,
      recoverable: false,
    });
    this.name = 'DiscussionTimeoutError';
  }
}

export class InitializationError extends DiscussionEngineError {
  constructor(message: string, originalError?: unknown) {
    super({
      code: 'INITIALIZATION_FAILED',
      message,
      recoverable: false,
      originalError,
    });
    this.name = 'InitializationError';
  }
}
