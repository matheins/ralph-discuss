# Plan: ralph-discuss App

## Overview
Build a web application that facilitates iterative discussions between two AI models to converge on optimal solutions for user-provided prompts.

## Tech Stack
- **Language**: TypeScript
- **Framework**: Next.js (full-stack)
- **AI Providers**: Flexible/pluggable architecture to support multiple providers

## Core Concept
- User selects two AI models
- User enters a prompt/problem
- Models take turns responding and critiquing each other's answers
- Iteration continues until consensus is reached or a stopping condition is met
- Final agreed-upon solution is presented to the user

## High-Level Steps

### 1. Project Setup
- Initialize Next.js project with TypeScript
- Set up project structure (app router)
- Configure Tailwind CSS for styling

### 2. AI Integration Layer
- Design pluggable provider abstraction (easy to add new providers)
- Implement initial providers (OpenAI, Anthropic, Ollama for local models)
- Unified interface for all providers
- Handle authentication and rate limiting

### 3. Conversation Engine
- Design the discussion protocol/format
- Implement turn-based conversation logic
- After each iteration, both models evaluate if consensus is reached
- Stop only when both models agree that consensus is reached
- Include max iterations safeguard to prevent infinite loops

### 4. Web UI
- Model selection dropdowns
- Prompt input text area
- Real-time streaming of conversation (Server-Sent Events)
- Visual display of discussion turns
- Final consensus solution highlight

### 5. Configuration & Settings
- API key management (environment variables)
- Model parameters (temperature, max tokens)
- Discussion settings (max rounds as safeguard)

## Verification
- End-to-end test with sample prompts
- Verify models can reach consensus on simple problems
- Test error handling for API failures
