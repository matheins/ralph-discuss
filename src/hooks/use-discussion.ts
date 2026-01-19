'use client';

import { useReducer, useCallback, useMemo } from 'react';
import { useSSEStream } from './use-sse-stream';
import { discussionApi } from '@/lib/client/discussion-api';
import type {
  DiscussionUIState,
  DiscussionAction,
  SSEEvent,
  SelectedModel,
} from '@/lib/client/types';
import type { DiscussionId } from '@/lib/discussion';

// ============================================================================
// Initial State
// ============================================================================

const initialState: DiscussionUIState = {
  uiPhase: 'setup',
  discussionId: null,
  serverPhase: 'idle',
  prompt: '',
  modelA: null,
  modelB: null,
  rounds: [],
  currentRound: 0,
  streamingTurn: null,
  consensusVotes: [],
  finalConsensus: null,
  stoppingReason: null,
  error: null,
  startedAt: null,
  completedAt: null,
};

// ============================================================================
// Reducer
// ============================================================================

function discussionReducer(
  state: DiscussionUIState,
  action: DiscussionAction
): DiscussionUIState {
  switch (action.type) {
    case 'SET_PROMPT':
      return { ...state, prompt: action.payload };

    case 'SET_MODEL_A':
      return { ...state, modelA: action.payload };

    case 'SET_MODEL_B':
      return { ...state, modelB: action.payload };

    case 'START_CONNECTING':
      return {
        ...state,
        uiPhase: 'connecting',
        error: null,
        rounds: [],
        currentRound: 0,
        streamingTurn: null,
        consensusVotes: [],
        finalConsensus: null,
        stoppingReason: null,
        completedAt: null,
      };

    case 'SSE_EVENT':
      return handleSSEEvent(state, action.payload);

    case 'CONNECTION_ERROR':
      return {
        ...state,
        uiPhase: 'error',
        error: {
          code: 'PROVIDER_ERROR',
          message: action.payload.message,
          recoverable: true,
        },
      };

    case 'ABORT':
      return {
        ...state,
        uiPhase: 'completed',
        serverPhase: 'aborted',
        stoppingReason: 'user_abort',
        completedAt: Date.now(),
      };

    case 'RESET':
      return {
        ...initialState,
        modelA: state.modelA,
        modelB: state.modelB,
      };

    default:
      return state;
  }
}

// ============================================================================
// SSE Event Handler
// ============================================================================

function handleSSEEvent(
  state: DiscussionUIState,
  event: SSEEvent
): DiscussionUIState {
  switch (event.type) {
    case 'discussion-started':
      return {
        ...state,
        uiPhase: 'active',
        discussionId: event.data.discussionId as DiscussionId,
        serverPhase: 'initializing',
        startedAt: event.data.timestamp,
      };

    case 'round-started':
      return {
        ...state,
        currentRound: event.data.roundNumber,
        rounds: [
          ...state.rounds,
          {
            number: event.data.roundNumber,
            isComplete: false,
          },
        ],
      };

    case 'turn-started':
      return {
        ...state,
        serverPhase: event.data.role === 'model-a' ? 'model-a-turn' : 'model-b-turn',
        streamingTurn: {
          role: event.data.role,
          content: '',
          isComplete: false,
        },
      };

    case 'turn-chunk':
      if (!state.streamingTurn) return state;
      return {
        ...state,
        streamingTurn: {
          ...state.streamingTurn,
          content: state.streamingTurn.content + event.data.chunk,
        },
      };

    case 'turn-completed': {
      const turn = event.data.turn;
      const updatedRounds = state.rounds.map((round) => {
        if (round.number !== turn.roundNumber) return round;
        return {
          ...round,
          ...(turn.role === 'model-a'
            ? { modelATurn: turn }
            : { modelBTurn: turn }),
        };
      });

      return {
        ...state,
        rounds: updatedRounds,
        streamingTurn: null,
      };
    }

    case 'consensus-check-started':
      return {
        ...state,
        serverPhase: 'consensus-check-a',
      };

    case 'consensus-vote':
      return {
        ...state,
        serverPhase: event.data.vote.role === 'model-a' ? 'consensus-check-b' : state.serverPhase,
        consensusVotes: [...state.consensusVotes, event.data.vote],
      };

    case 'consensus-result': {
      const result = event.data.result;
      const updatedRounds = state.rounds.map((round) => {
        if (round.number !== result.roundNumber) return round;
        return {
          ...round,
          consensusResult: result,
        };
      });

      return {
        ...state,
        rounds: updatedRounds,
      };
    }

    case 'round-completed': {
      const updatedRounds = state.rounds.map((round) => {
        if (round.number !== event.data.roundNumber) return round;
        return { ...round, isComplete: true };
      });

      return {
        ...state,
        rounds: updatedRounds,
      };
    }

    case 'discussion-completed':
      return {
        ...state,
        uiPhase: 'completed',
        serverPhase: 'completed',
        stoppingReason: event.data.stoppingReason,
        finalConsensus: event.data.finalConsensus ?? null,
        completedAt: event.data.timestamp,
      };

    case 'discussion-error':
      return {
        ...state,
        uiPhase: 'error',
        serverPhase: 'error',
        error: event.data.error,
      };

    case 'discussion-aborted':
      return {
        ...state,
        uiPhase: 'completed',
        serverPhase: 'aborted',
        stoppingReason: 'user_abort',
        completedAt: event.data.timestamp,
      };

    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useDiscussion() {
  const [state, dispatch] = useReducer(discussionReducer, initialState);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    dispatch({ type: 'SSE_EVENT', payload: event });
  }, []);

  const handleConnectionError = useCallback((error: Error) => {
    dispatch({ type: 'CONNECTION_ERROR', payload: error });
  }, []);

  const { connect, disconnect, isConnecting } = useSSEStream({
    url: discussionApi.getDiscussionEndpoint(),
    onEvent: handleSSEEvent,
    onError: handleConnectionError,
  });

  // ============================================================================
  // Actions
  // ============================================================================

  const setPrompt = useCallback((prompt: string) => {
    dispatch({ type: 'SET_PROMPT', payload: prompt });
  }, []);

  const setModelA = useCallback((model: SelectedModel) => {
    dispatch({ type: 'SET_MODEL_A', payload: model });
  }, []);

  const setModelB = useCallback((model: SelectedModel) => {
    dispatch({ type: 'SET_MODEL_B', payload: model });
  }, []);

  const startDiscussion = useCallback(async () => {
    if (!state.modelA || !state.modelB) return;

    const request = discussionApi.buildRequestBody(
      state.prompt,
      state.modelA,
      state.modelB
    );

    const validationError = discussionApi.validateRequest(request);
    if (validationError) {
      dispatch({
        type: 'CONNECTION_ERROR',
        payload: new Error(validationError),
      });
      return;
    }

    dispatch({ type: 'START_CONNECTING' });
    await connect(request);
  }, [state.prompt, state.modelA, state.modelB, connect]);

  const abortDiscussion = useCallback(() => {
    disconnect();
    dispatch({ type: 'ABORT' });
  }, [disconnect]);

  const resetDiscussion = useCallback(() => {
    disconnect();
    dispatch({ type: 'RESET' });
  }, [disconnect]);

  // ============================================================================
  // Computed Values
  // ============================================================================

  const canStart = useMemo(() => {
    return (
      state.uiPhase === 'setup' &&
      state.prompt.trim().length >= 10 &&
      state.modelA !== null &&
      state.modelB !== null
    );
  }, [state.uiPhase, state.prompt, state.modelA, state.modelB]);

  const isActive = useMemo(() => {
    return state.uiPhase === 'active' || state.uiPhase === 'connecting';
  }, [state.uiPhase]);

  return {
    // State
    state,

    // Setters
    setPrompt,
    setModelA,
    setModelB,

    // Actions
    startDiscussion,
    abortDiscussion,
    resetDiscussion,

    // Computed
    canStart,
    isActive,
    isConnecting,
  };
}
