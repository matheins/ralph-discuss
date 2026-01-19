'use client';

import { Button } from '@/components/ui/button';
import type { UIPhase } from '@/lib/client/types';

interface DiscussionControlsProps {
  uiPhase: UIPhase;
  canStart: boolean;
  onStart: () => void;
  onAbort: () => void;
  onReset: () => void;
}

export function DiscussionControls({
  uiPhase,
  onAbort,
  onReset,
}: DiscussionControlsProps) {
  if (uiPhase === 'setup') {
    return null; // Start button is in PromptInput
  }

  if (uiPhase === 'connecting' || uiPhase === 'active') {
    return (
      <div className="flex justify-center">
        <Button
          variant="destructive"
          onClick={onAbort}
          className="min-w-[120px]"
        >
          Stop Discussion
        </Button>
      </div>
    );
  }

  if (uiPhase === 'completed' || uiPhase === 'error') {
    return (
      <div className="flex justify-center gap-3">
        <Button
          variant="outline"
          onClick={onReset}
          className="min-w-[120px]"
        >
          New Discussion
        </Button>
      </div>
    );
  }

  return null;
}
