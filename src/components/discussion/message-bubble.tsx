'use client';

import { useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MODEL_COLORS } from '@/config/ui-constants';
import type { ParticipantRole, Turn } from '@/lib/discussion';

interface MessageBubbleProps {
  role: ParticipantRole;
  displayName: string;
  content: string;
  isStreaming?: boolean;
  turn?: Turn;
}

export function MessageBubble({
  role,
  displayName,
  content,
  isStreaming = false,
  turn,
}: MessageBubbleProps) {
  const colors = MODEL_COLORS[role];
  const initial = role === 'model-a' ? 'A' : 'B';

  const formattedContent = useMemo(() => {
    // Basic markdown-like formatting
    return content
      .split('\n')
      .map((line, i) => {
        // Handle code blocks (simple)
        if (line.startsWith('```')) {
          return null; // Skip code fence markers
        }

        // Handle bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={i} className="ml-4">
              {line.slice(2)}
            </li>
          );
        }

        // Handle numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <li key={i} className="ml-4 list-decimal">
              {line.slice(numberedMatch[0].length)}
            </li>
          );
        }

        // Regular paragraph
        return line ? (
          <p key={i} className="mb-2 last:mb-0">
            {line}
          </p>
        ) : (
          <br key={i} />
        );
      })
      .filter(Boolean);
  }, [content]);

  return (
    <div className={`flex gap-3 ${role === 'model-b' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <Avatar className={`${colors.avatar} h-8 w-8 shrink-0`}>
        <AvatarFallback className={colors.text}>{initial}</AvatarFallback>
      </Avatar>

      {/* Message Card */}
      <Card
        className={`
          flex-1 max-w-[85%] p-4
          ${colors.bg} ${colors.border} border
          ${isStreaming ? 'animate-pulse' : ''}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${colors.text}`}>
            {displayName}
          </span>
          {turn && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatDuration(turn.durationMs)}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {formattedContent}
          {isStreaming && (
            <span className="inline-block ml-1 animate-pulse">▊</span>
          )}
        </div>

        {/* Footer with token usage */}
        {turn && (
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {turn.tokenUsage.completionTokens.toLocaleString()} tokens
            </Badge>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}
