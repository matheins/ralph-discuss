#!/bin/bash

# Ralph Wiggum Loop - Simple Implementation
# Usage: ./ralph.sh [max_iterations]

MAX_ITERATIONS=${1:-50}
ITERATION=0

echo "Starting Ralph Wiggum loop (max: $MAX_ITERATIONS iterations)"
echo "Press Ctrl+C to stop"
echo "---"

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    echo ""
    echo "=== Iteration $ITERATION / $MAX_ITERATIONS ==="
    echo "Started at: $(date)"

    # Feed PROMPT.md to Claude Code
    cat PROMPT.md | claude --dangerously-skip-permissions

    EXIT_CODE=$?
    echo "Finished at: $(date) (exit code: $EXIT_CODE)"

    # Check if completion marker exists
    if [ -f ".ralph_complete" ]; then
        echo ""
        echo "=== RALPH COMPLETE ==="
        echo "Completion marker found. Stopping loop."
        rm .ralph_complete
        exit 0
    fi

    # Brief pause between iterations
    sleep 2
done

echo ""
echo "=== MAX ITERATIONS REACHED ==="
echo "Completed $MAX_ITERATIONS iterations without completion marker."
