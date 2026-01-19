# ralph-discuss - Development Task

## Project Goal
Build a web application that facilitates iterative discussions between two AI models to converge on optimal solutions for user-provided prompts.

## Tech Stack
- TypeScript, Next.js 14+ (App Router), Tailwind CSS, shadcn/ui
- Vercel AI SDK (@ai-sdk/openai, @ai-sdk/anthropic)
- Support for OpenAI, Anthropic, and Ollama models

## Current Task
Continue implementing the ralph-discuss application following the plan in `plan.md` and detailed specs in `plan/` directory.

## Instructions
1. Check git status and recent commits to understand current progress
2. Review `plan.md` for the implementation roadmap
3. Read relevant `plan/step-*.md` files for detailed specs
4. Implement the next incomplete feature or fix any failing tests
5. Run tests/build to verify your changes work
6. Commit your changes with a descriptive message

## Success Criteria
- All 6 implementation steps from plan.md are complete
- `npm run build` passes without errors
- `npm test` passes all tests
- The app runs and allows two AI models to discuss a prompt

## Completion Signal
When ALL success criteria are met, create a file `.ralph_complete` with content "DONE" to signal completion:
```bash
echo "DONE" > .ralph_complete
```

## Guardrails
- Do NOT delete or modify `.ralph_complete` unless you created it
- Do NOT modify this PROMPT.md file
- Keep commits small and focused
- If stuck on an error for 3+ attempts, document the issue in `ISSUES.md`
