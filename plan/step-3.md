# Step 3: Conversation Engine - Detailed Implementation Plan

## Overview

The Conversation Engine is the core orchestration layer that manages turn-based discussions between two AI models. It coordinates message flow, maintains conversation state, handles consensus detection, and manages stopping conditions. This step builds upon the AI provider abstraction from Step 2.

---

## Architecture Overview

```
src/lib/discussion/
├── core/
│   ├── types.ts                  # Discussion-specific types
│   ├── constants.ts              # Protocol constants and prompts
│   └── errors.ts                 # Discussion error classes
├── engine/
│   ├── discussion-engine.ts      # Main orchestration engine
│   ├── turn-manager.ts           # Turn sequencing logic
│   ├── consensus-detector.ts     # Consensus evaluation logic
│   └── state-machine.ts          # Discussion state transitions
├── protocol/
│   ├── prompts.ts                # System prompts and templates
│   ├── message-builder.ts        # Construct messages for models
│   └── response-parser.ts        # Parse model responses
├── streaming/
│   ├── sse-emitter.ts            # Server-sent events helper
│   └── event-types.ts            # SSE event definitions
└── index.ts                      # Public API exports
```

---

## Implementation Steps

---

### Step 3.1: Core Types Definition

**File:** `src/lib/discussion/core/types.ts`

**Purpose:** Define all TypeScript interfaces for the discussion engine.

#### Key Types

| Type | Purpose |
|------|---------|
| `DiscussionId` | Branded string type for discussion identification |
| `ParticipantRole` | `'model-a' \| 'model-b'` |
| `DiscussionPhase` | State machine phases |
| `Turn` | Single turn with response and metadata |
| `Round` | Complete round (both models respond + consensus checks) |
| `ConsensusVote` | Individual model's consensus evaluation |
| `ConsensusResult` | Combined consensus outcome |
| `DiscussionConfig` | Configuration for starting a discussion |
| `DiscussionState` | Complete discussion state at any point |
| `DiscussionEvent` | Events emitted during discussion |
| `StoppingReason` | Why discussion ended |

#### Technical Decisions

- **Branded `DiscussionId` type**: Prevents accidental string usage, ensures type safety
- **Separate `Turn` and `Round` types**: Enables granular tracking - a Round contains two Turns plus consensus check
- **Comprehensive event types**: Enable rich streaming UI with 12 distinct event types
- **`ConsensusVote.confidence` (0-100)**: Nuanced agreement tracking beyond binary yes/no
- **`DEFAULT_DISCUSSION_OPTIONS`**: Sensible defaults with ability to override

#### Default Options

```typescript
export const DEFAULT_DISCUSSION_OPTIONS: DiscussionOptions = {
  maxIterations: 10,              // Maximum discussion rounds
  temperature: 0.7,               // Creativity vs consistency balance
  maxTokensPerTurn: 2048,         // Per-turn response limit
  turnTimeoutMs: 120000,          // 2 minutes per turn
  totalTimeoutMs: 1800000,        // 30 minutes total
  requireBothConsensus: true,     // Both models must agree
  minRoundsBeforeConsensus: 1,    // Prevent premature agreement
};
```

#### Implementation

```typescript
import type { ProviderId, NormalizedMessage, GenerationResponse } from '@/lib/ai';

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

// Individual event interfaces for each type (BaseDiscussionEvent, TurnStartedEvent, etc.)
// See full implementation in types.ts

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
```

---

### Step 3.2: Discussion Error Classes

**File:** `src/lib/discussion/core/errors.ts`

**Purpose:** Custom error classes for discussion-specific failures.

#### Error Classes

| Class | Error Code | Retryable | Use Case |
|-------|-----------|-----------|----------|
| `DiscussionEngineError` | (base class) | varies | Base for all discussion errors |
| `TurnTimeoutError` | `TURN_TIMEOUT` | Yes | Turn exceeded timeout |
| `ConsensusParseFailed` | `CONSENSUS_PARSE_FAILED` | Yes | Failed to parse consensus response |
| `StateTransitionError` | `STATE_INVALID` | No | Invalid state machine transition |

#### Technical Decisions

- All errors extend base `DiscussionEngineError` for consistent handling
- `toJSON()` method for easy serialization to SSE events
- `recoverable` property indicates if retry might succeed

#### Implementation

```typescript
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
```

---

### Step 3.3: Protocol Constants

**File:** `src/lib/discussion/core/constants.ts`

**Purpose:** Define the discussion protocol structure and immutable configuration.

#### Constants

```typescript
export const PROTOCOL = {
  // Markers for structured consensus responses
  CONSENSUS_MARKER: '[CONSENSUS_CHECK]',
  SOLUTION_MARKER: '[PROPOSED_SOLUTION]',
  REASONING_MARKER: '[REASONING]',
  CONFIDENCE_MARKER: '[CONFIDENCE]',

  // Retry configuration
  MAX_CONSENSUS_RETRIES: 2,

  // Turn structure
  INITIAL_TURN_ORDER: 'model-a' as const,
} as const;

export const ROLE_DESCRIPTIONS = {
  'model-a': 'You are Model A in this discussion.',
  'model-b': 'You are Model B in this discussion.',
} as const;
```

#### Technical Decisions

- **Structured markers**: Enable reliable regex-based parsing of consensus responses
- **MAX_CONSENSUS_RETRIES=2**: If model doesn't follow format, retry with explicit format reminder
- **Model A always starts**: Consistent, predictable flow

---

### Step 3.4: System Prompts

**File:** `src/lib/discussion/protocol/prompts.ts`

**Purpose:** System prompts and message templates that define model behavior.

#### Discussion System Prompt Structure

```typescript
export function buildDiscussionSystemPrompt(
  participant: Participant,
  otherParticipant: Participant,
  config: DiscussionConfig
): string {
  return `You are participating in a structured discussion with another AI model to find the optimal solution to a problem.

YOUR IDENTITY:
- You are ${participant.displayName} (${participant.role === 'model-a' ? 'Model A' : 'Model B'})
- Your partner is ${otherParticipant.displayName} (${participant.role === 'model-a' ? 'Model B' : 'Model A'})

DISCUSSION PROTOCOL:
1. The user has posed a problem or question
2. You and your partner will take turns responding
3. Build upon each other's ideas constructively
4. Identify strengths and potential improvements in each response
5. Work toward a solution you both agree is optimal

GUIDELINES:
- Be collaborative, not competitive
- Acknowledge good ideas from your partner
- Propose improvements constructively
- Focus on reaching the best solution, not "winning"
- Be concise but thorough (aim for 200-400 words per turn)
- If you largely agree with your partner's approach, say so and suggest refinements

THE PROBLEM TO SOLVE:
${config.prompt}`;
}
```

#### Consensus System Prompt Structure

```typescript
export function buildConsensusSystemPrompt(
  participant: Participant,
  config: DiscussionConfig
): string {
  return `You are ${participant.displayName} and have been discussing a problem with another AI model.

Your task now is to evaluate whether you and your partner have reached consensus on a solution.

THE ORIGINAL PROBLEM:
${config.prompt}

EVALUATION INSTRUCTIONS:
Review the entire discussion and determine:
1. Have you and your partner converged on a shared solution?
2. Are there still significant disagreements?
3. If consensus exists, what is the final solution?

RESPONSE FORMAT (follow exactly):
[CONSENSUS_CHECK]
HAS_CONSENSUS: [YES or NO]
[CONFIDENCE]
[Number from 0-100 indicating your confidence in this assessment]
[REASONING]
[Brief explanation of why you believe consensus has/has not been reached]
[PROPOSED_SOLUTION]
[If HAS_CONSENSUS is YES, state the agreed solution. If NO, write "No consensus yet."]

IMPORTANT: Only answer YES if you genuinely believe the discussion has converged on a solution that addresses the problem effectively.`;
}
```

#### Turn Message Builders

```typescript
export function buildInitialTurnMessage(role: ParticipantRole): string {
  if (role === 'model-a') {
    return `You are starting this discussion. Please provide your initial approach to solving the problem.`;
  } else {
    return `Your partner has provided their initial thoughts. Please respond with your perspective, noting where you agree, disagree, or would like to build upon their ideas.`;
  }
}

export function buildFollowUpTurnMessage(
  role: ParticipantRole,
  roundNumber: number
): string {
  return `Continue the discussion. Your partner has responded. Review their points and:
1. Acknowledge valid contributions
2. Address any concerns they raised
3. Propose refinements or new ideas if helpful
4. Work toward reaching agreement on the best solution

Round ${roundNumber}: Focus on converging toward a solution you both find satisfactory.`;
}

export function buildConsensusPrompt(roundNumber: number): string {
  return `After ${roundNumber} round(s) of discussion, please evaluate whether consensus has been reached. Follow the response format exactly.`;
}
```

#### Technical Decisions

- **Collaborative framing**: "partner" not "opponent" - prevents adversarial responses
- **Word count guidance**: 200-400 words balances depth vs. verbosity
- **Exact format instructions**: Structured markers for reliable parsing
- **Confidence requirement**: Distinguishes strong vs. weak agreement
- **Round number context**: Helps models gauge discussion progress

---

### Step 3.5: Response Parser

**File:** `src/lib/discussion/protocol/response-parser.ts`

**Purpose:** Parse structured responses from models, especially consensus evaluations.

#### Parsing Strategy

1. **Primary**: Regex extraction using structured markers
2. **Fallback**: Natural language inference when format not followed

#### Implementation

```typescript
import type { ConsensusVote, ParticipantRole } from '../core/types';
import { PROTOCOL } from '../core/constants';
import { ConsensusParseFailed } from '../core/errors';

export interface ParsedConsensusResponse {
  hasConsensus: boolean;
  confidence: number;
  reasoning: string;
  proposedSolution?: string;
}

export function parseConsensusResponse(
  response: string,
  role: ParticipantRole
): ParsedConsensusResponse {
  try {
    const normalized = response.trim();

    // Check for consensus marker
    if (!normalized.includes(PROTOCOL.CONSENSUS_MARKER)) {
      return inferConsensusFromResponse(normalized, role);
    }

    // Extract HAS_CONSENSUS (YES/NO)
    const hasConsensusMatch = normalized.match(/HAS_CONSENSUS:\s*(YES|NO)/i);
    if (!hasConsensusMatch) {
      return inferConsensusFromResponse(normalized, role);
    }
    const hasConsensus = hasConsensusMatch[1].toUpperCase() === 'YES';

    // Extract CONFIDENCE (0-100)
    let confidence = 50;
    const confidenceMatch = normalized.match(
      new RegExp(`${escapeRegex(PROTOCOL.CONFIDENCE_MARKER)}\\s*(\\d+)`, 'i')
    );
    if (confidenceMatch) {
      confidence = Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
    }

    // Extract REASONING
    let reasoning = '';
    const reasoningMatch = normalized.match(
      new RegExp(
        `${escapeRegex(PROTOCOL.REASONING_MARKER)}\\s*([\\s\\S]*?)(?=${escapeRegex(PROTOCOL.SOLUTION_MARKER)}|$)`,
        'i'
      )
    );
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    // Extract PROPOSED_SOLUTION
    let proposedSolution: string | undefined;
    const solutionMatch = normalized.match(
      new RegExp(`${escapeRegex(PROTOCOL.SOLUTION_MARKER)}\\s*([\\s\\S]*)$`, 'i')
    );
    if (solutionMatch) {
      const solution = solutionMatch[1].trim();
      if (solution && !solution.toLowerCase().includes('no consensus') && solution.length > 10) {
        proposedSolution = solution;
      }
    }

    return {
      hasConsensus,
      confidence,
      reasoning,
      proposedSolution: hasConsensus ? proposedSolution : undefined,
    };
  } catch (error) {
    throw new ConsensusParseFailed(role, response);
  }
}

function inferConsensusFromResponse(
  response: string,
  role: ParticipantRole
): ParsedConsensusResponse {
  const lowerResponse = response.toLowerCase();

  // Strong indicators of consensus
  const consensusIndicators = [
    'we have reached consensus',
    'i agree with',
    'we agree that',
    'consensus has been reached',
    'i concur',
    'the solution is',
    'our agreed solution',
  ];

  // Strong indicators of no consensus
  const noConsensusIndicators = [
    'i disagree',
    'we have not reached',
    'no consensus',
    'still need to discuss',
    'further discussion needed',
    'i think differently',
  ];

  const hasConsensusSignals = consensusIndicators.filter(i => lowerResponse.includes(i)).length;
  const noConsensusSignals = noConsensusIndicators.filter(i => lowerResponse.includes(i)).length;

  const hasConsensus = hasConsensusSignals > noConsensusSignals && hasConsensusSignals > 0;

  return {
    hasConsensus,
    confidence: Math.max(30, Math.min(70, 50 + (hasConsensusSignals - noConsensusSignals) * 10)),
    reasoning: 'Inferred from natural language response (structured format not detected)',
    proposedSolution: hasConsensus ? extractPotentialSolution(response) : undefined,
  };
}

function extractPotentialSolution(response: string): string | undefined {
  const solutionPatterns = [
    /the solution is[:\s]+([^.]+\.)/i,
    /we agree(?:d)? (?:on|that)[:\s]+([^.]+\.)/i,
    /our final answer is[:\s]+([^.]+\.)/i,
  ];

  for (const pattern of solutionPatterns) {
    const match = response.match(pattern);
    if (match && match[1].length > 20) {
      return match[1].trim();
    }
  }

  return undefined;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toConsensusVote(
  parsed: ParsedConsensusResponse,
  role: ParticipantRole
): ConsensusVote {
  return {
    role,
    hasConsensus: parsed.hasConsensus,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    proposedSolution: parsed.proposedSolution,
    timestamp: Date.now(),
  };
}
```

#### Technical Decisions

- **Two-tier parsing**: Structured first, fallback second for robustness
- **Confidence scoring on fallback**: 30-70 range when inferred (less certain)
- **ConsensusParseFailed error**: Thrown only after retries exhausted
- **Multiple extraction patterns**: Different ways models might express solutions

---

### Step 3.6: Message Builder

**File:** `src/lib/discussion/protocol/message-builder.ts`

**Purpose:** Construct normalized messages for the AI provider layer.

#### Functions

| Function | Purpose |
|----------|---------|
| `buildTurnMessages()` | Build messages for a discussion turn |
| `buildConsensusMessages()` | Build messages for consensus evaluation |
| `addTurnToHistory()` | Add completed turn to conversation history |

#### Message History Format

Turns are added to history with role labels:
```
[Model A] I propose we implement the API using RESTful design...
[Model B] I agree with the REST approach. Additionally, we should...
```

#### Implementation

```typescript
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
```

#### Technical Decisions

- **Role labels in content**: `[Model A]` / `[Model B]` prefixes help models understand conversation flow
- **Full history for consensus**: Both models see complete discussion when evaluating
- **Metadata preservation**: Timestamps and model info retained for debugging

---

### Step 3.7: State Machine

**File:** `src/lib/discussion/engine/state-machine.ts`

**Purpose:** Manage valid state transitions for the discussion.

#### State Flow Diagram

```
idle → initializing → model-a-turn → model-b-turn → consensus-check-a → consensus-check-b
                              ↑                                                    │
                              └────────────────────────────────────────────────────┘
                                               (if no consensus)
                                                      │
                                                      ↓
                                              completed (if consensus or max iterations)
```

#### Valid Transitions

```typescript
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
```

#### Implementation

```typescript
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
```

#### Technical Decisions

- **Explicit transition map**: Prevents invalid state changes, easy to reason about
- **Transition history**: Tracks all transitions with timestamps for debugging
- **Terminal states**: `completed`, `error`, `aborted` cannot transition except back to `idle`
- **`isActive()` helper**: Quick check if discussion is in progress

---

### Step 3.8: Turn Manager

**File:** `src/lib/discussion/engine/turn-manager.ts`

**Purpose:** Execute individual turns with streaming and timeout handling.

#### Execution Flow

1. Get provider for participant
2. Set up timeout timer
3. Build generation request with streaming options
4. Execute with retry wrapper (max 2 retries)
5. Stream chunks via callback
6. Build Turn object with metadata

#### Implementation

```typescript
import type {
  AIProvider,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  NormalizedMessage,
} from '@/lib/ai';
import { withRetry } from '@/lib/ai';
import type {
  Turn,
  ParticipantRole,
  Participant,
  DiscussionOptions,
} from '../core/types';
import { TurnTimeoutError } from '../core/errors';

export interface TurnExecutionContext {
  role: ParticipantRole;
  participant: Participant;
  roundNumber: number;
  systemPrompt: string;
  messages: NormalizedMessage[];
  options: DiscussionOptions;
  abortSignal?: AbortSignal;
}

export interface TurnResult {
  turn: Turn;
  response: GenerationResponse;
}

export type ChunkCallback = (chunk: string, role: ParticipantRole) => void;

export class TurnManager {
  constructor(
    private getProvider: (providerId: string) => AIProvider
  ) {}

  async executeTurn(
    context: TurnExecutionContext,
    onChunk?: ChunkCallback
  ): Promise<TurnResult> {
    const { role, participant, roundNumber, systemPrompt, messages, options, abortSignal } = context;

    const provider = this.getProvider(participant.providerId);
    const startTime = Date.now();
    let content = '';

    // Set up timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, options.turnTimeoutMs);

    // Combine signals if both exist
    const combinedSignal = abortSignal
      ? combineAbortSignals(abortSignal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const request: GenerationRequest = {
        modelId: participant.modelId,
        providerId: participant.providerId,
        messages,
        systemPrompt,
        temperature: options.temperature,
        maxTokens: options.maxTokensPerTurn,
        abortSignal: combinedSignal,
      };

      const streamOptions: StreamOptions = {
        onChunk: (chunk) => {
          content += chunk;
          onChunk?.(chunk, role);
        },
        onStart: () => {},
        onComplete: (fullText) => {
          content = fullText;
        },
        onError: (error) => {},
      };

      const response = await withRetry(
        () => provider.streamText(request, streamOptions),
        { maxRetries: 2, initialDelayMs: 1000 }
      );

      const turn: Turn = {
        id: `turn_${roundNumber}_${role}_${Date.now()}`,
        role,
        roundNumber,
        content: content || response.text,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        tokenUsage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
        },
        finishReason: response.finishReason,
      };

      return { turn, response };
    } catch (error) {
      if (timeoutController.signal.aborted && !abortSignal?.aborted) {
        throw new TurnTimeoutError(role, roundNumber, options.turnTimeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}
```

#### Technical Decisions

- **Combined AbortSignal**: Merges user abort + timeout abort for clean cancellation
- **Retry wrapper integration**: Uses `withRetry()` from AI layer for transient failures
- **Token usage tracking**: Captures prompt/completion tokens per turn
- **Streaming callback**: `onChunk(chunk, role)` enables real-time UI updates

---

### Step 3.9: Consensus Detector

**File:** `src/lib/discussion/engine/consensus-detector.ts`

**Purpose:** Orchestrate consensus checks for both models.

#### Consensus Check Flow

```
1. Check if minimum rounds completed
   └─ No → Return skipped votes

2. Get Model A's consensus vote
   └─ Parse response (with retry on parse failure)
   └─ Emit consensus_vote event

3. Get Model B's consensus vote
   └─ Parse response (with retry on parse failure)
   └─ Emit consensus_vote event

4. Determine if unanimous
   └─ requireBothConsensus=true: Both must vote YES
   └─ requireBothConsensus=false: Either voting YES is enough

5. If unanimous, extract final solution
   └─ Prefer higher-confidence vote's solution
```

#### Implementation

```typescript
import type { AIProvider, GenerationRequest, NormalizedMessage } from '@/lib/ai';
import { withRetry } from '@/lib/ai';
import type {
  ConsensusVote,
  ConsensusResult,
  ParticipantRole,
  Participant,
  DiscussionOptions,
  DiscussionConfig,
} from '../core/types';
import { parseConsensusResponse, toConsensusVote } from '../protocol/response-parser';
import { buildConsensusMessages } from '../protocol/message-builder';
import { PROTOCOL } from '../core/constants';
import { ConsensusParseFailed } from '../core/errors';

export interface ConsensusContext {
  config: DiscussionConfig;
  conversationHistory: NormalizedMessage[];
  currentRound: number;
  options: DiscussionOptions;
  abortSignal?: AbortSignal;
}

export type ConsensusVoteCallback = (vote: ConsensusVote) => void;

export class ConsensusDetector {
  constructor(
    private getProvider: (providerId: string) => AIProvider
  ) {}

  async checkConsensus(
    context: ConsensusContext,
    onVote?: ConsensusVoteCallback
  ): Promise<ConsensusResult> {
    const { config, conversationHistory, currentRound, options, abortSignal } = context;

    // Check if we've completed minimum rounds
    if (currentRound < options.minRoundsBeforeConsensus) {
      return {
        isUnanimous: false,
        modelAVote: this.createSkippedVote('model-a', 'Minimum rounds not yet completed'),
        modelBVote: this.createSkippedVote('model-b', 'Minimum rounds not yet completed'),
        roundNumber: currentRound,
      };
    }

    // Get consensus vote from Model A
    const modelAVote = await this.getConsensusVote(
      'model-a',
      config.participants.modelA,
      { config, conversationHistory, currentRound },
      options,
      abortSignal
    );
    onVote?.(modelAVote);

    // Get consensus vote from Model B
    const modelBVote = await this.getConsensusVote(
      'model-b',
      config.participants.modelB,
      { config, conversationHistory, currentRound },
      options,
      abortSignal
    );
    onVote?.(modelBVote);

    // Determine if consensus is reached
    const isUnanimous = options.requireBothConsensus
      ? modelAVote.hasConsensus && modelBVote.hasConsensus
      : modelAVote.hasConsensus || modelBVote.hasConsensus;

    // If unanimous, determine final solution
    let finalSolution: string | undefined;
    if (isUnanimous) {
      finalSolution = this.determineFinalSolution(modelAVote, modelBVote);
    }

    return {
      isUnanimous,
      modelAVote,
      modelBVote,
      finalSolution,
      roundNumber: currentRound,
    };
  }

  private async getConsensusVote(
    role: ParticipantRole,
    participant: Participant,
    messageContext: { config: DiscussionConfig; conversationHistory: NormalizedMessage[]; currentRound: number },
    options: DiscussionOptions,
    abortSignal?: AbortSignal
  ): Promise<ConsensusVote> {
    const provider = this.getProvider(participant.providerId);
    const { systemPrompt, messages } = buildConsensusMessages(role, messageContext);

    let attempts = 0;
    let lastError: unknown;

    while (attempts <= PROTOCOL.MAX_CONSENSUS_RETRIES) {
      try {
        const request: GenerationRequest = {
          modelId: participant.modelId,
          providerId: participant.providerId,
          messages,
          systemPrompt,
          temperature: 0.3, // Lower temperature for consistent evaluation
          maxTokens: 1024,
          abortSignal,
        };

        const response = await withRetry(
          () => provider.generateText(request),
          { maxRetries: 1 }
        );

        const parsed = parseConsensusResponse(response.text, role);
        return toConsensusVote(parsed, role);
      } catch (error) {
        lastError = error;
        attempts++;

        if (error instanceof ConsensusParseFailed && attempts <= PROTOCOL.MAX_CONSENSUS_RETRIES) {
          messages.push({
            role: 'user',
            content: 'Please provide your response in the exact structured format requested, starting with [CONSENSUS_CHECK].',
          });
          continue;
        }

        break;
      }
    }

    // If all retries failed, return uncertain vote
    return {
      role,
      hasConsensus: false,
      confidence: 0,
      reasoning: `Failed to obtain valid consensus response: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
      timestamp: Date.now(),
    };
  }

  private createSkippedVote(role: ParticipantRole, reason: string): ConsensusVote {
    return {
      role,
      hasConsensus: false,
      confidence: 0,
      reasoning: reason,
      timestamp: Date.now(),
    };
  }

  private determineFinalSolution(voteA: ConsensusVote, voteB: ConsensusVote): string {
    if (voteA.proposedSolution && voteB.proposedSolution) {
      return voteA.confidence >= voteB.confidence
        ? voteA.proposedSolution
        : voteB.proposedSolution;
    }

    return voteA.proposedSolution || voteB.proposedSolution || 'Consensus reached but solution text not extracted.';
  }
}
```

#### Technical Decisions

- **Sequential voting**: A then B (not parallel) for cleaner event flow
- **Lower temperature (0.3)**: More consistent evaluation responses
- **Retry on parse failure**: Prompt model to use structured format
- **Minimum rounds check**: Prevents consensus on first turn (models haven't truly discussed)
- **Confidence-based solution selection**: Higher-confidence vote's solution preferred

---

### Step 3.10: Main Discussion Engine

**File:** `src/lib/discussion/engine/discussion-engine.ts`

**Purpose:** Main orchestration class that ties all components together.

#### Public API

```typescript
class DiscussionEngine {
  // Start a new discussion
  async start(config: DiscussionConfig): Promise<void>

  // Abort an in-progress discussion
  abort(): void

  // Get current state snapshot
  getState(): DiscussionState

  // Subscribe to events
  onEvent(handler: EventHandler): () => void
}
```

#### Core Discussion Loop

```typescript
private async runDiscussion(): Promise<void> {
  const options = this.state.config.options;

  while (this.state.currentRound <= options.maxIterations) {
    if (this.abortController?.signal.aborted) break;

    // Start new round
    this.state.currentRound++;
    this.emitEvent({ type: 'round_started', roundNumber: this.state.currentRound, ... });

    // Model A turn
    const turnA = await this.executeTurn('model-a');
    if (!turnA || this.abortController?.signal.aborted) break;

    // Model B turn
    const turnB = await this.executeTurn('model-b');
    if (!turnB || this.abortController?.signal.aborted) break;

    // Create round record
    const round: Round = {
      number: this.state.currentRound,
      modelATurn: turnA,
      modelBTurn: turnB,
    };

    // Check for consensus
    const consensusResult = await this.checkConsensus();
    round.consensusCheck = consensusResult;
    this.state.rounds.push(round);

    this.emitEvent({ type: 'round_completed', round, ... });

    // Stop if consensus reached
    if (consensusResult.isUnanimous) {
      this.completeDiscussion('consensus_reached', consensusResult);
      return;
    }
  }

  // Max iterations reached
  if (!this.stateMachine.isTerminal()) {
    this.completeDiscussion('max_iterations');
  }
}
```

#### Technical Decisions

- **Event-driven architecture**: Decouples engine from transport layer (SSE, WebSocket, etc.)
- **AbortController integration**: Clean cancellation through entire call stack
- **Total timeout**: Defense in depth against hanging discussions
- **Token usage aggregation**: Track costs per model across all turns

---

### Step 3.11: SSE Streaming

**File:** `src/lib/discussion/streaming/event-types.ts`

#### SSE Event Format

```typescript
export interface SSEEvent {
  event: string;
  data: string; // JSON stringified
}

export function toSSEEvent(event: DiscussionEvent): SSEEvent {
  const eventType = event.type.replace(/_/g, '-'); // discussion_started -> discussion-started

  const data = {
    discussionId: event.discussionId,
    timestamp: event.timestamp,
    // ... event-specific data based on event.type
  };

  return {
    event: eventType,
    data: JSON.stringify(data),
  };
}

export function formatSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${event.data}\n\n`;
}
```

**File:** `src/lib/discussion/streaming/sse-emitter.ts`

#### SSE Emitter

```typescript
export class SSEEmitter {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private closed = false;

  static create(): { stream: ReadableStream<Uint8Array>; emitter: SSEEmitter } {
    let emitter: SSEEmitter;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        emitter = new SSEEmitter(stream);
        (emitter as any).controller = controller;
      },
      cancel: () => {
        emitter?.close();
      },
    });

    return { stream, emitter: emitter! };
  }

  emit(event: DiscussionEvent): void {
    if (this.closed || !this.controller) return;

    const sseEvent = toSSEEvent(event);
    const formatted = formatSSE(sseEvent);

    try {
      this.controller.enqueue(this.encoder.encode(formatted));
    } catch (error) {
      this.closed = true;
    }
  }

  emitComment(comment: string): void {
    if (this.closed || !this.controller) return;
    try {
      this.controller.enqueue(this.encoder.encode(`: ${comment}\n\n`));
    } catch {
      this.closed = true;
    }
  }

  emitKeepAlive(): void {
    this.emitComment('keep-alive');
  }

  close(): void {
    if (this.closed || !this.controller) return;
    try {
      this.controller.close();
    } catch {}
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}
```

#### Technical Decisions

- **Hyphenated event names**: `discussion-started` is more standard for SSE
- **JSON data payload**: All event data JSON stringified for easy client parsing
- **Keep-alive support**: Prevents connection timeout on slow responses
- **ReadableStream API**: Compatible with Next.js streaming responses

---

### Step 3.12: Public API Exports

**File:** `src/lib/discussion/index.ts`

**Purpose:** Clean public API for the discussion module.

```typescript
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
} from './core/types';

export { DEFAULT_DISCUSSION_OPTIONS, createDiscussionId } from './core/types';

// Errors
export {
  DiscussionEngineError,
  TurnTimeoutError,
  ConsensusParseFailed,
  StateTransitionError,
} from './core/errors';

// Engine
export { DiscussionEngine, type EventHandler } from './engine/discussion-engine';
export { DiscussionStateMachine } from './engine/state-machine';

// Streaming
export { SSEEmitter } from './streaming/sse-emitter';
export { toSSEEvent, formatSSE } from './streaming/event-types';

// Protocol (for customization/testing)
export {
  buildDiscussionSystemPrompt,
  buildConsensusSystemPrompt,
} from './protocol/prompts';
```

---

### Step 3.13: API Route Integration

**File:** `src/app/api/discussion/route.ts`

**Purpose:** HTTP endpoint that uses the discussion engine with SSE streaming.

#### Request Body

```typescript
interface StartDiscussionBody {
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
```

#### Implementation

```typescript
import { NextRequest } from 'next/server';
import {
  DiscussionEngine,
  SSEEmitter,
  type DiscussionConfig,
  type DiscussionOptions,
  DEFAULT_DISCUSSION_OPTIONS,
} from '@/lib/discussion';
import { providerRegistry, type ProviderId } from '@/lib/ai';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: StartDiscussionBody = await request.json();

    // Validate required fields
    if (!body.prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.modelA?.modelId || !body.modelB?.modelId) {
      return new Response(JSON.stringify({ error: 'Both models must be specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate providers are available
    try {
      providerRegistry.get(body.modelA.providerId);
      providerRegistry.get(body.modelB.providerId);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Provider not available' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build config
    const config: DiscussionConfig = {
      prompt: body.prompt.trim(),
      participants: {
        modelA: {
          role: 'model-a',
          modelId: body.modelA.modelId,
          providerId: body.modelA.providerId,
          displayName: body.modelA.displayName || body.modelA.modelId,
        },
        modelB: {
          role: 'model-b',
          modelId: body.modelB.modelId,
          providerId: body.modelB.providerId,
          displayName: body.modelB.displayName || body.modelB.modelId,
        },
      },
      options: {
        ...DEFAULT_DISCUSSION_OPTIONS,
        ...body.options,
      },
    };

    // Create SSE stream
    const { stream, emitter } = SSEEmitter.create();

    // Create and start discussion engine
    const engine = new DiscussionEngine();

    // Wire up event handler
    const unsubscribe = engine.onEvent((event) => {
      emitter.emit(event);

      // Close stream when discussion ends
      if (
        event.type === 'discussion_completed' ||
        event.type === 'discussion_error' ||
        event.type === 'discussion_aborted'
      ) {
        setTimeout(() => emitter.close(), 100);
      }
    });

    // Start discussion in background
    engine.start(config).catch((error) => {
      console.error('Discussion engine error:', error);
      emitter.close();
    });

    // Handle client disconnect
    request.signal.addEventListener('abort', () => {
      engine.abort();
      unsubscribe();
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

#### Response

SSE stream with events:
```
event: discussion-started
data: {"discussionId":"disc_123...","timestamp":1234567890,"prompt":"..."}

event: round-started
data: {"discussionId":"disc_123...","roundNumber":1}

event: turn-started
data: {"discussionId":"disc_123...","role":"model-a","modelId":"gpt-4o"}

event: turn-chunk
data: {"discussionId":"disc_123...","role":"model-a","chunk":"I propose"}

event: turn-chunk
data: {"discussionId":"disc_123...","role":"model-a","chunk":" we use"}

event: turn-completed
data: {"discussionId":"disc_123...","turn":{...}}

... (more events)

event: discussion-completed
data: {"discussionId":"disc_123...","stoppingReason":"consensus_reached","finalConsensus":{...}}
```

#### Technical Decisions

- **POST for starting**: Request body contains full configuration
- **Client disconnect handling**: `request.signal.addEventListener('abort', ...)` triggers engine abort
- **X-Accel-Buffering header**: Disables nginx buffering for real-time streaming

---

## Files to Create Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/discussion/core/types.ts` | Create | All TypeScript interfaces |
| `src/lib/discussion/core/errors.ts` | Create | Custom error classes |
| `src/lib/discussion/core/constants.ts` | Create | Protocol constants |
| `src/lib/discussion/engine/discussion-engine.ts` | Create | Main orchestration |
| `src/lib/discussion/engine/turn-manager.ts` | Create | Turn execution |
| `src/lib/discussion/engine/consensus-detector.ts` | Create | Consensus logic |
| `src/lib/discussion/engine/state-machine.ts` | Create | State transitions |
| `src/lib/discussion/protocol/prompts.ts` | Create | System prompts |
| `src/lib/discussion/protocol/message-builder.ts` | Create | Message construction |
| `src/lib/discussion/protocol/response-parser.ts` | Create | Response parsing |
| `src/lib/discussion/streaming/sse-emitter.ts` | Create | SSE helper |
| `src/lib/discussion/streaming/event-types.ts` | Create | SSE event formats |
| `src/lib/discussion/index.ts` | Create | Public exports |
| `src/app/api/discussion/route.ts` | Create | HTTP endpoint |

---

## Key Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| State machine for phase management | Prevents invalid transitions, clear flow control |
| Structured consensus markers | Reliable parsing even with varied LLM outputs |
| Fallback natural language inference | Robustness when models don't follow format |
| Confidence scoring (0-100) | Nuanced agreement beyond binary yes/no |
| Separate TurnManager/ConsensusDetector | Single responsibility, testable components |
| SSE for streaming | Standard protocol, works through proxies, resumable |
| Event-driven architecture | Decouples engine from transport layer |
| AbortController integration | Clean cancellation through entire call stack |
| Minimum rounds before consensus | Prevents premature agreement on first turn |
| Per-turn + total timeouts | Defense in depth against hanging |
| Collaborative prompt framing | "Partner" not "opponent" prevents adversarial behavior |
| Role labels in history | `[Model A]`/`[Model B]` helps models track conversation |

---

## Verification Steps

### Unit Tests

Create `src/lib/discussion/__tests__/`:
- `state-machine.test.ts` - Test valid/invalid transitions
- `response-parser.test.ts` - Test structured and fallback parsing
- `message-builder.test.ts` - Test prompt construction
- `event-types.test.ts` - Test SSE serialization

### Integration Tests

- Test full discussion flow with mock providers
- Test abort handling mid-discussion
- Test timeout handling
- Test consensus detection with various response formats

### Manual Verification Checklist

| Category | Check |
|----------|-------|
| **Engine** | Discussion starts and emits `discussion_started` |
| **Engine** | Turns alternate correctly (A then B) |
| **Engine** | Turn chunks stream in real-time |
| **Consensus** | Consensus check runs after each round |
| **Consensus** | Structured format parsed correctly |
| **Consensus** | Fallback parsing works when format not followed |
| **Stopping** | Stops when both vote YES |
| **Stopping** | Stops at max iterations |
| **Stopping** | User abort works (client disconnect) |
| **API** | SSE events stream correctly |
| **API** | Client disconnect triggers abort |
| **Errors** | Provider errors handled gracefully |
| **Errors** | Timeout errors handled gracefully |

### End-to-End Test

```bash
# Start discussion via curl
curl -X POST http://localhost:3000/api/discussion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the best programming language for web development?",
    "modelA": { "modelId": "gpt-4o", "providerId": "openai" },
    "modelB": { "modelId": "claude-sonnet-4-20250514", "providerId": "anthropic" }
  }'

# Observe SSE events streaming
# Verify consensus reached or max iterations
# Verify final solution extracted
```
