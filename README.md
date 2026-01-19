# ralph-discuss

A web application that facilitates iterative discussions between two AI models to converge on optimal solutions for user-provided prompts.

## Meta

This project is a **Ralph loop experiment** - it's being built autonomously by Claude Code running in an iterative bash loop (`ralph.sh`).

The irony: we're using a loop of AI iterations to build an app that creates loops of AI discussions. It's loops all the way down.

## What It Does

ralph-discuss lets you pick two AI models and give them a problem to solve together. The models take turns discussing, critiquing, and refining each other's ideas until they reach agreement on the best solution.

## How It Works

1. **Select two AI models** - Choose from OpenAI, Anthropic, or local Ollama models
2. **Enter a prompt** - Provide a question, problem, or topic for discussion
3. **Watch the discussion** - See the models debate and build on each other's responses in real-time
4. **Get the solution** - Once both models agree, the final consensus is presented

## Why It's Useful

- **Better answers**: Two models can catch errors and improve on each other's thinking
- **Multiple perspectives**: Different models bring different strengths to problem-solving
- **Transparent reasoning**: Watch the full discussion to understand how the solution was reached

## Supported Providers

- **OpenAI** - GPT-4o, GPT-4 Turbo, GPT-4o Mini
- **Anthropic** - Claude Opus, Claude Sonnet, Claude Haiku
- **Ollama** - Run local models on your own machine
