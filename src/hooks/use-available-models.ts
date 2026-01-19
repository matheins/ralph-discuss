'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ModelOption } from '@/lib/client/types';
import type { ProviderId } from '@/lib/ai';

interface UseAvailableModelsReturn {
  models: ModelOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getModelsByProvider: (providerId: ProviderId) => ModelOption[];
}

export function useAvailableModels(): UseAvailableModelsReturn {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/models');

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      setModels(data.models);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch models'));

      // Fallback to hardcoded models if API fails
      setModels(getDefaultModels());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getModelsByProvider = useCallback(
    (providerId: ProviderId): ModelOption[] => {
      return models.filter((m) => m.providerId === providerId);
    },
    [models]
  );

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
    getModelsByProvider,
  };
}

// ============================================================================
// Default Models (Fallback)
// ============================================================================

function getDefaultModels(): ModelOption[] {
  return [
    // OpenAI
    { id: 'gpt-4o', providerId: 'openai', displayName: 'GPT-4o', description: 'Most capable OpenAI model' },
    { id: 'gpt-4o-mini', providerId: 'openai', displayName: 'GPT-4o Mini', description: 'Fast and affordable' },
    { id: 'gpt-4-turbo', providerId: 'openai', displayName: 'GPT-4 Turbo', description: 'High capability with vision' },

    // Anthropic
    { id: 'claude-opus-4-20250514', providerId: 'anthropic', displayName: 'Claude Opus 4', description: 'Most capable Claude model' },
    { id: 'claude-sonnet-4-20250514', providerId: 'anthropic', displayName: 'Claude Sonnet 4', description: 'Balanced performance' },
    { id: 'claude-3-5-sonnet-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Sonnet', description: 'Fast and intelligent' },
    { id: 'claude-3-5-haiku-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Haiku', description: 'Fastest Claude model' },
  ];
}
