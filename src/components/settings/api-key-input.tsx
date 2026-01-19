'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ApiKeyStatus } from '@/lib/config/types';
import { PROVIDER_LABELS, STATUS_LABELS } from '@/config/settings-constants';

interface ApiKeyInputProps {
  providerId: 'openai' | 'anthropic';
  maskedKey: string | null;
  status: ApiKeyStatus | undefined;
  onSave: (key: string) => Promise<boolean>;
  onClear: () => Promise<void>;
  onValidate: () => Promise<boolean>;
  error?: string;
}

export function ApiKeyInput({
  providerId,
  maskedKey,
  status,
  onSave,
  onClear,
  onValidate,
  error,
}: ApiKeyInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const labels = PROVIDER_LABELS[providerId];

  const handleSave = useCallback(async () => {
    if (!inputValue.trim()) return;

    setIsSaving(true);
    const success = await onSave(inputValue);
    setIsSaving(false);

    if (success) {
      setInputValue('');
      setIsEditing(false);
    }
  }, [inputValue, onSave]);

  const handleValidate = useCallback(async () => {
    setIsValidating(true);
    await onValidate();
    setIsValidating(false);
  }, [onValidate]);

  const handleClear = useCallback(async () => {
    await onClear();
    setInputValue('');
    setIsEditing(false);
  }, [onClear]);

  const getStatusBadge = () => {
    if (!status) return null;

    if (status.isValid === null && status.isConfigured) {
      return <Badge variant="secondary">{STATUS_LABELS.apiKey.configured}</Badge>;
    }

    if (status.isValid === true) {
      return <Badge className="bg-green-100 text-green-800">{STATUS_LABELS.apiKey.valid}</Badge>;
    }

    if (status.isValid === false && status.isConfigured) {
      return <Badge variant="destructive">{STATUS_LABELS.apiKey.invalid}</Badge>;
    }

    return <Badge variant="outline">{STATUS_LABELS.apiKey.notConfigured}</Badge>;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{labels.name}</Label>
        {getStatusBadge()}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {labels.description}
      </p>

      {isEditing || !maskedKey ? (
        <div className="space-y-2">
          <Input
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={labels.keyPlaceholder}
            className={error ? 'border-red-500' : ''}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-xs text-gray-400">
            {labels.keyHint}{' '}
            <a
              href={labels.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Get API key
            </a>
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!inputValue.trim() || isSaving} size="sm">
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            {maskedKey && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input value={maskedKey} disabled className="font-mono" />
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Change
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Validate Key'}
          </Button>
        </div>
      )}
    </div>
  );
}
