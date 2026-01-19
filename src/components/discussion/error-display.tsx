'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DiscussionError } from '@/lib/discussion';

interface ErrorDisplayProps {
  error: DiscussionError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ error, onRetry, onDismiss }: ErrorDisplayProps) {
  const title = getErrorTitle(error.code);
  const description = error.message;
  const canRetry = error.recoverable;

  return (
    <Alert variant="destructive" className="my-4">
      <AlertTitle className="flex items-center gap-2">
        <span>⚠</span>
        {title}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{description}</p>
        <div className="flex gap-2">
          {canRetry && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getErrorTitle(code: string): string {
  switch (code) {
    case 'INITIALIZATION_FAILED':
      return 'Failed to Start';
    case 'TURN_FAILED':
      return 'Response Failed';
    case 'TURN_TIMEOUT':
      return 'Response Timed Out';
    case 'CONSENSUS_PARSE_FAILED':
      return 'Processing Error';
    case 'PROVIDER_ERROR':
      return 'Provider Error';
    case 'STATE_INVALID':
      return 'Internal Error';
    case 'DISCUSSION_TIMEOUT':
      return 'Discussion Timed Out';
    default:
      return 'Error';
  }
}
