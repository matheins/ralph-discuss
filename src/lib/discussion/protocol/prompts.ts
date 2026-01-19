import type { Participant, DiscussionConfig, ParticipantRole } from '../core/types';

export function buildDiscussionSystemPrompt(
  participant: Participant,
  otherParticipant: Participant,
  config: DiscussionConfig
): string {
  if (participant.role === 'model-a') {
    // Model A doesn't know about the discussion format - just solves the problem directly
    return `You are ${participant.displayName}, an expert problem solver.

Your task is to analyze the following problem and provide your best solution with clear reasoning.

GUIDELINES:
- Be thorough and confident in your analysis
- Provide concrete, actionable solutions
- Explain your reasoning clearly
- Be concise but comprehensive (aim for 200-400 words)

THE PROBLEM:
${config.prompt}`;
  } else {
    // Model B knows it's responding to another perspective
    return `You are ${participant.displayName}, an expert problem solver and critical thinker.

You will be presented with a problem along with an existing analysis. Your role is to:
1. Critically evaluate the given analysis
2. Identify any flaws, gaps, or areas for improvement
3. Provide your own perspective and alternative approaches if warranted
4. Challenge assumptions where appropriate

GUIDELINES:
- Be rigorous in your critique
- Point out specific weaknesses or oversights
- Propose improvements or alternative solutions
- Be concise but thorough (aim for 200-400 words)

THE PROBLEM:
${config.prompt}`;
  }
}

export function buildConsensusSystemPrompt(
  participant: Participant,
  config: DiscussionConfig
): string {
  return `You are ${participant.displayName}. You have been analyzing a problem and responding to critiques.

Your task now is to evaluate whether a strong solution has been reached.

THE ORIGINAL PROBLEM:
${config.prompt}

EVALUATION INSTRUCTIONS:
Review the entire exchange and determine:
1. Has a clear, well-supported solution emerged?
2. Are there still significant unresolved issues?
3. If a solution exists, what is it?

RESPONSE FORMAT (follow exactly):
[CONSENSUS_CHECK]
HAS_CONSENSUS: [YES or NO]
[CONFIDENCE]
[Number from 0-100 indicating your confidence in this assessment]
[REASONING]
[Brief explanation of why you believe a solution has/has not been reached]
[PROPOSED_SOLUTION]
[If HAS_CONSENSUS is YES, state the final solution. If NO, write "No consensus yet."]

IMPORTANT: Only answer YES if you genuinely believe the exchange has produced a solution that effectively addresses the problem.`;
}

export function buildInitialTurnMessage(role: ParticipantRole): string {
  if (role === 'model-a') {
    return `Please provide your analysis and solution to this problem.`;
  } else {
    return `Here is an analysis of the problem. Critically evaluate it and provide your perspective, identifying any flaws, disagreements, or improvements.`;
  }
}

export function buildFollowUpTurnMessage(
  role: ParticipantRole,
  roundNumber: number
): string {
  return `A response to your analysis has been provided. Review the points made and:
1. Defend your position where you believe you are correct
2. Acknowledge valid criticisms if warranted
3. Refine your solution based on compelling arguments
4. Stand firm on points where you have strong evidence

Round ${roundNumber}: Focus on arriving at the best solution through rigorous analysis.`;
}

export function buildConsensusPrompt(roundNumber: number): string {
  return `After ${roundNumber} round(s) of discussion, please evaluate whether consensus has been reached. Follow the response format exactly.`;
}
