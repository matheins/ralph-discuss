import { DiscussionStateMachine } from '@/lib/discussion/engine/state-machine';
import { StateTransitionError } from '@/lib/discussion/core/errors';

describe('DiscussionStateMachine', () => {
  let stateMachine: DiscussionStateMachine;

  beforeEach(() => {
    stateMachine = new DiscussionStateMachine();
  });

  describe('initial state', () => {
    it('starts in idle phase', () => {
      expect(stateMachine.phase).toBe('idle');
    });

    it('has empty transition history', () => {
      expect(stateMachine.history).toHaveLength(0);
    });

    it('is not active', () => {
      expect(stateMachine.isActive()).toBe(false);
    });

    it('is not terminal', () => {
      expect(stateMachine.isTerminal()).toBe(false);
    });
  });

  describe('valid transitions', () => {
    it('transitions from idle to initializing', () => {
      stateMachine.transition('initializing');
      expect(stateMachine.phase).toBe('initializing');
    });

    it('transitions through complete discussion flow', () => {
      const flow = [
        'initializing',
        'model-a-turn',
        'model-b-turn',
        'consensus-check-a',
        'consensus-check-b',
        'completed',
      ] as const;

      for (const phase of flow) {
        stateMachine.transition(phase);
        expect(stateMachine.phase).toBe(phase);
      }
    });

    it('allows model-b-turn to loop back to model-a-turn', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('model-b-turn');
      stateMachine.transition('model-a-turn');
      expect(stateMachine.phase).toBe('model-a-turn');
    });

    it('allows consensus-check-b to loop back to model-a-turn', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('model-b-turn');
      stateMachine.transition('consensus-check-a');
      stateMachine.transition('consensus-check-b');
      stateMachine.transition('model-a-turn');
      expect(stateMachine.phase).toBe('model-a-turn');
    });

    it('allows transition to error from initializing', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('error');
      expect(stateMachine.phase).toBe('error');
    });

    it('allows transition to aborted during discussion', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('aborted');
      expect(stateMachine.phase).toBe('aborted');
    });
  });

  describe('invalid transitions', () => {
    it('throws on invalid transition from idle', () => {
      expect(() => stateMachine.transition('model-a-turn')).toThrow(StateTransitionError);
    });

    it('throws when transitioning from completed', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('model-b-turn');
      stateMachine.transition('consensus-check-a');
      stateMachine.transition('consensus-check-b');
      stateMachine.transition('completed');

      expect(() => stateMachine.transition('model-a-turn')).toThrow(StateTransitionError);
    });

    it('throws when skipping required phases', () => {
      stateMachine.transition('initializing');
      expect(() => stateMachine.transition('consensus-check-a')).toThrow(StateTransitionError);
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      expect(stateMachine.canTransition('initializing')).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      expect(stateMachine.canTransition('completed')).toBe(false);
    });
  });

  describe('transition history', () => {
    it('records all transitions', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');

      expect(stateMachine.history).toHaveLength(2);
      expect(stateMachine.history[0].from).toBe('idle');
      expect(stateMachine.history[0].to).toBe('initializing');
      expect(stateMachine.history[1].from).toBe('initializing');
      expect(stateMachine.history[1].to).toBe('model-a-turn');
    });

    it('includes timestamps', () => {
      const before = Date.now();
      stateMachine.transition('initializing');
      const after = Date.now();

      expect(stateMachine.history[0].at).toBeGreaterThanOrEqual(before);
      expect(stateMachine.history[0].at).toBeLessThanOrEqual(after);
    });
  });

  describe('isActive', () => {
    it('returns true during active phases', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      expect(stateMachine.isActive()).toBe(true);
    });

    it('returns false for terminal phases', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('error');
      expect(stateMachine.isActive()).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('returns true for completed', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('model-b-turn');
      stateMachine.transition('consensus-check-a');
      stateMachine.transition('consensus-check-b');
      stateMachine.transition('completed');
      expect(stateMachine.isTerminal()).toBe(true);
    });

    it('returns true for error', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('error');
      expect(stateMachine.isTerminal()).toBe(true);
    });

    it('returns true for aborted', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.transition('aborted');
      expect(stateMachine.isTerminal()).toBe(true);
    });
  });

  describe('reset', () => {
    it('returns to idle state', () => {
      stateMachine.transition('initializing');
      stateMachine.transition('model-a-turn');
      stateMachine.reset();
      expect(stateMachine.phase).toBe('idle');
    });

    it('clears transition history', () => {
      stateMachine.transition('initializing');
      stateMachine.reset();
      expect(stateMachine.history).toHaveLength(0);
    });
  });
});
