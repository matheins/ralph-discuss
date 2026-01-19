import type { Participant, DiscussionConfig, ParticipantRole } from '../core/types';

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
