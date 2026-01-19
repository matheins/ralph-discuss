// ============================================================================
// Sample Consensus Responses for Testing
// ============================================================================

export const CONSENSUS_RESPONSE_TEMPLATES = {
  // Properly formatted consensus response (YES)
  structuredYes: `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]
85
[REASONING]
Both Model A and Model B have converged on the same solution.
[PROPOSED_SOLUTION]
The agreed solution is to implement the feature using a modular approach.`,

  // Properly formatted consensus response (NO)
  structuredNo: `[CONSENSUS_CHECK]
HAS_CONSENSUS: NO
[CONFIDENCE]
70
[REASONING]
While there is agreement on the general direction, key differences remain.
[PROPOSED_SOLUTION]
No consensus yet.`,

  // Natural language consensus
  naturalLanguageYes: `After reviewing the discussion, I believe we have reached consensus.
I agree with my partner's assessment that the solution should focus on simplicity.`,

  // Natural language no consensus
  naturalLanguageNo: `I disagree with some of the points raised. While we have made progress,
there are still significant differences in our approaches.`,

  // Ambiguous response
  ambiguous: `The discussion has been productive. There are some points of agreement
and some points where we differ.`,
};
