# Review PR Comments

Review all review comments on the current PR and address them systematically.

## Instructions

1. **Get the current PR**: Use `gh pr view` to identify the current PR number and branch.

2. **Fetch all review comments**: Use the GitHub API to get all review comments:
   ```
   gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
   ```
   Also fetch general PR comments:
   ```
   gh api repos/{owner}/{repo}/issues/{pr_number}/comments
   ```

3. **For each comment**:
   - Read and understand the issue or suggestion raised
   - Navigate to the relevant code location (if applicable)
   - Evaluate whether the issue is valid:
     - Is it a real bug or problem?
     - Is it a style/convention issue that applies to this codebase?
     - Is it a false positive or not applicable?
     - Is it already addressed?

4. **Take action based on evaluation**:
   - **Valid issue**: Fix the code as suggested or in a better way if you see one
   - **Already addressed**: Note that it was already fixed
   - **Invalid/Not applicable**: Comment in the thread explaining why you disagree or why it's not applicable

5. **Resolve threads after addressing them**:
   - After fixing an issue, mark the review thread as resolved using the GraphQL API:
     ```
     # First get unresolved thread IDs
     gh api graphql -f query='
     query {
       repository(owner: "{owner}", name: "{repo}") {
         pullRequest(number: {pr_number}) {
           reviewThreads(first: 50) {
             nodes {
               id
               isResolved
               comments(first: 1) {
                 nodes { body }
               }
             }
           }
         }
       }
     }'

     # Then resolve the thread
     gh api graphql -f query='
     mutation {
       resolveReviewThread(input: {threadId: "THREAD_ID"}) {
         thread { isResolved }
       }
     }'
     ```
   - If you disagree with a comment, add a reply to the thread explaining your reasoning instead of resolving it:
     ```
     gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies -f body="Your explanation here"
     ```

6. **Report summary**: After processing all comments, provide a summary:
   - How many comments were reviewed
   - How many issues were fixed (and threads resolved)
   - How many were already addressed (and threads resolved)
   - How many were disagreed with (and replies added)

## Notes

- Focus on substantive issues (bugs, security, performance) over stylistic nitpicks
- If a reviewer suggests a change that conflicts with project conventions in CLAUDE.md, follow the project conventions
- For complex changes, explain your reasoning before making the fix
- Skip comments that are just acknowledgments or approvals (e.g., "LGTM", "Looks good")
- Always resolve threads after addressing them to keep the PR clean
- When disagreeing with a comment, be respectful and provide clear technical reasoning
