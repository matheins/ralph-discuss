'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CONSENSUS_COLORS } from '@/config/ui-constants';
import type { StoppingReason } from '@/lib/discussion';

interface ConsensusCardProps {
  solution: string;
  achievedAtRound: number;
  stoppingReason: StoppingReason;
}

export function ConsensusCard({
  solution,
  achievedAtRound,
  stoppingReason,
}: ConsensusCardProps) {
  const colors = stoppingReason === 'consensus_reached'
    ? CONSENSUS_COLORS.reached
    : CONSENSUS_COLORS.failed;

  const icon = stoppingReason === 'consensus_reached' ? '✓' : '⚠';
  const title = stoppingReason === 'consensus_reached'
    ? 'Consensus Reached'
    : 'Discussion Ended';

  const subtitle = stoppingReason === 'consensus_reached'
    ? `After ${achievedAtRound} round${achievedAtRound > 1 ? 's' : ''} of discussion`
    : getStoppingReasonText(stoppingReason);

  return (
    <Card className={`${colors.bg} ${colors.border} border-2`}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
          <span className={`text-2xl ${'icon' in colors ? colors.icon : colors.text}`}>{icon}</span>
          <span>{title}</span>
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {subtitle}
        </p>
      </CardHeader>
      <CardContent>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-inner">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {stoppingReason === 'consensus_reached' ? 'Agreed Solution' : 'Final State'}
          </h4>
          <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {solution || 'No solution text available.'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getStoppingReasonText(reason: StoppingReason): string {
  switch (reason) {
    case 'max_iterations':
      return 'Maximum iteration limit reached without consensus';
    case 'user_abort':
      return 'Discussion was stopped by user';
    case 'error':
      return 'Discussion ended due to an error';
    case 'timeout':
      return 'Discussion timed out';
    case 'model_unavailable':
      return 'A model became unavailable';
    default:
      return 'Discussion ended';
  }
}
