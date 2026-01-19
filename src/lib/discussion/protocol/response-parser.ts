import type { ConsensusVote, ParticipantRole } from '../core/types';
import { PROTOCOL } from '../core/constants';
import { ConsensusParseFailed } from '../core/errors';

export interface ParsedConsensusResponse {
  hasConsensus: boolean;
  confidence: number;
  reasoning: string;
  proposedSolution?: string;
}

export function parseConsensusResponse(
  response: string,
  role: ParticipantRole
): ParsedConsensusResponse {
  try {
    const normalized = response.trim();

    // Check for consensus marker
    if (!normalized.includes(PROTOCOL.CONSENSUS_MARKER)) {
      return inferConsensusFromResponse(normalized, role);
    }

    // Extract HAS_CONSENSUS (YES/NO)
    const hasConsensusMatch = normalized.match(/HAS_CONSENSUS:\s*(YES|NO)/i);
    if (!hasConsensusMatch) {
      return inferConsensusFromResponse(normalized, role);
    }
    const hasConsensus = hasConsensusMatch[1].toUpperCase() === 'YES';

    // Extract CONFIDENCE (0-100)
    let confidence = 50;
    const confidenceMatch = normalized.match(
      new RegExp(`${escapeRegex(PROTOCOL.CONFIDENCE_MARKER)}\\s*(\\d+)`, 'i')
    );
    if (confidenceMatch) {
      confidence = Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
    }

    // Extract REASONING
    let reasoning = '';
    const reasoningMatch = normalized.match(
      new RegExp(
        `${escapeRegex(PROTOCOL.REASONING_MARKER)}\\s*([\\s\\S]*?)(?=${escapeRegex(PROTOCOL.SOLUTION_MARKER)}|$)`,
        'i'
      )
    );
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim();
    }

    // Extract PROPOSED_SOLUTION
    let proposedSolution: string | undefined;
    const solutionMatch = normalized.match(
      new RegExp(`${escapeRegex(PROTOCOL.SOLUTION_MARKER)}\\s*([\\s\\S]*)$`, 'i')
    );
    if (solutionMatch) {
      const solution = solutionMatch[1].trim();
      if (solution && !solution.toLowerCase().includes('no consensus') && solution.length > 10) {
        proposedSolution = solution;
      }
    }

    return {
      hasConsensus,
      confidence,
      reasoning,
      proposedSolution: hasConsensus ? proposedSolution : undefined,
    };
  } catch {
    throw new ConsensusParseFailed(role, response);
  }
}

function inferConsensusFromResponse(
  response: string,
  _role: ParticipantRole
): ParsedConsensusResponse {
  const lowerResponse = response.toLowerCase();

  // Strong indicators of consensus
  const consensusIndicators = [
    'we have reached consensus',
    'i agree with',
    'we agree that',
    'consensus has been reached',
    'i concur',
    'the solution is',
    'our agreed solution',
  ];

  // Strong indicators of no consensus
  const noConsensusIndicators = [
    'i disagree',
    'we have not reached',
    'no consensus',
    'still need to discuss',
    'further discussion needed',
    'i think differently',
  ];

  const hasConsensusSignals = consensusIndicators.filter(i => lowerResponse.includes(i)).length;
  const noConsensusSignals = noConsensusIndicators.filter(i => lowerResponse.includes(i)).length;

  const hasConsensus = hasConsensusSignals > noConsensusSignals && hasConsensusSignals > 0;

  return {
    hasConsensus,
    confidence: Math.max(30, Math.min(70, 50 + (hasConsensusSignals - noConsensusSignals) * 10)),
    reasoning: 'Inferred from natural language response (structured format not detected)',
    proposedSolution: hasConsensus ? extractPotentialSolution(response) : undefined,
  };
}

function extractPotentialSolution(response: string): string | undefined {
  const solutionPatterns = [
    /the solution is[:\s]+([^.]+\.)/i,
    /we agree(?:d)? (?:on|that)[:\s]+([^.]+\.)/i,
    /our final answer is[:\s]+([^.]+\.)/i,
  ];

  for (const pattern of solutionPatterns) {
    const match = response.match(pattern);
    if (match && match[1].length > 20) {
      return match[1].trim();
    }
  }

  return undefined;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toConsensusVote(
  parsed: ParsedConsensusResponse,
  role: ParticipantRole
): ConsensusVote {
  return {
    role,
    hasConsensus: parsed.hasConsensus,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    proposedSolution: parsed.proposedSolution,
    timestamp: Date.now(),
  };
}
