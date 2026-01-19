# Step 1: Project Setup - Detailed Implementation Plan

## Overview
Initialize a Next.js 14+ project with TypeScript, Tailwind CSS, Vercel AI SDK, and shadcn/ui components for rapid development of the AI discussion application.

---

## 1. Initialize Next.js Project

### 1.1 Create Next.js Application
**Command:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Technical Decisions:**
| Flag | Purpose |
|------|---------|
| `--typescript` | Type safety across the codebase |
| `--tailwind` | Pre-configures Tailwind CSS with PostCSS |
| `--eslint` | Next.js-specific linting rules |
| `--app` | App Router for streaming support (critical for AI responses) |
| `--src-dir` | Clean project root with source in `/src` |
| `--import-alias "@/*"` | Clean imports like `@/components/Button` |

**Why App Router:**
- Built-in streaming support (essential for real-time AI responses)
- Server Components by default (better performance)
- Native support for AI SDK's `useChat` and streaming hooks

---

## 2. Install shadcn/ui Component Library

### 2.1 Initialize shadcn/ui
**Command:**
```bash
npx shadcn@latest init
```

**Configuration choices:**
- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**
- React Server Components: **Yes**
- Write to `components.json`: **Yes**

**Why shadcn/ui:**
- Not a dependency - components are copied into your codebase (full control)
- Built on Radix UI primitives (accessible, unstyled)
- Tailwind CSS native - matches our stack
- Highly customizable
- Tree-shakeable - only include what you use

### 2.2 Install Required Components
```bash
npx shadcn@latest add button card input textarea select label badge scroll-area separator dropdown-menu avatar skeleton
```

| Component | Use Case |
|-----------|----------|
| `button` | Actions (start discussion, stop) |
| `card` | Message containers, panels |
| `input` | API key inputs |
| `textarea` | Prompt input |
| `select` | Model selection dropdowns |
| `label` | Form field labels |
| `badge` | Status indicators (consensus, thinking) |
| `scroll-area` | Scrollable message list |
| `separator` | Visual dividers |
| `dropdown-menu` | Settings menu |
| `avatar` | Model icons/identifiers |
| `skeleton` | Loading states |

### 2.3 Generated Structure
```
src/
├── components/
│   └── ui/           # shadcn/ui components live here
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── ...
├── lib/
│   └── utils.ts      # cn() utility for class merging
```

---

## 3. Install Vercel AI SDK

### 3.1 Install Core Packages
```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

| Package | Purpose |
|---------|---------|
| `ai` | Core AI SDK - streaming, hooks, utilities |
| `@ai-sdk/openai` | OpenAI provider (GPT-4, GPT-3.5, etc.) |
| `@ai-sdk/anthropic` | Anthropic provider (Claude models) |

### 3.2 Why AI SDK

**Unified Provider Interface:**
```typescript
// Same API for all providers
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Both work identically
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello',
});

const result2 = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: 'Hello',
});
```

**Built-in Streaming:**
```typescript
// Server-side streaming
import { streamText } from 'ai';

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Explain quantum computing',
});

return result.toDataStreamResponse();
```

**React Hooks:**
```typescript
// Client-side consumption
import { useChat } from 'ai/react';

const { messages, input, handleSubmit, isLoading } = useChat({
  api: '/api/chat',
});
```

**Key Features for Our App:**
- Streaming text responses (real-time AI output)
- Automatic message history management
- Built-in abort handling
- Provider-agnostic architecture
- TypeScript support out of the box

### 3.3 Optional: Ollama for Local Models
```bash
npm install ollama-ai-provider
```

Allows using local models via Ollama with the same AI SDK interface.

---

## 4. Project Structure Setup

### 4.1 Create Directory Structure
```
src/
├── app/
│   ├── api/
│   │   └── discussion/
│   │       └── route.ts        # Main discussion streaming endpoint
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui components (auto-generated)
│   └── discussion/             # Discussion-specific components
│       ├── model-selector.tsx
│       ├── prompt-input.tsx
│       ├── message-bubble.tsx
│       ├── discussion-panel.tsx
│       └── consensus-card.tsx
├── lib/
│   ├── ai/
│   │   ├── providers.ts        # Provider configurations
│   │   ├── models.ts           # Available models registry
│   │   └── discussion.ts       # Discussion logic
│   └── utils.ts                # shadcn utility (cn function)
├── types/
│   └── index.ts                # TypeScript definitions
├── hooks/
│   └── use-discussion.ts       # Custom hook for discussion state
└── config/
    └── constants.ts            # App constants
```

### 4.2 Create Type Definitions

**`src/types/index.ts`:**
```typescript
// Provider types (aligned with AI SDK)
export type ProviderId = 'openai' | 'anthropic' | 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  providerId: ProviderId;
  description?: string;
}

// Discussion types
export interface DiscussionMessage {
  id: string;
  role: 'model-a' | 'model-b' | 'system';
  content: string;
  modelId: string;
  modelName: string;
  timestamp: number;
  isConsensusCheck?: boolean;
}

export interface DiscussionState {
  status: 'idle' | 'running' | 'consensus' | 'max-iterations' | 'error';
  messages: DiscussionMessage[];
  currentTurn: 'model-a' | 'model-b';
  iteration: number;
  consensusSolution?: string;
  error?: string;
}

export interface DiscussionConfig {
  prompt: string;
  modelA: ModelConfig;
  modelB: ModelConfig;
  maxIterations: number;
  temperature: number;
}

// API types
export interface StartDiscussionRequest {
  prompt: string;
  modelAId: string;
  modelBId: string;
  maxIterations?: number;
  temperature?: number;
}

export interface StreamEvent {
  type: 'message-start' | 'content' | 'message-end' | 'consensus' | 'error' | 'done';
  data: {
    content?: string;
    role?: 'model-a' | 'model-b';
    modelId?: string;
    consensusSolution?: string;
    error?: string;
  };
}
```

### 4.3 Create Provider Configuration

**`src/lib/ai/providers.ts`:**
```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ProviderId } from '@/types';

// Provider factory - returns AI SDK provider instance
export function getProvider(providerId: ProviderId) {
  switch (providerId) {
    case 'openai':
      return openai;
    case 'anthropic':
      return anthropic;
    case 'ollama':
      // Ollama provider setup (if installed)
      throw new Error('Ollama provider not yet configured');
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// Get model instance for AI SDK
export function getModel(providerId: ProviderId, modelId: string) {
  const provider = getProvider(providerId);
  return provider(modelId);
}
```

### 4.4 Create Models Registry

**`src/lib/ai/models.ts`:**
```typescript
import type { ModelConfig, ProviderId } from '@/types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    description: 'Most capable OpenAI model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai',
    description: 'Fast and cost-effective',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    providerId: 'openai',
    description: 'Previous generation flagship',
  },
  // Anthropic Models
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    providerId: 'anthropic',
    description: 'Balanced performance and speed',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    providerId: 'anthropic',
    description: 'Most capable Claude model',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    description: 'Fast and efficient',
  },
];

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

export function getModelsByProvider(providerId: ProviderId): ModelConfig[] {
  return AVAILABLE_MODELS.filter((m) => m.providerId === providerId);
}
```

### 4.5 Create App Constants

**`src/config/constants.ts`:**
```typescript
export const APP_CONFIG = {
  name: 'ralph-discuss',
  description: 'Iterative AI discussions for optimal solutions',
} as const;

export const DISCUSSION_DEFAULTS = {
  maxIterations: 10,
  temperature: 0.7,
  maxTokensPerResponse: 2048,
} as const;

export const MODEL_COLORS = {
  'model-a': {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    accent: 'bg-blue-500',
  },
  'model-b': {
    bg: 'bg-pink-50 dark:bg-pink-950',
    border: 'border-pink-200 dark:border-pink-800',
    text: 'text-pink-700 dark:text-pink-300',
    accent: 'bg-pink-500',
  },
} as const;
```

---

## 5. Tailwind CSS Configuration

### 5.1 Update `tailwind.config.ts`
shadcn/ui will generate most of this, but extend with custom values:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // shadcn/ui will add its own extensions here
      // Add custom animations for streaming
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-dots': 'bounce 1s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')], // Required by shadcn/ui
};

export default config;
```

---

## 6. Environment Variables Setup

### 6.1 Create `.env.local.example`
```env
# OpenAI (required for OpenAI models)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic (required for Claude models)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Ollama (optional - for local models)
# OLLAMA_BASE_URL=http://localhost:11434
```

### 6.2 Verify `.gitignore` includes:
```
.env.local
.env*.local
```

---

## 7. Create Base Layout and Home Page

### 7.1 Update `src/app/layout.tsx`
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ralph-discuss - Iterative AI Discussions',
  description: 'Watch AI models collaborate to find optimal solutions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, 'font-sans antialiased')}>
        {children}
      </body>
    </html>
  );
}
```

### 7.2 Update `src/app/page.tsx`
```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            ralph-discuss
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select two AI models and watch them collaborate through iterative
            discussion to find the best solution to your problem.
          </p>
        </header>

        {/* Main Card - Discussion Interface Placeholder */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Start a Discussion</CardTitle>
            <CardDescription>
              Choose your AI models and enter a prompt to begin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Discussion interface components coming in Step 4...
            </p>
            <div className="flex justify-center">
              <Button disabled>Start Discussion</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

---

## 8. Verification Steps

### 8.1 Development Server
```bash
npm run dev
```
- Visit `http://localhost:3000`
- Verify shadcn/ui card and button render correctly
- Check browser console for errors

### 8.2 Build Verification
```bash
npm run build
```
- Ensure no TypeScript errors
- Verify build completes successfully

### 8.3 Lint Check
```bash
npm run lint
```
- Fix any ESLint warnings

### 8.4 Verify AI SDK Installation
```bash
npm list ai @ai-sdk/openai @ai-sdk/anthropic
```

---

## 9. Summary Checklist

| Step | Task | Status |
|------|------|--------|
| 1.1 | Initialize Next.js with TypeScript, Tailwind, App Router | Pending |
| 2.1 | Initialize shadcn/ui | Pending |
| 2.2 | Install shadcn/ui components | Pending |
| 3.1 | Install AI SDK packages | Pending |
| 4.1 | Create directory structure | Pending |
| 4.2 | Create type definitions | Pending |
| 4.3 | Create provider configuration | Pending |
| 4.4 | Create models registry | Pending |
| 4.5 | Create app constants | Pending |
| 5.1 | Verify/update Tailwind config | Pending |
| 6.1 | Create environment variable template | Pending |
| 7.1 | Update root layout | Pending |
| 7.2 | Update home page with shadcn/ui | Pending |
| 8.x | Run all verification steps | Pending |

---

## 10. Files to Create/Modify

| File | Action | Source |
|------|--------|--------|
| `src/components/ui/*` | Auto-generated | shadcn/ui |
| `src/lib/utils.ts` | Auto-generated | shadcn/ui |
| `components.json` | Auto-generated | shadcn/ui |
| `src/types/index.ts` | Create | Manual |
| `src/lib/ai/providers.ts` | Create | Manual |
| `src/lib/ai/models.ts` | Create | Manual |
| `src/config/constants.ts` | Create | Manual |
| `src/components/discussion/` | Create dir | Manual |
| `src/hooks/` | Create dir | Manual |
| `src/app/api/discussion/` | Create dir | Manual |
| `tailwind.config.ts` | Modify | shadcn/ui + custom |
| `src/app/globals.css` | Modify | shadcn/ui |
| `src/app/layout.tsx` | Modify | Manual |
| `src/app/page.tsx` | Modify | Manual |
| `.env.local.example` | Create | Manual |

---

## Key Package Summary

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14+ | React framework with App Router |
| `ai` | latest | Vercel AI SDK core |
| `@ai-sdk/openai` | latest | OpenAI provider |
| `@ai-sdk/anthropic` | latest | Anthropic provider |
| `shadcn/ui` | latest | Pre-built accessible components |
| `tailwindcss-animate` | latest | Animation utilities (shadcn dep) |
| `clsx` | latest | Class name utility (shadcn dep) |
| `tailwind-merge` | latest | Tailwind class merging (shadcn dep) |
