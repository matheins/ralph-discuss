'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProviderId } from '@/lib/ai';

interface ProviderStatus {
  providerId: ProviderId;
  isAvailable: boolean;
  isChecking: boolean;
  modelsCount: number;
  errorMessage?: string;
  lastChecked: number | null;
}

interface UseProviderStatusReturn {
  statuses: Record<ProviderId, ProviderStatus>;
  checkProvider: (providerId: ProviderId) => Promise<void>;
  checkAllProviders: () => Promise<void>;
  isChecking: boolean;
}

const initialStatus = (providerId: ProviderId): ProviderStatus => ({
  providerId,
  isAvailable: false,
  isChecking: false,
  modelsCount: 0,
  lastChecked: null,
});

export function useProviderStatus(): UseProviderStatusReturn {
  const [statuses, setStatuses] = useState<Record<ProviderId, ProviderStatus>>({
    openai: initialStatus('openai'),
    anthropic: initialStatus('anthropic'),
    ollama: initialStatus('ollama'),
  });

  const [isChecking, setIsChecking] = useState(false);

  const checkProvider = useCallback(async (providerId: ProviderId) => {
    setStatuses((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], isChecking: true },
    }));

    try {
      const response = await fetch(`/api/providers/status?provider=${providerId}`);
      const data = await response.json();

      setStatuses((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          isAvailable: data.isAvailable,
          isChecking: false,
          modelsCount: data.modelsCount || 0,
          errorMessage: data.errorMessage,
          lastChecked: Date.now(),
        },
      }));
    } catch (error) {
      setStatuses((prev) => ({
        ...prev,
        [providerId]: {
          providerId,
          isAvailable: false,
          isChecking: false,
          modelsCount: 0,
          errorMessage: 'Failed to check status',
          lastChecked: Date.now(),
        },
      }));
    }
  }, []);

  const checkAllProviders = useCallback(async () => {
    setIsChecking(true);
    await Promise.all([
      checkProvider('openai'),
      checkProvider('anthropic'),
      checkProvider('ollama'),
    ]);
    setIsChecking(false);
  }, [checkProvider]);

  // Check on mount
  useEffect(() => {
    checkAllProviders();
  }, [checkAllProviders]);

  return {
    statuses,
    checkProvider,
    checkAllProviders,
    isChecking,
  };
}
