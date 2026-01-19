'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { MODEL_COLORS, STATUS_MESSAGES } from '@/config/ui-constants';
import type { ParticipantRole, DiscussionPhase } from '@/lib/discussion';

interface StreamingIndicatorProps {
  role: ParticipantRole;
  displayName: string;
  phase: DiscussionPhase;
}

export function StreamingIndicator({
  role,
  displayName,
  phase,
}: StreamingIndicatorProps) {
  const colors = MODEL_COLORS[role];
  const initial = role === 'model-a' ? 'A' : 'B';
  const statusMessage = STATUS_MESSAGES[phase] || 'Processing...';

  return (
    <div className={`flex gap-3 ${role === 'model-b' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar with pulse animation */}
      <Avatar className={`${colors.avatar} h-8 w-8 shrink-0 animate-pulse`}>
        <AvatarFallback className={colors.text}>{initial}</AvatarFallback>
      </Avatar>

      {/* Thinking indicator */}
      <Card className={`flex-1 max-w-[85%] p-4 ${colors.bg} ${colors.border} border`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${colors.text}`}>
            {displayName}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ThinkingDots />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {statusMessage}
          </span>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Thinking Dots Animation
// ============================================================================

function ThinkingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"
          style={{
            animation: 'bounce 1.4s infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
