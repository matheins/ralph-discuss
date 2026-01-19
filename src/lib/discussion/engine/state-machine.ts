import type { DiscussionPhase } from '../core/types';
import { StateTransitionError } from '../core/errors';

type TransitionMap = Partial<Record<DiscussionPhase, DiscussionPhase[]>>;

const VALID_TRANSITIONS: TransitionMap = {
  'idle': ['initializing'],
  'initializing': ['model-a-turn', 'error'],
  'model-a-turn': ['model-b-turn', 'error', 'aborted'],
  'model-b-turn': ['consensus-check-a', 'model-a-turn', 'error', 'aborted'],
  'consensus-check-a': ['consensus-check-b', 'error', 'aborted'],
  'consensus-check-b': ['model-a-turn', 'completed', 'error', 'aborted'],
  'completed': [],
  'error': ['idle'],
  'aborted': ['idle'],
};

export class DiscussionStateMachine {
  private _phase: DiscussionPhase = 'idle';
  private _transitionHistory: Array<{ from: DiscussionPhase; to: DiscussionPhase; at: number }> = [];

  get phase(): DiscussionPhase {
    return this._phase;
  }

  get history(): ReadonlyArray<{ from: DiscussionPhase; to: DiscussionPhase; at: number }> {
    return this._transitionHistory;
  }

  canTransition(to: DiscussionPhase): boolean {
    const allowed = VALID_TRANSITIONS[this._phase] || [];
    return allowed.includes(to);
  }

  transition(to: DiscussionPhase): void {
    if (!this.canTransition(to)) {
      throw new StateTransitionError(
        this._phase,
        to,
        `Valid transitions from ${this._phase}: ${(VALID_TRANSITIONS[this._phase] || []).join(', ') || 'none'}`
      );
    }

    this._transitionHistory.push({
      from: this._phase,
      to,
      at: Date.now(),
    });

    this._phase = to;
  }

  reset(): void {
    this._phase = 'idle';
    this._transitionHistory = [];
  }

  isActive(): boolean {
    return !['idle', 'completed', 'error', 'aborted'].includes(this._phase);
  }

  isTerminal(): boolean {
    return ['completed', 'error', 'aborted'].includes(this._phase);
  }
}
