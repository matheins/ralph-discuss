'use client';

import { useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DISCUSSION_DEFAULTS } from '@/config/ui-constants';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isLoading: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  canSubmit,
  isLoading,
}: PromptInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [canSubmit, onSubmit]
  );

  const characterCount = value.length;
  const isOverLimit = characterCount > DISCUSSION_DEFAULTS.maxPromptLength;
  const isTooShort = characterCount < DISCUSSION_DEFAULTS.minPromptLength && characterCount > 0;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Discussion Prompt
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a problem or question for the AI models to discuss and solve together..."
        className="min-h-[120px] resize-y"
        disabled={isLoading}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isTooShort && (
            <span className="text-amber-600 dark:text-amber-400">
              Minimum {DISCUSSION_DEFAULTS.minPromptLength} characters required
            </span>
          )}
          {isOverLimit && (
            <span className="text-red-600 dark:text-red-400">
              Maximum {DISCUSSION_DEFAULTS.maxPromptLength.toLocaleString()} characters
            </span>
          )}
          {!isTooShort && !isOverLimit && (
            <span>
              {characterCount.toLocaleString()} / {DISCUSSION_DEFAULTS.maxPromptLength.toLocaleString()}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">
            {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}
          </kbd> + <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">
            Enter
          </kbd> to start
        </div>
      </div>
      <Button
        onClick={onSubmit}
        disabled={!canSubmit || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <span className="animate-spin mr-2">⟳</span>
            Connecting...
          </>
        ) : (
          'Start Discussion'
        )}
      </Button>
    </div>
  );
}
