'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ConsensusResult } from '@/lib/discussion';

interface RoundHeaderProps {
  roundNumber: number;
  consensusResult?: ConsensusResult;
  isCurrentRound: boolean;
}

export function RoundHeader({
  roundNumber,
  consensusResult,
  isCurrentRound,
}: RoundHeaderProps) {
  const getConsensusBadge = () => {
    if (!consensusResult) {
      return isCurrentRound ? (
        <Badge variant="secondary">In Progress</Badge>
      ) : null;
    }

    if (consensusResult.isUnanimous) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Consensus Reached
        </Badge>
      );
    }

    const aVote = consensusResult.modelAVote.hasConsensus;
    const bVote = consensusResult.modelBVote.hasConsensus;

    return (
      <Badge variant="secondary">
        Votes: A={aVote ? 'Yes' : 'No'}, B={bVote ? 'Yes' : 'No'}
      </Badge>
    );
  };

  return (
    <div className="flex items-center gap-4 py-4">
      <Separator className="flex-1" />
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-600 dark:text-gray-400">
          Round {roundNumber}
        </span>
        {getConsensusBadge()}
      </div>
      <Separator className="flex-1" />
    </div>
  );
}
