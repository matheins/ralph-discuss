import {
  parseConsensusResponse,
  toConsensusVote,
} from '@/lib/discussion/protocol/response-parser';
import { CONSENSUS_RESPONSE_TEMPLATES } from '@/test-utils/fixtures/sample-prompts';

describe('Response Parser', () => {
  describe('parseConsensusResponse', () => {
    describe('structured format parsing', () => {
      it('parses YES consensus correctly', () => {
        const result = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredYes, 'model-a');

        expect(result.hasConsensus).toBe(true);
        expect(result.confidence).toBe(85);
        expect(result.reasoning).toContain('converged');
      });

      it('parses NO consensus correctly', () => {
        const result = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredNo, 'model-b');

        expect(result.hasConsensus).toBe(false);
        expect(result.confidence).toBe(70);
        expect(result.reasoning).toContain('differences remain');
      });

      it('clamps confidence to valid range (max)', () => {
        const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]
150
[REASONING]
Test
[PROPOSED_SOLUTION]
Test solution`;

        const result = parseConsensusResponse(response, 'model-a');
        expect(result.confidence).toBe(100);
      });

      it('uses default confidence when not parseable', () => {
        const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS: YES
[CONFIDENCE]

[REASONING]
Test
[PROPOSED_SOLUTION]
Test solution`;

        const result = parseConsensusResponse(response, 'model-a');
        expect(result.confidence).toBe(50);
      });
    });

    describe('natural language fallback parsing', () => {
      it('infers YES from positive language', () => {
        const result = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.naturalLanguageYes, 'model-a');

        expect(result.hasConsensus).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(30);
        expect(result.confidence).toBeLessThanOrEqual(70);
      });

      it('infers NO from negative language', () => {
        const result = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.naturalLanguageNo, 'model-b');

        expect(result.hasConsensus).toBe(false);
      });

      it('handles ambiguous responses conservatively', () => {
        const result = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.ambiguous, 'model-a');

        expect(result.confidence).toBeGreaterThanOrEqual(30);
        expect(result.confidence).toBeLessThanOrEqual(70);
      });
    });

    describe('edge cases', () => {
      it('handles empty response', () => {
        const result = parseConsensusResponse('', 'model-a');
        expect(result.hasConsensus).toBe(false);
        expect(result.confidence).toBeGreaterThanOrEqual(30);
      });

      it('handles case-insensitive HAS_CONSENSUS', () => {
        const response = `[CONSENSUS_CHECK]
has_consensus: yes
[CONFIDENCE]
80
[REASONING]
Test
[PROPOSED_SOLUTION]
Solution`;

        const result = parseConsensusResponse(response, 'model-a');
        expect(result.hasConsensus).toBe(true);
      });

      it('handles whitespace in values', () => {
        const response = `[CONSENSUS_CHECK]
HAS_CONSENSUS:   YES
[CONFIDENCE]
  75
[REASONING]
Test reasoning
[PROPOSED_SOLUTION]
Solution`;

        const result = parseConsensusResponse(response, 'model-a');
        expect(result.hasConsensus).toBe(true);
        expect(result.confidence).toBe(75);
      });
    });
  });

  describe('toConsensusVote', () => {
    it('converts parsed response to vote object', () => {
      const parsed = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredYes, 'model-a');
      const vote = toConsensusVote(parsed, 'model-a');

      expect(vote.role).toBe('model-a');
      expect(vote.hasConsensus).toBe(true);
      expect(vote.confidence).toBe(85);
      expect(vote.timestamp).toBeGreaterThan(0);
    });

    it('preserves all fields from parsed response', () => {
      const parsed = parseConsensusResponse(CONSENSUS_RESPONSE_TEMPLATES.structuredYes, 'model-b');
      const vote = toConsensusVote(parsed, 'model-b');

      expect(vote.role).toBe('model-b');
      expect(vote.hasConsensus).toBe(parsed.hasConsensus);
      expect(vote.confidence).toBe(parsed.confidence);
      expect(vote.reasoning).toBe(parsed.reasoning);
    });
  });
});
