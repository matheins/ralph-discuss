# Step 4: Web UI - Detailed Implementation Plan

## Overview

The Web UI is the user-facing layer that enables interaction with the AI discussion system. It provides model selection, prompt input, real-time streaming display of the discussion, and final consensus presentation. This step builds upon the Discussion Engine (Step 3) and AI Integration Layer (Step 2).

---

## Architecture Overview

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Main discussion page
│   └── globals.css                   # Global styles + custom animations
├── components/
│   ├── ui/                           # shadcn/ui components (pre-installed)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── scroll-area.tsx
│   │   ├── separator.tsx
│   │   ├── avatar.tsx
│   │   ├── skeleton.tsx
│   │   ├── alert.tsx
│   │   └── progress.tsx
│   └── discussion/                   # Custom discussion components
│       ├── model-selector.tsx        # Dropdown for selecting AI model
│       ├── prompt-input.tsx          # Text area with submit button
│       ├── discussion-container.tsx  # Main container orchestrating the UI
│       ├── message-list.tsx          # Scrollable list of messages
│       ├── message-bubble.tsx        # Individual message display
│       ├── streaming-indicator.tsx   # "Thinking..." animation
│       ├── consensus-card.tsx        # Final consensus display
│       ├── round-header.tsx          # Round number + status badge
│       ├── discussion-controls.tsx   # Start/Stop/Reset buttons
│       └── error-display.tsx         # Error state presentation
├── hooks/
│   ├── use-discussion.ts             # Main discussion state management
│   ├── use-sse-stream.ts             # SSE connection management
│   └── use-available-models.ts       # Fetch available models from providers
├── lib/
│   └── client/
│       ├── sse-client.ts             # SSE event parsing utilities
│       ├── discussion-api.ts         # API client for discussion endpoint
│       └── types.ts                  # Client-side type definitions
└── config/
    └── ui-constants.ts               # UI configuration constants
```

---

## Implementation Steps

---

### Step 4.1: UI Constants & Configuration

**File:** `src/config/ui-constants.ts`

**Purpose:** Centralized UI configuration for consistency and easy modification.

#### Constants

```typescript
// ============================================================================
// Model Display Configuration
// ============================================================================

export const MODEL_COLORS = {
  'model-a': {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'bg-blue-500',
    avatar: 'bg-blue-100 dark:bg-blue-900',
  },
  'model-b': {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'bg-amber-500',
    avatar: 'bg-amber-100 dark:bg-amber-900',
  },
} as const;

export const CONSENSUS_COLORS = {
  reached: {
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-800 dark:text-green-200',
    icon: 'text-green-600 dark:text-green-400',
  },
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
  },
} as const;

// ============================================================================
// Animation Configuration
// ============================================================================

export const ANIMATIONS = {
  streamingDots: 'animate-pulse',
  fadeIn: 'animate-in fade-in duration-300',
  slideUp: 'animate-in slide-in-from-bottom-2 duration-300',
} as const;

// ============================================================================
// Layout Configuration
// ============================================================================

export const LAYOUT = {
  maxMessageWidth: 'max-w-3xl',
  containerPadding: 'px-4 md:px-6 lg:px-8',
  messageGap: 'space-y-4',
  sectionGap: 'space-y-6',
} as const;

// ============================================================================
// Discussion Defaults
// ============================================================================

export const DISCUSSION_DEFAULTS = {
  maxIterations: 10,
  temperature: 0.7,
  maxTokensPerTurn: 2048,
  minPromptLength: 10,
  maxPromptLength: 10000,
} as const;

// ============================================================================
// Provider Display Names
// ============================================================================

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (Local)',
} as const;

// ============================================================================
// Status Messages
// ============================================================================

export const STATUS_MESSAGES = {
  idle: 'Ready to start discussion',
  initializing: 'Initializing discussion...',
  'model-a-turn': 'Model A is thinking...',
  'model-b-turn': 'Model B is responding...',
  'consensus-check-a': 'Model A evaluating consensus...',
  'consensus-check-b': 'Model B evaluating consensus...',
  completed: 'Discussion completed',
  error: 'An error occurred',
  aborted: 'Discussion aborted',
} as const;
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Color scheme per role** | Visual distinction between Model A (blue) and Model B (amber) for easy tracking |
| **Dark mode support** | All colors have `dark:` variants for theme compatibility |
| **Centralized constants** | Single source of truth for UI consistency, easy to modify |
| **Type-safe with `as const`** | Enables TypeScript inference and autocomplete |

---

### Step 4.2: Client-Side Types

**File:** `src/lib/client/types.ts`

**Purpose:** Type definitions for client-side state management.

```typescript
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
  prompt: string;
  participants: {
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
  | { type: 'consensus-check-started'; data: { discussionId: string; role: ParticipantRole } }
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
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate `UIPhase` from server `DiscussionPhase`** | UI needs additional states (setup, connecting) not tracked by server |
| **`StreamingTurn` for in-progress content** | Accumulates chunks before turn is complete |
| **`RoundDisplay` structure** | Groups turns and consensus for UI rendering |
| **Discriminated union for `SSEEvent`** | Type-safe event handling with narrowing |
| **Reducer pattern with `DiscussionAction`** | Predictable state updates, easy to debug |

---

### Step 4.3: SSE Client Utilities

**File:** `src/lib/client/sse-client.ts`

**Purpose:** Parse and validate SSE events from the server.

```typescript
import type { SSEEvent } from './types';

// ============================================================================
// SSE Event Parsing
// ============================================================================

export function parseSSEEvent(eventType: string, data: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(data);

    switch (eventType) {
      case 'discussion-started':
        return { type: 'discussion-started', data: parsed };
      case 'round-started':
        return { type: 'round-started', data: parsed };
      case 'turn-started':
        return { type: 'turn-started', data: parsed };
      case 'turn-chunk':
        return { type: 'turn-chunk', data: parsed };
      case 'turn-completed':
        return { type: 'turn-completed', data: parsed };
      case 'consensus-check-started':
        return { type: 'consensus-check-started', data: parsed };
      case 'consensus-vote':
        return { type: 'consensus-vote', data: parsed };
      case 'consensus-result':
        return { type: 'consensus-result', data: parsed };
      case 'round-completed':
        return { type: 'round-completed', data: parsed };
      case 'discussion-completed':
        return { type: 'discussion-completed', data: parsed };
      case 'discussion-error':
        return { type: 'discussion-error', data: parsed };
      case 'discussion-aborted':
        return { type: 'discussion-aborted', data: parsed };
      default:
        console.warn(`Unknown SSE event type: ${eventType}`);
        return null;
    }
  } catch (error) {
    console.error('Failed to parse SSE event:', error, { eventType, data });
    return null;
  }
}

// ============================================================================
// SSE Connection Management
// ============================================================================

export interface SSEConnectionOptions {
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class SSEConnection {
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;
  private closed = false;

  constructor(
    private url: string,
    private options: SSEConnectionOptions
  ) {}

  async connect(body: unknown): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!this.closed) {
        const { done, value } = await reader.read();

        if (done) {
          this.options.onClose();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        const events = this.extractEvents(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          const sseEvent = parseSSEEvent(event.type, event.data);
          if (sseEvent) {
            this.options.onEvent(sseEvent);
          }
        }
      }
    } catch (error) {
      if (!this.closed) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private extractEvents(buffer: string): {
    parsed: Array<{ type: string; data: string }>;
    remaining: string;
  } {
    const parsed: Array<{ type: string; data: string }> = [];
    const lines = buffer.split('\n');

    let currentEvent: { type?: string; data?: string } = {};
    let processedUpTo = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('event: ')) {
        currentEvent.type = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentEvent.data = line.slice(6);
      } else if (line === '' && currentEvent.type && currentEvent.data) {
        // Empty line marks end of event
        parsed.push({ type: currentEvent.type, data: currentEvent.data });
        currentEvent = {};
        processedUpTo = lines.slice(0, i + 1).join('\n').length + 1;
      } else if (line.startsWith(':')) {
        // Comment/keep-alive, ignore
        processedUpTo = lines.slice(0, i + 1).join('\n').length + 1;
      }
    }

    return {
      parsed,
      remaining: buffer.slice(processedUpTo),
    };
  }

  close(): void {
    this.closed = true;
    this.abortController?.abort();
    this.eventSource?.close();
  }
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Manual SSE parsing over EventSource API** | POST requests not supported by native EventSource; need to send body |
| **Buffer-based event extraction** | Handle partial chunks, ensure complete events before parsing |
| **Abort controller integration** | Clean cancellation on user abort |
| **Keep-alive comment handling** | Ignore `:` prefixed lines (SSE comments) |

---

### Step 4.4: Discussion API Client

**File:** `src/lib/client/discussion-api.ts`

**Purpose:** Type-safe API client for the discussion endpoint.

```typescript
import type { ProviderId } from '@/lib/ai';
import type { DiscussionOptions } from '@/lib/discussion';

// ============================================================================
// Request Types
// ============================================================================

export interface StartDiscussionRequest {
  prompt: string;
  modelA: {
    modelId: string;
    providerId: ProviderId;
    displayName?: string;
  };
  modelB: {
    modelId: string;
    providerId: ProviderId;
    displayName?: string;
  };
  options?: Partial<DiscussionOptions>;
}

// ============================================================================
// API Client
// ============================================================================

export const discussionApi = {
  /**
   * Get the SSE endpoint URL for starting a discussion
   */
  getDiscussionEndpoint(): string {
    return '/api/discussion';
  },

  /**
   * Validate a discussion request before sending
   */
  validateRequest(request: StartDiscussionRequest): string | null {
    if (!request.prompt?.trim()) {
      return 'Prompt is required';
    }

    if (request.prompt.trim().length < 10) {
      return 'Prompt must be at least 10 characters';
    }

    if (request.prompt.trim().length > 10000) {
      return 'Prompt must be less than 10,000 characters';
    }

    if (!request.modelA?.modelId || !request.modelA?.providerId) {
      return 'Model A must be selected';
    }

    if (!request.modelB?.modelId || !request.modelB?.providerId) {
      return 'Model B must be selected';
    }

    return null;
  },

  /**
   * Build the request body for starting a discussion
   */
  buildRequestBody(
    prompt: string,
    modelA: { modelId: string; providerId: ProviderId; displayName: string },
    modelB: { modelId: string; providerId: ProviderId; displayName: string },
    options?: Partial<DiscussionOptions>
  ): StartDiscussionRequest {
    return {
      prompt: prompt.trim(),
      modelA: {
        modelId: modelA.modelId,
        providerId: modelA.providerId,
        displayName: modelA.displayName,
      },
      modelB: {
        modelId: modelB.modelId,
        providerId: modelB.providerId,
        displayName: modelB.displayName,
      },
      options,
    };
  },
};
```

---

### Step 4.5: Custom Hooks - useAvailableModels

**File:** `src/hooks/use-available-models.ts`

**Purpose:** Fetch and manage available models from all providers.

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ModelOption } from '@/lib/client/types';
import type { ProviderId } from '@/lib/ai';

interface UseAvailableModelsReturn {
  models: ModelOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getModelsByProvider: (providerId: ProviderId) => ModelOption[];
}

export function useAvailableModels(): UseAvailableModelsReturn {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models');

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      setModels(data.models);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch models'));

      // Fallback to hardcoded models if API fails
      setModels(getDefaultModels());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getModelsByProvider = useCallback(
    (providerId: ProviderId): ModelOption[] => {
      return models.filter((m) => m.providerId === providerId);
    },
    [models]
  );

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
    getModelsByProvider,
  };
}

// ============================================================================
// Default Models (Fallback)
// ============================================================================

function getDefaultModels(): ModelOption[] {
  return [
    // OpenAI
    { id: 'gpt-4o', providerId: 'openai', displayName: 'GPT-4o', description: 'Most capable OpenAI model' },
    { id: 'gpt-4o-mini', providerId: 'openai', displayName: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', providerId: 'openai', displayName: 'GPT-4 Turbo', description: 'High capability with vision' },

    // Anthropic
    { id: 'claude-opus-4-20250514', providerId: 'anthropic', displayName: 'Claude Opus 4', description: 'Most capable Claude model' },
    { id: 'claude-sonnet-4-20250514', providerId: 'anthropic', displayName: 'Claude Sonnet 4', description: 'Balanced performance' },
    { id: 'claude-3-5-sonnet-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Sonnet', description: 'Fast and intelligent' },
    { id: 'claude-3-5-haiku-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Haiku', description: 'Fastest Claude model' },
  ];
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **API endpoint for models** | Dynamic model list, supports Ollama's runtime discovery |
| **Fallback to hardcoded** | Graceful degradation if API fails |
| **Memoized `getModelsByProvider`** | Efficient filtering for grouped dropdowns |

---

### Step 4.6: Custom Hooks - useSSEStream

**File:** `src/hooks/use-sse-stream.ts`

**Purpose:** Manage SSE connection lifecycle with React state.

```typescript
'use client';

import { useCallback, useRef, useState } from 'react';
import { SSEConnection } from '@/lib/client/sse-client';
import type { SSEEvent } from '@/lib/client/types';

interface UseSSEStreamOptions {
  url: string;
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

interface UseSSEStreamReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: (body: unknown) => Promise<void>;
  disconnect: () => void;
  error: Error | null;
}

export function useSSEStream(options: UseSSEStreamOptions): UseSSEStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connectionRef = useRef<SSEConnection | null>(null);

  const connect = useCallback(async (body: unknown) => {
    // Clean up existing connection
    if (connectionRef.current) {
      connectionRef.current.close();
    }

    setIsConnecting(true);
    setError(null);

    const connection = new SSEConnection(options.url, {
      onEvent: (event) => {
        setIsConnected(true);
        setIsConnecting(false);
        options.onEvent(event);
      },
      onError: (err) => {
        setError(err);
        setIsConnected(false);
        setIsConnecting(false);
        options.onError?.(err);
      },
      onClose: () => {
        setIsConnected(false);
        setIsConnecting(false);
        options.onClose?.();
      },
    });

    connectionRef.current = connection;

    try {
      await connection.connect(body);
    } catch (err) {
      // Error already handled in onError callback
    }
  }, [options]);

  const disconnect = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    error,
  };
}
```

---

### Step 4.7: Custom Hooks - useDiscussion (Main State Management)

**File:** `src/hooks/use-discussion.ts`

**Purpose:** Central state management for the discussion UI using reducer pattern.

```typescript
'use client';

import { useReducer, useCallback, useMemo } from 'react';
import { useSSEStream } from './use-sse-stream';
import { discussionApi } from '@/lib/client/discussion-api';
import type {
  DiscussionUIState,
  DiscussionAction,
  SSEEvent,
  SelectedModel,
  RoundDisplay,
} from '@/lib/client/types';
import type { DiscussionId, DiscussionPhase } from '@/lib/discussion';

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
        serverPhase: event.data.role === 'model-a'
          ? 'consensus-check-a'
          : 'consensus-check-b',
      };

    case 'consensus-vote':
      return {
        ...state,
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
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **useReducer over useState** | Complex state with many interdependent fields; predictable updates |
| **Immutable round updates** | Map over rounds to update specific round; maintains React reconciliation |
| **Streaming turn buffer** | Accumulates chunks in `streamingTurn` until `turn-completed` fires |
| **Computed `canStart`** | Derived state for validation, memoized for performance |
| **Preserve models on reset** | Better UX - don't clear model selection when starting new discussion |

---

### Step 4.8: Model Selector Component

**File:** `src/components/discussion/model-selector.tsx`

**Purpose:** Dropdown component for selecting an AI model.

```typescript
'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ModelOption, SelectedModel } from '@/lib/client/types';
import type { ProviderId } from '@/lib/ai';
import { PROVIDER_DISPLAY_NAMES } from '@/config/ui-constants';

interface ModelSelectorProps {
  label: string;
  models: ModelOption[];
  selectedModel: SelectedModel | null;
  onSelect: (model: SelectedModel) => void;
  disabled?: boolean;
  excludeModelId?: string; // Prevent selecting same model as other selector
}

export function ModelSelector({
  label,
  models,
  selectedModel,
  onSelect,
  disabled = false,
  excludeModelId,
}: ModelSelectorProps) {
  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<ProviderId, ModelOption[]> = {
      openai: [],
      anthropic: [],
      ollama: [],
    };

    for (const model of models) {
      if (model.id !== excludeModelId) {
        groups[model.providerId]?.push(model);
      }
    }

    return groups;
  }, [models, excludeModelId]);

  const handleValueChange = (value: string) => {
    // Value format: "providerId:modelId"
    const [providerId, modelId] = value.split(':') as [ProviderId, string];
    const model = models.find(
      (m) => m.id === modelId && m.providerId === providerId
    );

    if (model) {
      onSelect({
        modelId: model.id,
        providerId: model.providerId,
        displayName: model.displayName,
      });
    }
  };

  const currentValue = selectedModel
    ? `${selectedModel.providerId}:${selectedModel.modelId}`
    : undefined;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedModels).map(([providerId, providerModels]) => {
            if (providerModels.length === 0) return null;

            return (
              <SelectGroup key={providerId}>
                <SelectLabel className="flex items-center gap-2">
                  {PROVIDER_DISPLAY_NAMES[providerId] || providerId}
                  <Badge variant="secondary" className="text-xs">
                    {providerModels.length}
                  </Badge>
                </SelectLabel>
                {providerModels.map((model) => (
                  <SelectItem
                    key={`${model.providerId}:${model.id}`}
                    value={`${model.providerId}:${model.id}`}
                  >
                    <div className="flex flex-col">
                      <span>{model.displayName}</span>
                      {model.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Grouped by provider** | Easier navigation, clear provider context |
| **`providerId:modelId` value format** | Unique identifier since model IDs may overlap across providers |
| **`excludeModelId` prop** | Prevents selecting same model for both A and B (optional) |
| **Badge with count** | Shows how many models available per provider |

---

### Step 4.9: Prompt Input Component

**File:** `src/components/discussion/prompt-input.tsx`

**Purpose:** Text area for entering the discussion prompt with validation.

```typescript
'use client';

import { useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DISCUSSION_DEFAULTS } from '@/config/ui-constants';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isLoading: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  canSubmit,
  isLoading,
}: PromptInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [canSubmit, onSubmit]
  );

  const characterCount = value.length;
  const isOverLimit = characterCount > DISCUSSION_DEFAULTS.maxPromptLength;
  const isTooShort = characterCount < DISCUSSION_DEFAULTS.minPromptLength && characterCount > 0;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Discussion Prompt
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a problem or question for the AI models to discuss and solve together..."
        className="min-h-[120px] resize-y"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isTooShort && (
            <span className="text-amber-600 dark:text-amber-400">
              Minimum {DISCUSSION_DEFAULTS.minPromptLength} characters required
            </span>
          )}
          {isOverLimit && (
            <span className="text-red-600 dark:text-red-400">
              Maximum {DISCUSSION_DEFAULTS.maxPromptLength.toLocaleString()} characters
            </span>
          )}
          {!isTooShort && !isOverLimit && (
            <span>
              {characterCount.toLocaleString()} / {DISCUSSION_DEFAULTS.maxPromptLength.toLocaleString()}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">
            {typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}
          </kbd> + <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">
            Enter
          </kbd> to start
        </div>
      </div>
      <Button
        onClick={onSubmit}
        disabled={!canSubmit || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <span className="animate-spin mr-2">⟳</span>
            Connecting...
          </>
        ) : (
          'Start Discussion'
        )}
      </Button>
    </div>
  );
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Cmd/Ctrl + Enter to submit** | Power user shortcut, common pattern |
| **Character counter** | Transparent limits, prevents validation surprises |
| **Validation feedback colors** | Amber for warning, red for error, consistent with design system |
| **Responsive keyboard hint** | Shows correct modifier key for Mac vs Windows/Linux |

---

### Step 4.10: Message Bubble Component

**File:** `src/components/discussion/message-bubble.tsx`

**Purpose:** Display individual message/turn with role-specific styling.

```typescript
'use client';

import { useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MODEL_COLORS } from '@/config/ui-constants';
import type { ParticipantRole, Turn } from '@/lib/discussion';
import type { StreamingTurn } from '@/lib/client/types';

interface MessageBubbleProps {
  role: ParticipantRole;
  displayName: string;
  content: string;
  isStreaming?: boolean;
  turn?: Turn;
}

export function MessageBubble({
  role,
  displayName,
  content,
  isStreaming = false,
  turn,
}: MessageBubbleProps) {
  const colors = MODEL_COLORS[role];
  const initial = role === 'model-a' ? 'A' : 'B';

  const formattedContent = useMemo(() => {
    // Basic markdown-like formatting
    return content
      .split('\n')
      .map((line, i) => {
        // Handle code blocks (simple)
        if (line.startsWith('```')) {
          return null; // Skip code fence markers
        }

        // Handle bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={i} className="ml-4">
              {line.slice(2)}
            </li>
          );
        }

        // Handle numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <li key={i} className="ml-4 list-decimal">
              {line.slice(numberedMatch[0].length)}
            </li>
          );
        }

        // Regular paragraph
        return line ? (
          <p key={i} className="mb-2 last:mb-0">
            {line}
          </p>
        ) : (
          <br key={i} />
        );
      })
      .filter(Boolean);
  }, [content]);

  return (
    <div className={`flex gap-3 ${role === 'model-b' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <Avatar className={`${colors.avatar} h-8 w-8 shrink-0`}>
        <AvatarFallback className={colors.text}>{initial}</AvatarFallback>
      </Avatar>

      {/* Message Card */}
      <Card
        className={`
          flex-1 max-w-[85%] p-4
          ${colors.bg} ${colors.border} border
          ${isStreaming ? 'animate-pulse' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${colors.text}`}>
            {displayName}
          </span>
          {turn && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatDuration(turn.durationMs)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {formattedContent}
          {isStreaming && (
            <span className="inline-block ml-1 animate-pulse">▊</span>
          )}
        </div>

        {/* Footer with token usage */}
        {turn && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {turn.tokenUsage.completionTokens.toLocaleString()} tokens
            </Badge>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Role-based alignment** | Model A on left, Model B on right for visual distinction |
| **Basic markdown rendering** | Support common formatting without heavy library |
| **Cursor animation while streaming** | Visual feedback that content is still arriving |
| **Token usage badge** | Transparency on resource consumption |
| **Duration display** | Shows how long each turn took |

---

### Step 4.11: Streaming Indicator Component

**File:** `src/components/discussion/streaming-indicator.tsx`

**Purpose:** Visual indicator when model is "thinking" before content arrives.

```typescript
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { MODEL_COLORS, STATUS_MESSAGES } from '@/config/ui-constants';
import type { ParticipantRole, DiscussionPhase } from '@/lib/discussion';

interface StreamingIndicatorProps {
  role: ParticipantRole;
  displayName: string;
  phase: DiscussionPhase;
}

export function StreamingIndicator({
  role,
  displayName,
  phase,
}: StreamingIndicatorProps) {
  const colors = MODEL_COLORS[role];
  const initial = role === 'model-a' ? 'A' : 'B';
  const statusMessage = STATUS_MESSAGES[phase] || 'Processing...';

  return (
    <div className={`flex gap-3 ${role === 'model-b' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar with pulse animation */}
      <Avatar className={`${colors.avatar} h-8 w-8 shrink-0 animate-pulse`}>
        <AvatarFallback className={colors.text}>{initial}</AvatarFallback>
      </Avatar>

      {/* Thinking indicator */}
      <Card className={`flex-1 max-w-[85%] p-4 ${colors.bg} ${colors.border} border`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${colors.text}`}>
            {displayName}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ThinkingDots />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {statusMessage}
          </span>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Thinking Dots Animation
// ============================================================================

function ThinkingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"
          style={{
            animation: 'bounce 1.4s infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
```

---

### Step 4.12: Round Header Component

**File:** `src/components/discussion/round-header.tsx`

**Purpose:** Visual separator between rounds with status information.

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ConsensusResult } from '@/lib/discussion';

interface RoundHeaderProps {
  roundNumber: number;
  consensusResult?: ConsensusResult;
  isCurrentRound: boolean;
}

export function RoundHeader({
  roundNumber,
  consensusResult,
  isCurrentRound,
}: RoundHeaderProps) {
  const getConsensusBadge = () => {
    if (!consensusResult) {
      return isCurrentRound ? (
        <Badge variant="secondary">In Progress</Badge>
      ) : null;
    }

    if (consensusResult.isUnanimous) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Consensus Reached
        </Badge>
      );
    }

    const aVote = consensusResult.modelAVote.hasConsensus;
    const bVote = consensusResult.modelBVote.hasConsensus;

    return (
      <Badge variant="secondary">
        Votes: A={aVote ? 'Yes' : 'No'}, B={bVote ? 'Yes' : 'No'}
      </Badge>
    );
  };

  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1" />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-600 dark:text-gray-400">
          Round {roundNumber}
        </span>
        {getConsensusBadge()}
      </div>
      <Separator className="flex-1" />
    </div>
  );
}
```

---

### Step 4.13: Consensus Card Component

**File:** `src/components/discussion/consensus-card.tsx`

**Purpose:** Display final consensus solution prominently.

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CONSENSUS_COLORS } from '@/config/ui-constants';
import type { StoppingReason } from '@/lib/discussion';

interface ConsensusCardProps {
  solution: string;
  achievedAtRound: number;
  stoppingReason: StoppingReason;
}

export function ConsensusCard({
  solution,
  achievedAtRound,
  stoppingReason,
}: ConsensusCardProps) {
  const colors = stoppingReason === 'consensus_reached'
    ? CONSENSUS_COLORS.reached
    : CONSENSUS_COLORS.failed;

  const icon = stoppingReason === 'consensus_reached' ? '✓' : '⚠';
  const title = stoppingReason === 'consensus_reached'
    ? 'Consensus Reached'
    : 'Discussion Ended';

  const subtitle = stoppingReason === 'consensus_reached'
    ? `After ${achievedAtRound} round${achievedAtRound > 1 ? 's' : ''} of discussion`
    : getStoppingReasonText(stoppingReason);

  return (
    <Card className={`${colors.bg} ${colors.border} border-2`}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
          <span className={`text-2xl ${colors.icon || colors.text}`}>{icon}</span>
          <span>{title}</span>
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {subtitle}
        </p>
      </CardHeader>
      <CardContent>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-inner">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {stoppingReason === 'consensus_reached' ? 'Agreed Solution' : 'Final State'}
          </h4>
          <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {solution || 'No solution text available.'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStoppingReasonText(reason: StoppingReason): string {
  switch (reason) {
    case 'max_iterations':
      return 'Maximum iteration limit reached without consensus';
    case 'user_abort':
      return 'Discussion was stopped by user';
    case 'error':
      return 'Discussion ended due to an error';
    case 'timeout':
      return 'Discussion timed out';
    case 'model_unavailable':
      return 'A model became unavailable';
    default:
      return 'Discussion ended';
  }
}
```

---

### Step 4.14: Discussion Controls Component

**File:** `src/components/discussion/discussion-controls.tsx`

**Purpose:** Start, stop, and reset buttons with appropriate states.

```typescript
'use client';

import { Button } from '@/components/ui/button';
import type { UIPhase } from '@/lib/client/types';

interface DiscussionControlsProps {
  uiPhase: UIPhase;
  canStart: boolean;
  onStart: () => void;
  onAbort: () => void;
  onReset: () => void;
}

export function DiscussionControls({
  uiPhase,
  canStart,
  onStart,
  onAbort,
  onReset,
}: DiscussionControlsProps) {
  if (uiPhase === 'setup') {
    return null; // Start button is in PromptInput
  }

  if (uiPhase === 'connecting' || uiPhase === 'active') {
    return (
      <div className="flex justify-center">
        <Button
          variant="destructive"
          onClick={onAbort}
          className="min-w-[120px]"
        >
          Stop Discussion
        </Button>
      </div>
    );
  }

  if (uiPhase === 'completed' || uiPhase === 'error') {
    return (
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={onReset}
          className="min-w-[120px]"
        >
          New Discussion
        </Button>
      </div>
    );
  }

  return null;
}
```

---

### Step 4.15: Error Display Component

**File:** `src/components/discussion/error-display.tsx`

**Purpose:** User-friendly error presentation with recovery options.

```typescript
'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DiscussionError } from '@/lib/discussion';

interface ErrorDisplayProps {
  error: DiscussionError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const title = getErrorTitle(error.code);
  const description = error.message;
  const canRetry = error.recoverable;

  return (
    <Alert variant="destructive" className="my-4">
      <AlertTitle className="flex items-center gap-2">
        <span>⚠</span>
        {title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{description}</p>
        <div className="flex gap-2">
          {canRetry && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getErrorTitle(code: string): string {
  switch (code) {
    case 'INITIALIZATION_FAILED':
      return 'Failed to Start';
    case 'TURN_FAILED':
      return 'Response Failed';
    case 'TURN_TIMEOUT':
      return 'Response Timed Out';
    case 'CONSENSUS_PARSE_FAILED':
      return 'Processing Error';
    case 'PROVIDER_ERROR':
      return 'Provider Error';
    case 'STATE_INVALID':
      return 'Internal Error';
    case 'DISCUSSION_TIMEOUT':
      return 'Discussion Timed Out';
    default:
      return 'Error';
  }
}
```

---

### Step 4.16: Message List Component

**File:** `src/components/discussion/message-list.tsx`

**Purpose:** Scrollable container that renders all discussion messages.

```typescript
'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { StreamingIndicator } from './streaming-indicator';
import { RoundHeader } from './round-header';
import type { RoundDisplay, StreamingTurn, SelectedModel } from '@/lib/client/types';
import type { DiscussionPhase } from '@/lib/discussion';

interface MessageListProps {
  rounds: RoundDisplay[];
  currentRound: number;
  streamingTurn: StreamingTurn | null;
  serverPhase: DiscussionPhase;
  modelA: SelectedModel;
  modelB: SelectedModel;
}

export function MessageList({
  rounds,
  currentRound,
  streamingTurn,
  serverPhase,
  modelA,
  modelB,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rounds, streamingTurn]);

  const getDisplayName = (role: 'model-a' | 'model-b') => {
    return role === 'model-a' ? modelA.displayName : modelB.displayName;
  };

  const isWaitingForTurn = (role: 'model-a' | 'model-b') => {
    const phase = serverPhase;
    if (role === 'model-a') {
      return phase === 'model-a-turn' || phase === 'consensus-check-a';
    }
    return phase === 'model-b-turn' || phase === 'consensus-check-b';
  };

  return (
    <ScrollArea ref={scrollRef} className="flex-1 pr-4">
      <div className="space-y-4 pb-4">
        {rounds.map((round) => (
          <div key={round.number}>
            <RoundHeader
              roundNumber={round.number}
              consensusResult={round.consensusResult}
              isCurrentRound={round.number === currentRound}
            />

            {/* Model A Turn */}
            {round.modelATurn ? (
              <MessageBubble
                role="model-a"
                displayName={getDisplayName('model-a')}
                content={round.modelATurn.content}
                turn={round.modelATurn}
              />
            ) : streamingTurn?.role === 'model-a' && round.number === currentRound ? (
              <MessageBubble
                role="model-a"
                displayName={getDisplayName('model-a')}
                content={streamingTurn.content}
                isStreaming
              />
            ) : isWaitingForTurn('model-a') && round.number === currentRound ? (
              <StreamingIndicator
                role="model-a"
                displayName={getDisplayName('model-a')}
                phase={serverPhase}
              />
            ) : null}

            {/* Model B Turn */}
            {round.modelBTurn ? (
              <div className="mt-4">
                <MessageBubble
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  content={round.modelBTurn.content}
                  turn={round.modelBTurn}
                />
              </div>
            ) : streamingTurn?.role === 'model-b' && round.number === currentRound ? (
              <div className="mt-4">
                <MessageBubble
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  content={streamingTurn.content}
                  isStreaming
                />
              </div>
            ) : isWaitingForTurn('model-b') && round.number === currentRound && round.modelATurn ? (
              <div className="mt-4">
                <StreamingIndicator
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  phase={serverPhase}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Auto-scroll on content change** | Keeps latest content visible without user intervention |
| **Conditional rendering logic** | Shows completed turn OR streaming content OR waiting indicator |
| **ScrollArea from shadcn** | Consistent scrollbar styling, touch-friendly |

---

### Step 4.17: Discussion Container (Main Orchestrator)

**File:** `src/components/discussion/discussion-container.tsx`

**Purpose:** Main component that orchestrates all discussion UI elements.

```typescript
'use client';

import { useDiscussion } from '@/hooks/use-discussion';
import { useAvailableModels } from '@/hooks/use-available-models';
import { ModelSelector } from './model-selector';
import { PromptInput } from './prompt-input';
import { MessageList } from './message-list';
import { ConsensusCard } from './consensus-card';
import { DiscussionControls } from './discussion-controls';
import { ErrorDisplay } from './error-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LAYOUT } from '@/config/ui-constants';

export function DiscussionContainer() {
  const {
    state,
    setPrompt,
    setModelA,
    setModelB,
    startDiscussion,
    abortDiscussion,
    resetDiscussion,
    canStart,
    isActive,
    isConnecting,
  } = useDiscussion();

  const { models, isLoading: modelsLoading } = useAvailableModels();

  // ============================================================================
  // Setup Phase UI
  // ============================================================================

  if (state.uiPhase === 'setup') {
    return (
      <div className={`${LAYOUT.containerPadding} ${LAYOUT.maxMessageWidth} mx-auto py-8`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">ralph-discuss</CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Select two AI models and enter a prompt. The models will discuss and
              collaborate to find the best solution.
            </p>
          </CardHeader>
          <CardContent className={LAYOUT.sectionGap}>
            {/* Model Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelsLoading ? (
                <>
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </>
              ) : (
                <>
                  <ModelSelector
                    label="Model A"
                    models={models}
                    selectedModel={state.modelA}
                    onSelect={setModelA}
                    excludeModelId={state.modelB?.modelId}
                  />
                  <ModelSelector
                    label="Model B"
                    models={models}
                    selectedModel={state.modelB}
                    onSelect={setModelB}
                    excludeModelId={state.modelA?.modelId}
                  />
                </>
              )}
            </div>

            {/* Prompt Input */}
            <PromptInput
              value={state.prompt}
              onChange={setPrompt}
              onSubmit={startDiscussion}
              canSubmit={canStart}
              isLoading={isConnecting}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Active/Completed Phase UI
  // ============================================================================

  return (
    <div className={`${LAYOUT.containerPadding} h-full flex flex-col py-4`}>
      {/* Header with prompt summary */}
      <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mb-4`}>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-medium text-gray-800 dark:text-gray-200">
                Discussion Topic
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {state.prompt}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{state.modelA?.displayName}</span>
              <span>vs</span>
              <span>{state.modelB?.displayName}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full`}>
          <ErrorDisplay
            error={state.error}
            onRetry={state.error.recoverable ? startDiscussion : undefined}
            onDismiss={resetDiscussion}
          />
        </div>
      )}

      {/* Message List */}
      {state.modelA && state.modelB && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full flex-1 min-h-0`}>
          <MessageList
            rounds={state.rounds}
            currentRound={state.currentRound}
            streamingTurn={state.streamingTurn}
            serverPhase={state.serverPhase}
            modelA={state.modelA}
            modelB={state.modelB}
          />
        </div>
      )}

      {/* Consensus Card */}
      {state.uiPhase === 'completed' && state.stoppingReason && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mt-4`}>
          <ConsensusCard
            solution={state.finalConsensus?.solution || getLastRoundSummary(state)}
            achievedAtRound={state.finalConsensus?.achievedAtRound || state.currentRound}
            stoppingReason={state.stoppingReason}
          />
        </div>
      )}

      {/* Controls */}
      <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mt-4`}>
        <DiscussionControls
          uiPhase={state.uiPhase}
          canStart={canStart}
          onStart={startDiscussion}
          onAbort={abortDiscussion}
          onReset={resetDiscussion}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getLastRoundSummary(state: { rounds: Array<{ modelATurn?: { content: string }; modelBTurn?: { content: string } }> }): string {
  const lastRound = state.rounds[state.rounds.length - 1];
  if (!lastRound) return 'No discussion content.';

  const lastTurn = lastRound.modelBTurn || lastRound.modelATurn;
  if (!lastTurn) return 'No discussion content.';

  // Return last 500 characters as summary
  const content = lastTurn.content;
  if (content.length <= 500) return content;
  return '...' + content.slice(-500);
}
```

---

### Step 4.18: Main Page

**File:** `src/app/page.tsx`

**Purpose:** Root page that renders the discussion interface.

```typescript
import { DiscussionContainer } from '@/components/discussion/discussion-container';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <DiscussionContainer />
    </main>
  );
}
```

---

### Step 4.19: Models API Route

**File:** `src/app/api/models/route.ts`

**Purpose:** Endpoint to fetch available models from all providers.

```typescript
import { NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/ai';
import type { ModelOption } from '@/lib/client/types';

export async function GET() {
  try {
    const models: ModelOption[] = [];
    const providers = providerRegistry.getAll();

    for (const [providerId, provider] of Object.entries(providers)) {
      try {
        const providerModels = await provider.listModels();

        for (const model of providerModels) {
          models.push({
            id: model.id,
            providerId: providerId as any,
            displayName: model.displayName || model.id,
            description: model.description,
          });
        }
      } catch (error) {
        // Skip providers that fail (e.g., missing API key)
        console.warn(`Failed to fetch models from ${providerId}:`, error);
      }
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
```

---

### Step 4.20: Global Styles (Animations)

**File:** `src/app/globals.css` (additions)

**Purpose:** Add custom animations for streaming indicators.

```css
/* Add to existing globals.css */

@layer utilities {
  /* Bouncing dots animation */
  @keyframes bounce {
    0%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-6px);
    }
  }

  /* Slow pulse for thinking states */
  .animate-pulse-slow {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  /* Fade in animation */
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Typing cursor blink */
  .animate-cursor {
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
}
```

---

## Files to Create Summary

| File | Type | Description |
|------|------|-------------|
| `src/config/ui-constants.ts` | Config | UI configuration constants |
| `src/lib/client/types.ts` | Types | Client-side type definitions |
| `src/lib/client/sse-client.ts` | Utility | SSE parsing and connection |
| `src/lib/client/discussion-api.ts` | Utility | API client for discussion endpoint |
| `src/hooks/use-available-models.ts` | Hook | Fetch available models |
| `src/hooks/use-sse-stream.ts` | Hook | SSE connection management |
| `src/hooks/use-discussion.ts` | Hook | Main state management |
| `src/components/discussion/model-selector.tsx` | Component | Model dropdown |
| `src/components/discussion/prompt-input.tsx` | Component | Prompt text area |
| `src/components/discussion/message-bubble.tsx` | Component | Message display |
| `src/components/discussion/streaming-indicator.tsx` | Component | Thinking indicator |
| `src/components/discussion/round-header.tsx` | Component | Round separator |
| `src/components/discussion/consensus-card.tsx` | Component | Final consensus display |
| `src/components/discussion/discussion-controls.tsx` | Component | Action buttons |
| `src/components/discussion/error-display.tsx` | Component | Error presentation |
| `src/components/discussion/message-list.tsx` | Component | Scrollable message list |
| `src/components/discussion/discussion-container.tsx` | Component | Main orchestrator |
| `src/app/page.tsx` | Page | Root page |
| `src/app/api/models/route.ts` | API Route | Models endpoint |
| `src/app/globals.css` | Styles | Custom animations (additions) |

**Total: 20 files**

---

## Key Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| **Reducer pattern for state** | Complex interdependent state; predictable updates; easy debugging |
| **Separate UIPhase from server phase** | UI needs states not tracked by server (setup, connecting) |
| **Manual SSE over EventSource** | POST requests with body not supported by native EventSource |
| **Streaming turn buffer** | Accumulate chunks visually before turn completion |
| **Role-based color coding** | Visual distinction between Model A (blue) and Model B (amber) |
| **Auto-scroll on content** | Keep latest content visible without user intervention |
| **Grouped model selector** | Easier navigation by provider, clear organization |
| **Cmd/Ctrl+Enter shortcut** | Power user efficiency, common pattern |
| **Fallback hardcoded models** | Graceful degradation if API fails |
| **Token usage display** | Transparency on resource consumption per turn |

---

## Verification Steps

### Manual Testing Checklist

| Category | Check |
|----------|-------|
| **Setup** | Model dropdowns populate correctly |
| **Setup** | Can select different models for A and B |
| **Setup** | Prompt validation (min/max length) works |
| **Setup** | Start button disabled until valid |
| **Streaming** | Connection establishes successfully |
| **Streaming** | Turn content streams character-by-character |
| **Streaming** | "Thinking" indicator shows before content |
| **Streaming** | Auto-scroll keeps latest content visible |
| **Display** | Model A messages on left (blue) |
| **Display** | Model B messages on right (amber) |
| **Display** | Round headers show between rounds |
| **Consensus** | Consensus card shows when complete |
| **Controls** | Stop button aborts discussion |
| **Controls** | New Discussion resets state |
| **Errors** | Error display shows with retry option |
| **Dark Mode** | All components render correctly |

### End-to-End Test Flow

1. Load page → Setup form visible
2. Select Model A (e.g., GPT-4o)
3. Select Model B (e.g., Claude Sonnet)
4. Enter prompt → Character counter updates
5. Press Cmd+Enter or click Start
6. Observe connecting state
7. Observe streaming content for Model A
8. Observe streaming content for Model B
9. Observe consensus check
10. If consensus → See ConsensusCard
11. If no consensus → See next round
12. Click Stop → Discussion aborts
13. Click New Discussion → Returns to setup

### Responsive Testing

- Mobile (< 640px): Single column layout
- Tablet (640px - 1024px): Model selectors side-by-side
- Desktop (> 1024px): Full layout with comfortable spacing

---

## Dependencies on Previous Steps

This step requires completion of:

1. **Step 1**: Project setup, shadcn/ui components installed
2. **Step 2**: AI provider layer (`@/lib/ai` exports)
3. **Step 3**: Discussion engine, SSE streaming (`@/lib/discussion` exports), API route

**Required shadcn/ui components:**
- button, card, textarea, select, badge, scroll-area, separator, avatar, skeleton, alert, progress

**Required from Step 3:**
- `DiscussionId`, `ParticipantRole`, `DiscussionPhase`, `StoppingReason`
- `Turn`, `ConsensusVote`, `ConsensusResult`
- `DiscussionError`, `DiscussionErrorCode`
- API route at `/api/discussion` with SSE streaming
