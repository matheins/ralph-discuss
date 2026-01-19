# Step 6: Verification - Detailed Implementation Plan

## Overview

The Verification step ensures the ralph-discuss application functions correctly through comprehensive testing at multiple levels: unit tests, integration tests, and end-to-end tests. This step validates that models can reach consensus, error handling works properly, and the complete user flow operates as expected.

---

## Architecture Overview

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── ai/
│   │   │   ├── providers.test.ts           # Provider abstraction tests
│   │   │   ├── rate-limiter.test.ts        # Token bucket algorithm tests
│   │   │   ├── retry.test.ts               # Retry logic tests
│   │   │   └── message-normalizer.test.ts  # Message normalization tests
│   │   ├── discussion/
│   │   │   ├── state-machine.test.ts       # State transition tests
│   │   │   ├── response-parser.test.ts     # Consensus parsing tests
│   │   │   ├── message-builder.test.ts     # Prompt construction tests
│   │   │   ├── turn-manager.test.ts        # Turn execution tests
│   │   │   └── consensus-detector.test.ts  # Consensus logic tests
│   │   ├── config/
│   │   │   ├── schema.test.ts              # Zod validation tests
│   │   │   ├── env.test.ts                 # Environment helper tests
│   │   │   └── defaults.test.ts            # Default values tests
│   │   └── client/
│   │       ├── sse-client.test.ts          # SSE parsing tests
│   │       └── discussion-api.test.ts      # API client validation tests
│   ├── integration/
│   │   ├── discussion-engine.test.ts       # Full engine flow with mocks
│   │   ├── api-routes.test.ts              # API endpoint integration
│   │   └── provider-integration.test.ts    # Real provider tests (skip in CI)
│   └── e2e/
│       ├── setup.ts                        # Playwright configuration
│       ├── discussion-flow.spec.ts         # Complete user journey
│       ├── error-handling.spec.ts          # Error scenarios
│       └── consensus-scenarios.spec.ts     # Various consensus outcomes
├── test-utils/
│   ├── mocks/
│   │   ├── providers.ts                    # Mock AI provider implementations
│   │   ├── sse-server.ts                   # Mock SSE server
│   │   └── responses.ts                    # Sample AI responses
│   ├── fixtures/
│   │   ├── sample-prompts.ts               # Test prompts categorized by type
│   │   ├── consensus-responses.ts          # Sample consensus format responses
│   │   └── discussion-states.ts            # Pre-built discussion states
│   └── helpers/
│       ├── test-setup.ts                   # Common test setup utilities
│       ├── wait-for.ts                     # Async wait helpers
│       └── assertions.ts                   # Custom assertion helpers
└── scripts/
    ├── run-tests.sh                        # Test runner script
    └── test-with-real-providers.sh         # Manual integration test script
```

---

## Implementation Steps

---

### Step 6.1: Test Infrastructure Setup

**Files to Create/Modify:**
- `jest.config.js` (modify)
- `playwright.config.ts` (create)
- `package.json` (add test scripts)

**Purpose:** Configure testing frameworks and add necessary dependencies.

#### Jest Configuration Updates

```javascript
// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/src/__tests__/e2e/', // Playwright handles e2e
  ],
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

#### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

#### Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e"
  }
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Jest for unit/integration** | Native Next.js support, fast, good TypeScript integration |
| **Playwright for e2e** | Modern, reliable, excellent debugging, cross-browser |
| **70% coverage threshold** | Reasonable baseline, enforced in CI |
| **Separate test commands** | Run specific test suites as needed |

---

### Step 6.2: Mock Providers

**File:** `src/test-utils/mocks/providers.ts`

**Purpose:** Create mock AI provider implementations for testing without API calls.

```typescript
import type {
  AIProvider,
  GenerationRequest,
  GenerationResponse,
  StreamOptions,
  ModelInfo,
} from '@/lib/ai';

// ============================================================================
// Configurable Mock Provider
// ============================================================================

export interface MockProviderConfig {
  providerId: string;
  defaultResponse?: string;
  responseDelay?: number;
  shouldFail?: boolean;
  failureMessage?: string;
  streamChunkSize?: number;
}

export class MockAIProvider implements AIProvider {
  private config: MockProviderConfig;
  private callCount = 0;
  private lastRequest: GenerationRequest | null = null;
  private responseQueue: string[] = [];

  constructor(config: MockProviderConfig) {
    this.config = {
      defaultResponse: 'This is a mock response.',
      responseDelay: 10,
      shouldFail: false,
      streamChunkSize: 10,
      ...config,
    };
  }

  // Queue specific responses for sequential calls
  queueResponse(response: string): void {
    this.responseQueue.push(response);
  }

  queueResponses(responses: string[]): void {
    this.responseQueue.push(...responses);
  }

  getCallCount(): number {
    return this.callCount;
  }

  getLastRequest(): GenerationRequest | null {
    return this.lastRequest;
  }

  reset(): void {
    this.callCount = 0;
    this.lastRequest = null;
    this.responseQueue = [];
  }

  setConfig(updates: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  async generateText(request: GenerationRequest): Promise<GenerationResponse> {
    this.callCount++;
    this.lastRequest = request;

    await this.delay();

    if (this.config.shouldFail) {
      throw new Error(this.config.failureMessage || 'Mock provider error');
    }

    const responseText = this.responseQueue.shift() ?? this.config.defaultResponse!;

    return {
      text: responseText,
      usage: {
        promptTokens: this.estimateTokens(this.getMessagesContent(request.messages)),
        completionTokens: this.estimateTokens(responseText),
        totalTokens: 0, // Calculated below
      },
      finishReason: 'stop',
      metadata: {
        modelId: request.modelId,
        providerId: this.config.providerId,
      },
    };
  }

  async streamText(
    request: GenerationRequest,
    options: StreamOptions
  ): Promise<GenerationResponse> {
    this.callCount++;
    this.lastRequest = request;

    if (this.config.shouldFail) {
      options.onError?.(new Error(this.config.failureMessage || 'Mock provider error'));
      throw new Error(this.config.failureMessage || 'Mock provider error');
    }

    const responseText = this.responseQueue.shift() ?? this.config.defaultResponse!;

    options.onStart?.();

    // Stream in chunks
    const chunkSize = this.config.streamChunkSize!;
    for (let i = 0; i < responseText.length; i += chunkSize) {
      await this.delay();
      const chunk = responseText.slice(i, i + chunkSize);
      options.onChunk?.(chunk);
    }

    options.onComplete?.(responseText);

    return {
      text: responseText,
      usage: {
        promptTokens: this.estimateTokens(this.getMessagesContent(request.messages)),
        completionTokens: this.estimateTokens(responseText),
        totalTokens: 0,
      },
      finishReason: 'stop',
      metadata: {
        modelId: request.modelId,
        providerId: this.config.providerId,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'mock-model-1',
        displayName: 'Mock Model 1',
        description: 'A mock model for testing',
        contextWindow: 8192,
        maxOutputTokens: 4096,
      },
      {
        id: 'mock-model-2',
        displayName: 'Mock Model 2',
        description: 'Another mock model',
        contextWindow: 16384,
        maxOutputTokens: 8192,
      },
    ];
  }

  isAvailable(): boolean {
    return !this.config.shouldFail;
  }

  private async delay(): Promise<void> {
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.responseDelay));
    }
  }

  private getMessagesContent(messages: GenerationRequest['messages']): string {
    return messages.map((m) => m.content).join(' ');
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

// ============================================================================
// Pre-configured Mock Providers
// ============================================================================

export function createMockOpenAI(overrides?: Partial<MockProviderConfig>): MockAIProvider {
  return new MockAIProvider({
    providerId: 'openai',
    defaultResponse: 'Mock OpenAI response',
    ...overrides,
  });
}

export function createMockAnthropic(overrides?: Partial<MockProviderConfig>): MockAIProvider {
  return new MockAIProvider({
    providerId: 'anthropic',
    defaultResponse: 'Mock Anthropic response',
    ...overrides,
  });
}

export function createFailingProvider(
  providerId: string,
  errorMessage: string
): MockAIProvider {
  return new MockAIProvider({
    providerId,
    shouldFail: true,
    failureMessage: errorMessage,
  });
}
```

#### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **Response queue** | Test sequential responses in multi-turn scenarios |
| **Configurable delays** | Test timing-sensitive code without real API latency |
| **Call tracking** | Verify correct number of API calls made |
| **Chunk streaming** | Simulate real streaming behavior |

---

### Step 6.3: Sample Test Prompts

**File:** `src/test-utils/fixtures/sample-prompts.ts`

**Purpose:** Categorized test prompts for different testing scenarios.

```typescript
// ============================================================================
// Test Prompts by Category
// ============================================================================

export const TEST_PROMPTS = {
  // Simple problems that should reach consensus quickly
  simpleConsensus: [
    {
      id: 'simple-1',
      prompt: 'What is 2 + 2?',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 1,
      description: 'Trivial math problem',
    },
    {
      id: 'simple-2',
      prompt: 'What is the capital of France?',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 1,
      description: 'Simple factual question',
    },
    {
      id: 'simple-3',
      prompt: 'Is water wet?',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 2,
      description: 'Simple yes/no question',
    },
  ],

  // Complex problems requiring discussion
  complexDiscussion: [
    {
      id: 'complex-1',
      prompt: 'Design a REST API for a social media platform. Consider scalability, security, and user experience.',
      expectedOutcome: 'consensus_or_max_iterations',
      maxRoundsExpected: 5,
      description: 'Open-ended design problem',
    },
    {
      id: 'complex-2',
      prompt: 'What is the best approach to handle state management in a large React application? Compare Redux, Context API, and Zustand.',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 4,
      description: 'Technical comparison with trade-offs',
    },
    {
      id: 'complex-3',
      prompt: 'How should a startup prioritize between feature development and technical debt reduction?',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 5,
      description: 'Strategic decision with nuance',
    },
  ],

  // Problems that may not reach consensus
  controversialTopics: [
    {
      id: 'controversial-1',
      prompt: 'Is it ethical to use AI-generated art in commercial products?',
      expectedOutcome: 'may_not_reach_consensus',
      maxRoundsExpected: 10,
      description: 'Ethical dilemma with valid opposing views',
    },
  ],

  // Edge cases for testing
  edgeCases: [
    {
      id: 'edge-1',
      prompt: 'a',
      expectedOutcome: 'validation_error',
      description: 'Too short prompt',
    },
    {
      id: 'edge-2',
      prompt: 'X'.repeat(15000),
      expectedOutcome: 'validation_error',
      description: 'Too long prompt',
    },
    {
      id: 'edge-3',
      prompt: '   ',
      expectedOutcome: 'validation_error',
      description: 'Whitespace-only prompt',
    },
    {
      id: 'edge-4',
      prompt: 'Reply with exactly: "I agree completely."',
      expectedOutcome: 'consensus',
      maxRoundsExpected: 1,
      description: 'Prompt that forces agreement',
    },
  ],

  // Prompts for error handling tests
  errorScenarios: [
    {
      id: 'error-timeout',
      prompt: 'Write a 10,000 word essay on the history of computing.',
      expectedOutcome: 'timeout_possible',
      description: 'Long response may timeout',
    },
  ],
} as const;

// ============================================================================
// Sample Consensus Responses
// ============================================================================

export const CONSENSUS_RESPONSE_TEMPLATES = {
  // Properly formatted consensus response (YES)
  structuredYes: `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]
85
[REASONING]
Both Model A and Model B have converged on the same solution. The key points of agreement are:
1. The approach is technically sound
2. The implementation details have been worked out
3. Both parties acknowledge the trade-offs
[PROPOSED_SOLUTION]
The agreed solution is to implement the feature using a modular approach with clear separation of concerns. Specifically:
- Use a provider pattern for extensibility
- Implement caching at the service layer
- Add comprehensive error handling`,

  // Properly formatted consensus response (NO)
  structuredNo: `[CONSENSUS_CHECK]
HAS_CONSENSUS: NO
[CONFIDENCE]
70
[REASONING]
While there is agreement on the general direction, key differences remain:
1. Model A prefers approach X while Model B prefers approach Y
2. The performance implications have not been fully addressed
3. Further discussion is needed on edge cases
[PROPOSED_SOLUTION]
No consensus yet.`,

  // Natural language consensus (fallback parsing)
  naturalLanguageYes: `After reviewing the discussion, I believe we have reached consensus.
I agree with my partner's assessment that the solution should focus on simplicity and maintainability.
The solution is to implement a clean API with proper validation and error handling.`,

  // Natural language no consensus (fallback parsing)
  naturalLanguageNo: `I disagree with some of the points raised. While we have made progress,
there are still significant differences in our approaches that need to be resolved.
Further discussion is needed before we can reach a final agreement.`,

  // Ambiguous response (tests fallback robustness)
  ambiguous: `The discussion has been productive. There are some points of agreement
and some points where we differ. Overall, the approach seems reasonable but
I would like to see more details before fully committing to a conclusion.`,
};

// ============================================================================
// Sample Turn Responses
// ============================================================================

export const TURN_RESPONSE_TEMPLATES = {
  initialProposal: `I'll propose an approach to solve this problem:

1. **Analysis**: First, we need to understand the core requirements.
2. **Design**: Based on the analysis, I suggest the following architecture...
3. **Implementation**: The key steps would be...
4. **Trade-offs**: This approach has the following pros and cons...

I look forward to hearing your thoughts on this proposal.`,

  constructiveResponse: `Thank you for your proposal. I largely agree with your analysis.

**Points of Agreement:**
- Your architecture is sound
- The implementation steps make sense

**Suggested Improvements:**
- Consider adding caching for better performance
- We might want to handle edge case X differently

**Alternative Consideration:**
Have you considered approach Y? It might offer better scalability.

Overall, I think we're moving in the right direction.`,

  refinementResponse: `I appreciate your feedback and suggestions.

**Incorporating Your Ideas:**
- Caching is a great addition - let's use Redis
- For edge case X, I agree with your alternative approach

**Addressing the Alternative:**
Approach Y is interesting, but I believe our current direction better suits
the requirements because of reason Z.

**Proposed Final Solution:**
Given our discussion, I propose we finalize with:
1. Original architecture + caching layer
2. Modified edge case handling per your suggestion
3. Keep the current approach over Y for now

Are you satisfied with this direction?`,
};

export type TestPrompt = typeof TEST_PROMPTS.simpleConsensus[number];
```

---

### Step 6.4: Unit Tests - State Machine

**File:** `src/__tests__/unit/discussion/state-machine.test.ts`

**Purpose:** Test all state transitions in the discussion state machine.

```typescript
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

    it('allows transition to error from most states', () => {
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
```

---

### Step 6.5: Unit Tests - Response Parser

**File:** `src/__tests__/unit/discussion/response-parser.test.ts`

**Purpose:** Test consensus response parsing with both structured and natural language formats.

```typescript
import {
  parseConsensusResponse,
  toConsensusVote,
} from '@/lib/discussion/protocol/response-parser';
import { ConsensusParseFailed } from '@/lib/discussion/core/errors';
import { CONSENSUS_RESPONSE_TEMPLATES } from '@/test-utils/fixtures/sample-prompts';

describe('parseConsensusResponse', () => {
  describe('structured format parsing', () => {
    it('parses YES consensus correctly', () => {
      const result = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
        'model-a'
      );

      expect(result.hasConsensus).toBe(true);
      expect(result.confidence).toBe(85);
      expect(result.reasoning).toContain('converged');
      expect(result.proposedSolution).toContain('modular approach');
    });

    it('parses NO consensus correctly', () => {
      const result = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.structuredNo,
        'model-b'
      );

      expect(result.hasConsensus).toBe(false);
      expect(result.confidence).toBe(70);
      expect(result.reasoning).toContain('differences remain');
      expect(result.proposedSolution).toBeUndefined();
    });

    it('clamps confidence to valid range', () => {
      const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]
150
[REASONING]
Test
[PROPOSED_SOLUTION]
Test solution`;

      const result = parseConsensusResponse(response, 'model-a');
      expect(result.confidence).toBe(100);
    });

    it('handles minimum confidence', () => {
      const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS: NO
[CONFIDENCE]
-10
[REASONING]
Test
[PROPOSED_SOLUTION]
No consensus yet.`;

      const result = parseConsensusResponse(response, 'model-a');
      expect(result.confidence).toBe(0);
    });
  });

  describe('natural language fallback parsing', () => {
    it('infers YES from positive language', () => {
      const result = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.naturalLanguageYes,
        'model-a'
      );

      expect(result.hasConsensus).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(30);
      expect(result.confidence).toBeLessThanOrEqual(70);
    });

    it('infers NO from negative language', () => {
      const result = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.naturalLanguageNo,
        'model-b'
      );

      expect(result.hasConsensus).toBe(false);
    });

    it('handles ambiguous responses conservatively', () => {
      const result = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.ambiguous,
        'model-a'
      );

      // Should default to no consensus when ambiguous
      expect(result.confidence).toBeGreaterThanOrEqual(30);
      expect(result.confidence).toBeLessThanOrEqual(70);
    });
  });

  describe('edge cases', () => {
    it('handles empty response', () => {
      const result = parseConsensusResponse('', 'model-a');
      expect(result.hasConsensus).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(30);
    });

    it('handles response with only markers but no content', () => {
      const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]
[REASONING]
[PROPOSED_SOLUTION]`;

      const result = parseConsensusResponse(response, 'model-a');
      expect(result.hasConsensus).toBe(true);
      // Should use default confidence when not parseable
      expect(result.confidence).toBe(50);
    });

    it('handles case-insensitive HAS_CONSENSUS', () => {
      const response = `[CONSENSUS_CHECK]
has_consensus: yes
[CONFIDENCE]
80
[REASONING]
Test
[PROPOSED_SOLUTION]
Solution`;

      const result = parseConsensusResponse(response, 'model-a');
      expect(result.hasConsensus).toBe(true);
    });
  });

  describe('toConsensusVote', () => {
    it('converts parsed response to vote object', () => {
      const parsed = parseConsensusResponse(
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
        'model-a'
      );

      const vote = toConsensusVote(parsed, 'model-a');

      expect(vote.role).toBe('model-a');
      expect(vote.hasConsensus).toBe(true);
      expect(vote.confidence).toBe(85);
      expect(vote.timestamp).toBeGreaterThan(0);
    });
  });
});
```

---

### Step 6.6: Unit Tests - Configuration Schema

**File:** `src/__tests__/unit/config/schema.test.ts`

**Purpose:** Test Zod validation schemas for configuration.

```typescript
import {
  modelParametersSchema,
  discussionSettingsSchema,
  apiKeysSchema,
  validateConfig,
  validateApiKeyFormat,
} from '@/lib/config/schema';
import { DEFAULT_MODEL_PARAMETERS, DEFAULT_DISCUSSION_SETTINGS } from '@/lib/config/defaults';

describe('Configuration Schemas', () => {
  describe('modelParametersSchema', () => {
    it('validates correct default parameters', () => {
      const result = modelParametersSchema.safeParse(DEFAULT_MODEL_PARAMETERS);
      expect(result.success).toBe(true);
    });

    it('rejects temperature below minimum', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: -0.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects temperature above maximum', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: 2.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer maxTokensPerTurn', () => {
      const result = modelParametersSchema.safeParse({
        ...DEFAULT_MODEL_PARAMETERS,
        maxTokensPerTurn: 1024.5,
      });
      expect(result.success).toBe(false);
    });

    it('validates edge case values', () => {
      const edgeCase = {
        temperature: 0,
        maxTokensPerTurn: 256,
        topP: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
      };
      const result = modelParametersSchema.safeParse(edgeCase);
      expect(result.success).toBe(true);
    });

    it('validates maximum values', () => {
      const maxCase = {
        temperature: 2,
        maxTokensPerTurn: 8192,
        topP: 1,
        frequencyPenalty: 2,
        presencePenalty: 2,
      };
      const result = modelParametersSchema.safeParse(maxCase);
      expect(result.success).toBe(true);
    });
  });

  describe('discussionSettingsSchema', () => {
    it('validates correct default settings', () => {
      const result = discussionSettingsSchema.safeParse(DEFAULT_DISCUSSION_SETTINGS);
      expect(result.success).toBe(true);
    });

    it('rejects maxIterations below minimum', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        maxIterations: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxIterations above maximum', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        maxIterations: 100,
      });
      expect(result.success).toBe(false);
    });

    it('validates boolean settings', () => {
      const result = discussionSettingsSchema.safeParse({
        ...DEFAULT_DISCUSSION_SETTINGS,
        requireBothConsensus: false,
        autoScrollEnabled: false,
        showTokenUsage: false,
        showTimings: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('apiKeysSchema', () => {
    it('accepts valid OpenAI key format', () => {
      const result = apiKeysSchema.safeParse({
        openai: 'sk-abcdefghijklmnopqrstuvwxyz123456',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid Anthropic key format', () => {
      const result = apiKeysSchema.safeParse({
        anthropic: 'sk-ant-abcdefghijklmnopqrstuvwxyz123456',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid OpenAI key format', () => {
      const result = apiKeysSchema.safeParse({
        openai: 'invalid-key-format',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty/undefined keys', () => {
      const result = apiKeysSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('validates OpenAI key format', () => {
      expect(validateApiKeyFormat('openai', 'sk-test1234567890123456')).toBe(true);
      expect(validateApiKeyFormat('openai', 'invalid')).toBe(false);
    });

    it('validates Anthropic key format', () => {
      expect(validateApiKeyFormat('anthropic', 'sk-ant-test1234567890123456')).toBe(true);
      expect(validateApiKeyFormat('anthropic', 'sk-test')).toBe(false);
    });

    it('always returns true for Ollama', () => {
      expect(validateApiKeyFormat('ollama', '')).toBe(true);
      expect(validateApiKeyFormat('ollama', 'anything')).toBe(true);
    });

    it('returns false for unknown providers', () => {
      expect(validateApiKeyFormat('unknown', 'key')).toBe(false);
    });
  });

  describe('validateConfig helper', () => {
    it('returns success with valid data', () => {
      const result = validateConfig(modelParametersSchema, DEFAULT_MODEL_PARAMETERS);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(DEFAULT_MODEL_PARAMETERS);
      }
    });

    it('returns errors with invalid data', () => {
      const result = validateConfig(modelParametersSchema, {
        temperature: -1,
        maxTokensPerTurn: 'not-a-number',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.errors).length).toBeGreaterThan(0);
      }
    });

    it('provides field-specific error messages', () => {
      const result = validateConfig(modelParametersSchema, {
        ...DEFAULT_MODEL_PARAMETERS,
        temperature: 10,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.temperature).toBeDefined();
      }
    });
  });
});
```

---

### Step 6.7: Unit Tests - SSE Client

**File:** `src/__tests__/unit/client/sse-client.test.ts`

**Purpose:** Test SSE event parsing and buffer handling.

```typescript
import { parseSSEEvent, SSEConnection } from '@/lib/client/sse-client';

describe('SSE Client', () => {
  describe('parseSSEEvent', () => {
    it('parses discussion-started event', () => {
      const data = JSON.stringify({
        discussionId: 'disc_123',
        timestamp: 1234567890,
        prompt: 'Test prompt',
      });

      const result = parseSSEEvent('discussion-started', data);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('discussion-started');
      expect(result?.data.discussionId).toBe('disc_123');
    });

    it('parses turn-chunk event', () => {
      const data = JSON.stringify({
        discussionId: 'disc_123',
        timestamp: 1234567890,
        role: 'model-a',
        chunk: 'Hello ',
      });

      const result = parseSSEEvent('turn-chunk', data);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('turn-chunk');
      if (result?.type === 'turn-chunk') {
        expect(result.data.chunk).toBe('Hello ');
      }
    });

    it('parses discussion-completed event', () => {
      const data = JSON.stringify({
        discussionId: 'disc_123',
        timestamp: 1234567890,
        stoppingReason: 'consensus_reached',
        finalConsensus: {
          solution: 'The solution is...',
          achievedAtRound: 3,
        },
      });

      const result = parseSSEEvent('discussion-completed', data);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('discussion-completed');
      if (result?.type === 'discussion-completed') {
        expect(result.data.stoppingReason).toBe('consensus_reached');
        expect(result.data.finalConsensus?.solution).toBe('The solution is...');
      }
    });

    it('returns null for unknown event types', () => {
      const result = parseSSEEvent('unknown-event', '{}');
      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const result = parseSSEEvent('discussion-started', 'not valid json');
      expect(result).toBeNull();
    });

    it('parses all valid event types', () => {
      const eventTypes = [
        'discussion-started',
        'round-started',
        'turn-started',
        'turn-chunk',
        'turn-completed',
        'consensus-check-started',
        'consensus-vote',
        'consensus-result',
        'round-completed',
        'discussion-completed',
        'discussion-error',
        'discussion-aborted',
      ];

      for (const eventType of eventTypes) {
        const result = parseSSEEvent(eventType, '{}');
        expect(result).not.toBeNull();
        expect(result?.type).toBe(eventType);
      }
    });
  });

  describe('SSEConnection buffer extraction', () => {
    // Test the private extractEvents method indirectly through connection behavior
    it('handles complete events', async () => {
      const events: any[] = [];

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: discussion-started\ndata: {"discussionId":"test"}\n\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      global.fetch = mockFetch;

      const connection = new SSEConnection('/api/discussion', {
        onEvent: (event) => events.push(event),
        onError: jest.fn(),
        onClose: jest.fn(),
      });

      await connection.connect({ prompt: 'test' });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('discussion-started');
    });

    it('handles partial events across chunks', async () => {
      const events: any[] = [];

      let readCount = 0;
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockImplementation(() => {
              readCount++;
              if (readCount === 1) {
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode('event: discussion-started\n'),
                });
              }
              if (readCount === 2) {
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode('data: {"discussionId":"test"}\n\n'),
                });
              }
              return Promise.resolve({ done: true });
            }),
          }),
        },
      });

      global.fetch = mockFetch;

      const connection = new SSEConnection('/api/discussion', {
        onEvent: (event) => events.push(event),
        onError: jest.fn(),
        onClose: jest.fn(),
      });

      await connection.connect({ prompt: 'test' });

      expect(events.length).toBe(1);
    });

    it('ignores keep-alive comments', async () => {
      const events: any[] = [];

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(': keep-alive\n\n'),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  'event: discussion-started\ndata: {"discussionId":"test"}\n\n'
                ),
              })
              .mockResolvedValueOnce({ done: true }),
          }),
        },
      });

      global.fetch = mockFetch;

      const connection = new SSEConnection('/api/discussion', {
        onEvent: (event) => events.push(event),
        onError: jest.fn(),
        onClose: jest.fn(),
      });

      await connection.connect({ prompt: 'test' });

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('discussion-started');
    });
  });
});
```

---

### Step 6.8: Integration Tests - Discussion Engine

**File:** `src/__tests__/integration/discussion-engine.test.ts`

**Purpose:** Test complete discussion flow with mock providers.

```typescript
import { DiscussionEngine } from '@/lib/discussion/engine/discussion-engine';
import { MockAIProvider, createMockOpenAI, createMockAnthropic } from '@/test-utils/mocks/providers';
import { CONSENSUS_RESPONSE_TEMPLATES, TURN_RESPONSE_TEMPLATES } from '@/test-utils/fixtures/sample-prompts';
import type { DiscussionConfig, DiscussionEvent } from '@/lib/discussion';

describe('DiscussionEngine Integration', () => {
  let mockProviderA: MockAIProvider;
  let mockProviderB: MockAIProvider;
  let events: DiscussionEvent[];

  const createTestConfig = (): DiscussionConfig => ({
    prompt: 'What is the best programming language for web development?',
    participants: {
      modelA: {
        role: 'model-a',
        modelId: 'mock-model-1',
        providerId: 'openai',
        displayName: 'Mock OpenAI',
      },
      modelB: {
        role: 'model-b',
        modelId: 'mock-model-2',
        providerId: 'anthropic',
        displayName: 'Mock Anthropic',
      },
    },
    options: {
      maxIterations: 5,
      temperature: 0.7,
      maxTokensPerTurn: 1024,
      turnTimeoutMs: 5000,
      totalTimeoutMs: 60000,
      requireBothConsensus: true,
      minRoundsBeforeConsensus: 1,
    },
  });

  beforeEach(() => {
    mockProviderA = createMockOpenAI();
    mockProviderB = createMockAnthropic();
    events = [];
  });

  describe('successful consensus flow', () => {
    it('reaches consensus after discussion rounds', async () => {
      // Queue responses: turn responses then consensus YES
      mockProviderA.queueResponses([
        TURN_RESPONSE_TEMPLATES.initialProposal,
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
      ]);
      mockProviderB.queueResponses([
        TURN_RESPONSE_TEMPLATES.constructiveResponse,
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
      ]);

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      const unsubscribe = engine.onEvent((event) => events.push(event));

      await engine.start(createTestConfig());

      unsubscribe();

      // Verify event sequence
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('discussion_started');
      expect(eventTypes).toContain('round_started');
      expect(eventTypes).toContain('turn_started');
      expect(eventTypes).toContain('turn_completed');
      expect(eventTypes).toContain('consensus_vote');
      expect(eventTypes).toContain('discussion_completed');

      // Verify completion
      const completedEvent = events.find((e) => e.type === 'discussion_completed');
      expect(completedEvent).toBeDefined();
      if (completedEvent?.type === 'discussion_completed') {
        expect(completedEvent.stoppingReason).toBe('consensus_reached');
        expect(completedEvent.finalConsensus).toBeDefined();
      }
    });

    it('continues until max iterations when no consensus', async () => {
      // Queue NO consensus responses for all rounds
      for (let i = 0; i < 10; i++) {
        mockProviderA.queueResponse(TURN_RESPONSE_TEMPLATES.initialProposal);
        mockProviderB.queueResponse(TURN_RESPONSE_TEMPLATES.constructiveResponse);
        mockProviderA.queueResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredNo);
        mockProviderB.queueResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredNo);
      }

      const config = createTestConfig();
      config.options.maxIterations = 3;

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      engine.onEvent((event) => events.push(event));

      await engine.start(config);

      const completedEvent = events.find((e) => e.type === 'discussion_completed');
      expect(completedEvent).toBeDefined();
      if (completedEvent?.type === 'discussion_completed') {
        expect(completedEvent.stoppingReason).toBe('max_iterations');
      }

      const roundStartEvents = events.filter((e) => e.type === 'round_started');
      expect(roundStartEvents.length).toBe(3);
    });
  });

  describe('abort handling', () => {
    it('stops discussion when aborted', async () => {
      // Set up slow responses
      mockProviderA.setConfig({ responseDelay: 1000 });
      mockProviderB.setConfig({ responseDelay: 1000 });

      mockProviderA.queueResponse(TURN_RESPONSE_TEMPLATES.initialProposal);
      mockProviderB.queueResponse(TURN_RESPONSE_TEMPLATES.constructiveResponse);

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      engine.onEvent((event) => events.push(event));

      // Start and abort quickly
      const startPromise = engine.start(createTestConfig());

      await new Promise((resolve) => setTimeout(resolve, 100));
      engine.abort();

      await startPromise;

      const abortedEvent = events.find((e) => e.type === 'discussion_aborted');
      expect(abortedEvent).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('emits error event when provider fails', async () => {
      mockProviderA.setConfig({
        shouldFail: true,
        failureMessage: 'API rate limit exceeded',
      });

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      engine.onEvent((event) => events.push(event));

      await engine.start(createTestConfig());

      const errorEvent = events.find((e) => e.type === 'discussion_error');
      expect(errorEvent).toBeDefined();
    });

    it('handles timeout gracefully', async () => {
      mockProviderA.setConfig({ responseDelay: 10000 }); // 10 second delay

      const config = createTestConfig();
      config.options.turnTimeoutMs = 100; // 100ms timeout

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      engine.onEvent((event) => events.push(event));

      await engine.start(config);

      const errorEvent = events.find((e) => e.type === 'discussion_error');
      expect(errorEvent).toBeDefined();
      if (errorEvent?.type === 'discussion_error') {
        expect(errorEvent.error.code).toBe('TURN_TIMEOUT');
      }
    });
  });

  describe('streaming behavior', () => {
    it('emits turn chunks during streaming', async () => {
      mockProviderA.setConfig({ streamChunkSize: 5 });
      mockProviderA.queueResponses([
        'Hello, this is Model A speaking.',
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
      ]);
      mockProviderB.queueResponses([
        'Hello from Model B.',
        CONSENSUS_RESPONSE_TEMPLATES.structuredYes,
      ]);

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      engine.onEvent((event) => events.push(event));

      await engine.start(createTestConfig());

      const chunkEvents = events.filter((e) => e.type === 'turn_chunk');
      expect(chunkEvents.length).toBeGreaterThan(0);
    });
  });

  describe('state retrieval', () => {
    it('returns current state during discussion', async () => {
      mockProviderA.setConfig({ responseDelay: 500 });
      mockProviderA.queueResponse(TURN_RESPONSE_TEMPLATES.initialProposal);
      mockProviderB.queueResponse(TURN_RESPONSE_TEMPLATES.constructiveResponse);

      const engine = new DiscussionEngine((providerId) =>
        providerId === 'openai' ? mockProviderA : mockProviderB
      );

      const startPromise = engine.start(createTestConfig());

      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = engine.getState();
      expect(state.phase).not.toBe('idle');

      engine.abort();
      await startPromise;
    });
  });
});
```

---

### Step 6.9: End-to-End Tests - Discussion Flow

**File:** `src/__tests__/e2e/discussion-flow.spec.ts`

**Purpose:** Test complete user journey with Playwright.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Discussion Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays setup form on initial load', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ralph-discuss' })).toBeVisible();
    await expect(page.getByText('Select two AI models')).toBeVisible();
    await expect(page.getByLabel('Model A')).toBeVisible();
    await expect(page.getByLabel('Model B')).toBeVisible();
    await expect(page.getByLabel('Discussion Prompt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Discussion' })).toBeVisible();
  });

  test('start button is disabled until form is complete', async ({ page }) => {
    const startButton = page.getByRole('button', { name: 'Start Discussion' });
    await expect(startButton).toBeDisabled();

    // Select Model A
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await expect(startButton).toBeDisabled();

    // Select Model B
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await expect(startButton).toBeDisabled();

    // Enter short prompt (should still be disabled)
    await page.getByLabel('Discussion Prompt').fill('Short');
    await expect(startButton).toBeDisabled();

    // Enter valid prompt
    await page.getByLabel('Discussion Prompt').fill('What is the best approach to state management in React applications?');
    await expect(startButton).toBeEnabled();
  });

  test('shows character count and validation feedback', async ({ page }) => {
    const promptInput = page.getByLabel('Discussion Prompt');

    // Type short text
    await promptInput.fill('Hello');
    await expect(page.getByText('Minimum 10 characters required')).toBeVisible();

    // Type valid text
    await promptInput.fill('This is a valid prompt that is long enough.');
    await expect(page.getByText('Minimum 10 characters required')).not.toBeVisible();
    await expect(page.getByText(/\d+ \/ 10,000/)).toBeVisible();
  });

  test('keyboard shortcut submits form', async ({ page }) => {
    // Fill out form
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await page.getByLabel('Discussion Prompt').fill('What is the best programming language for web development?');

    // Use Cmd/Ctrl + Enter
    await page.getByLabel('Discussion Prompt').press('Meta+Enter');

    // Should transition to connecting/active state
    await expect(page.getByText('Connecting...')).toBeVisible({ timeout: 5000 });
  });

  test.describe('with mock API', () => {
    test.beforeEach(async ({ page }) => {
      // Mock the discussion API endpoint
      await page.route('/api/discussion', async (route) => {
        const encoder = new TextEncoder();
        const events = [
          'event: discussion-started\ndata: {"discussionId":"test-123","timestamp":1234567890,"prompt":"Test"}\n\n',
          'event: round-started\ndata: {"discussionId":"test-123","roundNumber":1}\n\n',
          'event: turn-started\ndata: {"discussionId":"test-123","role":"model-a","roundNumber":1,"modelId":"gpt-4o"}\n\n',
          'event: turn-chunk\ndata: {"discussionId":"test-123","role":"model-a","chunk":"This is "}\n\n',
          'event: turn-chunk\ndata: {"discussionId":"test-123","role":"model-a","chunk":"Model A response."}\n\n',
          'event: turn-completed\ndata: {"discussionId":"test-123","turn":{"id":"turn-1","role":"model-a","roundNumber":1,"content":"This is Model A response.","timestamp":1234567890,"durationMs":500,"tokenUsage":{"promptTokens":100,"completionTokens":50},"finishReason":"stop"}}\n\n',
          'event: turn-started\ndata: {"discussionId":"test-123","role":"model-b","roundNumber":1,"modelId":"claude-sonnet"}\n\n',
          'event: turn-chunk\ndata: {"discussionId":"test-123","role":"model-b","chunk":"Model B agrees."}\n\n',
          'event: turn-completed\ndata: {"discussionId":"test-123","turn":{"id":"turn-2","role":"model-b","roundNumber":1,"content":"Model B agrees.","timestamp":1234567890,"durationMs":400,"tokenUsage":{"promptTokens":100,"completionTokens":40},"finishReason":"stop"}}\n\n',
          'event: consensus-vote\ndata: {"discussionId":"test-123","vote":{"role":"model-a","hasConsensus":true,"confidence":90,"reasoning":"We agree","proposedSolution":"The solution","timestamp":1234567890}}\n\n',
          'event: consensus-vote\ndata: {"discussionId":"test-123","vote":{"role":"model-b","hasConsensus":true,"confidence":85,"reasoning":"Agreed","proposedSolution":"The solution","timestamp":1234567890}}\n\n',
          'event: discussion-completed\ndata: {"discussionId":"test-123","timestamp":1234567890,"stoppingReason":"consensus_reached","finalConsensus":{"solution":"The solution is to use TypeScript.","achievedAtRound":1}}\n\n',
        ];

        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
          body: events.join(''),
        });
      });
    });

    test('displays streaming messages during discussion', async ({ page }) => {
      // Start discussion
      await page.getByLabel('Model A').click();
      await page.getByText('GPT-4o').first().click();
      await page.getByLabel('Model B').click();
      await page.getByText('Claude Sonnet').first().click();
      await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
      await page.getByRole('button', { name: 'Start Discussion' }).click();

      // Wait for messages to appear
      await expect(page.getByText('This is Model A response.')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Model B agrees.')).toBeVisible({ timeout: 10000 });
    });

    test('displays consensus card when discussion completes', async ({ page }) => {
      await page.getByLabel('Model A').click();
      await page.getByText('GPT-4o').first().click();
      await page.getByLabel('Model B').click();
      await page.getByText('Claude Sonnet').first().click();
      await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
      await page.getByRole('button', { name: 'Start Discussion' }).click();

      // Wait for consensus card
      await expect(page.getByText('Consensus Reached')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('The solution is to use TypeScript.')).toBeVisible();
    });

    test('shows new discussion button after completion', async ({ page }) => {
      await page.getByLabel('Model A').click();
      await page.getByText('GPT-4o').first().click();
      await page.getByLabel('Model B').click();
      await page.getByText('Claude Sonnet').first().click();
      await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
      await page.getByRole('button', { name: 'Start Discussion' }).click();

      await expect(page.getByRole('button', { name: 'New Discussion' })).toBeVisible({ timeout: 15000 });
    });
  });
});
```

---

### Step 6.10: End-to-End Tests - Error Handling

**File:** `src/__tests__/e2e/error-handling.spec.ts`

**Purpose:** Test error scenarios and recovery.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('displays error when API fails', async ({ page }) => {
    // Mock API to return error
    await page.route('/api/discussion', async (route) => {
      await route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await page.goto('/');

    // Fill form and submit
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
    await page.getByRole('button', { name: 'Start Discussion' }).click();

    // Should show error
    await expect(page.getByText('Error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
  });

  test('displays error when provider is unavailable', async ({ page }) => {
    await page.route('/api/discussion', async (route) => {
      const encoder = new TextEncoder();
      const events = [
        'event: discussion-started\ndata: {"discussionId":"test-123","timestamp":1234567890}\n\n',
        'event: discussion-error\ndata: {"discussionId":"test-123","error":{"code":"PROVIDER_ERROR","message":"OpenAI API rate limit exceeded","recoverable":true}}\n\n',
      ];

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: events.join(''),
      });
    });

    await page.goto('/');
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
    await page.getByRole('button', { name: 'Start Discussion' }).click();

    await expect(page.getByText('Provider Error')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('rate limit')).toBeVisible();
  });

  test('retry button works after error', async ({ page }) => {
    let callCount = 0;

    await page.route('/api/discussion', async (route) => {
      callCount++;

      if (callCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Temporary error' }),
        });
      } else {
        // Second call succeeds
        const events = [
          'event: discussion-started\ndata: {"discussionId":"test-123"}\n\n',
          'event: discussion-completed\ndata: {"discussionId":"test-123","stoppingReason":"consensus_reached","finalConsensus":{"solution":"Success!","achievedAtRound":1}}\n\n',
        ];
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
          body: events.join(''),
        });
      }
    });

    await page.goto('/');
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
    await page.getByRole('button', { name: 'Start Discussion' }).click();

    // Wait for error
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible({ timeout: 10000 });

    // Retry
    await page.getByRole('button', { name: 'Try Again' }).click();

    // Should succeed
    await expect(page.getByText('Consensus Reached')).toBeVisible({ timeout: 10000 });
    expect(callCount).toBe(2);
  });

  test('stop button aborts discussion', async ({ page }) => {
    await page.route('/api/discussion', async (route) => {
      // Slow response that can be aborted
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({ status: 200, body: '' });
    });

    await page.goto('/');
    await page.getByLabel('Model A').click();
    await page.getByText('GPT-4o').first().click();
    await page.getByLabel('Model B').click();
    await page.getByText('Claude Sonnet').first().click();
    await page.getByLabel('Discussion Prompt').fill('What is the best programming language?');
    await page.getByRole('button', { name: 'Start Discussion' }).click();

    // Wait for connecting state
    await expect(page.getByText('Connecting...')).toBeVisible({ timeout: 5000 });

    // Click stop button
    await page.getByRole('button', { name: 'Stop Discussion' }).click();

    // Should show completed state with abort reason
    await expect(page.getByText('Discussion Ended')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('stopped by user')).toBeVisible();
  });
});
```

---

### Step 6.11: Manual Testing Checklist

**File:** `TESTING.md` (create in project root)

**Purpose:** Document manual testing procedures for verification.

```markdown
# Manual Testing Checklist

## Prerequisites

1. Ensure all dependencies are installed: `npm install`
2. Create `.env.local` with valid API keys:
   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Start the development server: `npm run dev`

## Test Categories

### 1. UI/UX Tests

#### Setup Form
- [ ] Model A dropdown shows available models grouped by provider
- [ ] Model B dropdown shows available models
- [ ] Can select different models for A and B
- [ ] Cannot select the same model for both (if excludeModelId is implemented)
- [ ] Prompt textarea accepts input
- [ ] Character counter updates in real-time
- [ ] Validation message shows when prompt is too short (< 10 chars)
- [ ] Validation message shows when prompt is too long (> 10,000 chars)
- [ ] Start button is disabled until form is valid
- [ ] Cmd/Ctrl + Enter keyboard shortcut works

#### During Discussion
- [ ] "Thinking..." indicator appears before each turn
- [ ] Content streams character-by-character
- [ ] Messages appear on correct side (A=left, B=right)
- [ ] Messages use correct colors (A=blue, B=amber)
- [ ] Auto-scroll keeps latest content visible
- [ ] Round headers show round numbers
- [ ] Stop button is visible and functional
- [ ] Token usage displays after each turn completes
- [ ] Duration displays for each turn

#### After Discussion
- [ ] Consensus card shows when discussion completes
- [ ] Card shows appropriate message based on stopping reason
- [ ] "New Discussion" button appears
- [ ] Clicking "New Discussion" returns to setup form
- [ ] Model selections are preserved after reset

### 2. Consensus Scenarios

#### Quick Consensus
- [ ] **Prompt**: "What is 2 + 2?"
- [ ] Expected: Consensus reached in 1-2 rounds
- [ ] Verify: Green consensus card with solution

#### Extended Discussion
- [ ] **Prompt**: "Design a REST API for a task management application. Consider security, scalability, and user experience."
- [ ] Expected: Multiple rounds of discussion
- [ ] Verify: Models build on each other's ideas

#### Max Iterations
- [ ] **Prompt**: "Is it better to use tabs or spaces for indentation?" (configure max 3 rounds)
- [ ] Expected: May not reach consensus
- [ ] Verify: Card shows "Maximum iteration limit reached"

### 3. Error Handling Tests

#### API Key Missing
- [ ] Remove OPENAI_API_KEY from .env.local
- [ ] Try to start discussion with OpenAI model
- [ ] Expected: Error message about missing/invalid API key
- [ ] Verify: Error is recoverable (can add key and retry)

#### API Rate Limit
- [ ] Make many rapid requests to trigger rate limiting
- [ ] Expected: Error message about rate limit
- [ ] Verify: Error indicates temporary issue

#### Network Disconnection
- [ ] Start a discussion
- [ ] Disable network (airplane mode or disconnect)
- [ ] Expected: Error displayed
- [ ] Verify: Can reconnect and retry

#### Timeout
- [ ] Configure very short timeout (e.g., 5 seconds)
- [ ] Start discussion that requires longer response
- [ ] Expected: Timeout error
- [ ] Verify: Error shows timeout message

### 4. Provider-Specific Tests

#### OpenAI Provider
- [ ] GPT-4o model responds correctly
- [ ] GPT-4o-mini model responds correctly
- [ ] Streaming works properly
- [ ] Token usage reported accurately

#### Anthropic Provider
- [ ] Claude Sonnet model responds correctly
- [ ] Claude Haiku model responds correctly
- [ ] Streaming works properly
- [ ] Token usage reported accurately

#### Ollama Provider (if configured)
- [ ] Local models are discovered and listed
- [ ] Discussion works with local models
- [ ] Handles Ollama not running gracefully

### 5. Settings Tests

#### API Key Management
- [ ] Can enter API key in settings
- [ ] Key is masked after entry
- [ ] Validation runs and shows status
- [ ] Invalid key format shows error
- [ ] Valid key shows success indicator

#### Model Parameters
- [ ] Temperature slider works (0-2 range)
- [ ] Max tokens slider works (256-8192 range)
- [ ] Presets apply correct values
- [ ] Reset to defaults works

#### Discussion Settings
- [ ] Max iterations can be changed
- [ ] Timeout settings can be adjusted
- [ ] Changes persist across page refreshes (if using localStorage)

### 6. Cross-Provider Discussion

- [ ] OpenAI (Model A) + Anthropic (Model B) works
- [ ] Anthropic (Model A) + OpenAI (Model B) works
- [ ] Same provider but different models works (e.g., GPT-4o vs GPT-4o-mini)

### 7. Responsive Design

- [ ] Mobile viewport (< 640px): Single column layout
- [ ] Tablet viewport (640px - 1024px): Model selectors side-by-side
- [ ] Desktop viewport (> 1024px): Full comfortable layout
- [ ] All controls are usable on touch devices

### 8. Dark Mode

- [ ] Toggle dark mode in system preferences
- [ ] All colors adapt correctly
- [ ] No contrast issues
- [ ] Message bubbles readable in both modes

## Performance Benchmarks

| Metric | Target |
|--------|--------|
| Time to first content (streaming) | < 2s |
| UI responsiveness during streaming | No frame drops |
| Memory usage during 10-round discussion | < 500MB |

## Reporting Issues

If a test fails, document:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser and OS version
5. Screenshot or video if applicable
```

---

### Step 6.12: Test Runner Script

**File:** `scripts/run-tests.sh`

**Purpose:** Convenience script to run different test suites.

```bash
#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running Test Suite${NC}"
echo "================================"

# Parse arguments
COVERAGE=false
E2E=false
UNIT_ONLY=false
INTEGRATION_ONLY=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --coverage) COVERAGE=true ;;
        --e2e) E2E=true ;;
        --unit) UNIT_ONLY=true ;;
        --integration) INTEGRATION_ONLY=true ;;
        --all)
            COVERAGE=true
            E2E=true
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Run unit tests
if [ "$INTEGRATION_ONLY" = false ]; then
    echo -e "\n${GREEN}Running Unit Tests...${NC}"
    if [ "$COVERAGE" = true ]; then
        npm run test:unit -- --coverage
    else
        npm run test:unit
    fi
fi

# Run integration tests
if [ "$UNIT_ONLY" = false ]; then
    echo -e "\n${GREEN}Running Integration Tests...${NC}"
    npm run test:integration
fi

# Run e2e tests
if [ "$E2E" = true ]; then
    echo -e "\n${GREEN}Running E2E Tests...${NC}"
    npm run test:e2e
fi

echo -e "\n${GREEN}All tests completed!${NC}"
```

---

## Files to Create Summary

| File | Type | Description |
|------|------|-------------|
| `jest.config.js` | Config | Jest configuration (modify existing) |
| `playwright.config.ts` | Config | Playwright e2e configuration |
| `jest.setup.js` | Config | Jest setup file |
| `src/test-utils/mocks/providers.ts` | Mock | Mock AI providers |
| `src/test-utils/fixtures/sample-prompts.ts` | Fixture | Test prompts and responses |
| `src/test-utils/helpers/test-setup.ts` | Helper | Common test utilities |
| `src/__tests__/unit/discussion/state-machine.test.ts` | Test | State machine tests |
| `src/__tests__/unit/discussion/response-parser.test.ts` | Test | Consensus parser tests |
| `src/__tests__/unit/config/schema.test.ts` | Test | Zod schema tests |
| `src/__tests__/unit/client/sse-client.test.ts` | Test | SSE client tests |
| `src/__tests__/integration/discussion-engine.test.ts` | Test | Engine integration tests |
| `src/__tests__/e2e/discussion-flow.spec.ts` | Test | E2E discussion flow |
| `src/__tests__/e2e/error-handling.spec.ts` | Test | E2E error scenarios |
| `TESTING.md` | Doc | Manual testing checklist |
| `scripts/run-tests.sh` | Script | Test runner convenience script |

**Total: 15 files**

---

## Key Technical Decisions Summary

| Decision | Rationale |
|----------|-----------|
| **Jest for unit/integration** | Native Next.js support, fast, good TypeScript |
| **Playwright for E2E** | Modern, reliable, excellent debugging |
| **Mock providers** | Test without real API calls, control responses |
| **Response queue in mocks** | Test multi-turn conversation sequences |
| **Categorized test prompts** | Easy to select appropriate test cases |
| **70% coverage threshold** | Reasonable baseline without being overly strict |
| **Separate test commands** | Run specific suites as needed during development |
| **Manual testing checklist** | Catch UI/UX issues automated tests miss |
| **SSE mocking in Playwright** | Test real streaming behavior in browser |

---

## Verification of Verification

After implementing this test suite, verify that:

### Automated Tests
1. `npm run test:unit` passes all unit tests
2. `npm run test:integration` passes all integration tests
3. `npm run test:e2e` passes all e2e tests
4. `npm run test:coverage` achieves 70%+ coverage

### Manual Verification
1. Complete all items in TESTING.md checklist
2. Test with real API keys for at least one full discussion
3. Verify consensus is reached on simple prompts (e.g., "What is 2+2?")
4. Verify error handling with invalid API keys

### CI/CD Integration
```yaml
# Example GitHub Actions workflow section
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

---

## Dependencies on Previous Steps

This step requires completion of:

1. **Step 1**: Project setup, Jest configuration
2. **Step 2**: AI provider layer (for mocking)
3. **Step 3**: Discussion engine (main test target)
4. **Step 4**: Web UI (E2E test target)
5. **Step 5**: Configuration (validation tests)

**Required packages to add:**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/react": "^14.0.0",
    "@types/jest": "^29.5.0"
  }
}
```
