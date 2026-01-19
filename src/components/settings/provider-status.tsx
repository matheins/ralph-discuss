'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROVIDER_LABELS, STATUS_LABELS } from '@/config/settings-constants';
import type { ProviderId } from '@/lib/ai';

interface ProviderStatusProps {
  providerId: ProviderId;
  isAvailable: boolean;
  isChecking: boolean;
  modelsCount: number;
  errorMessage?: string;
  onRefresh: () => void;
}

export function ProviderStatus({
  providerId,
  isAvailable,
  isChecking,
  modelsCount,
  errorMessage,
  onRefresh,
}: ProviderStatusProps) {
  const labels = PROVIDER_LABELS[providerId];

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            isChecking
              ? 'bg-yellow-500 animate-pulse'
              : isAvailable
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
        />
        <div>
          <p className="font-medium">{labels.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isChecking
              ? STATUS_LABELS.provider.checking
              : isAvailable
              ? `${modelsCount} models available`
              : errorMessage || STATUS_LABELS.provider.unavailable}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isAvailable ? 'default' : 'secondary'}>
          {isChecking
            ? STATUS_LABELS.provider.checking
            : isAvailable
            ? STATUS_LABELS.provider.available
            : STATUS_LABELS.provider.unavailable}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isChecking}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
