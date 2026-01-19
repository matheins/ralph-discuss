'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ModelOption, SelectedModel } from '@/lib/client/types';
import type { ProviderId } from '@/lib/ai';
import { PROVIDER_DISPLAY_NAMES } from '@/config/ui-constants';

interface ModelSelectorProps {
  label: string;
  models: ModelOption[];
  selectedModel: SelectedModel | null;
  onSelect: (model: SelectedModel) => void;
  disabled?: boolean;
  excludeModelId?: string;
}

export function ModelSelector({
  label,
  models,
  selectedModel,
  onSelect,
  disabled = false,
  excludeModelId,
}: ModelSelectorProps) {
  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<ProviderId, ModelOption[]> = {
      openai: [],
      anthropic: [],
      ollama: [],
    };

    for (const model of models) {
      if (model.id !== excludeModelId) {
        groups[model.providerId]?.push(model);
      }
    }

    return groups;
  }, [models, excludeModelId]);

  const handleValueChange = (value: string) => {
    // Value format: "providerId:modelId"
    const [providerId, modelId] = value.split(':') as [ProviderId, string];
    const model = models.find(
      (m) => m.id === modelId && m.providerId === providerId
    );

    if (model) {
      onSelect({
        modelId: model.id,
        providerId: model.providerId,
        displayName: model.displayName,
      });
    }
  };

  const currentValue = selectedModel
    ? `${selectedModel.providerId}:${selectedModel.modelId}`
    : undefined;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <Select
        value={currentValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedModels).map(([providerId, providerModels]) => {
            if (providerModels.length === 0) return null;

            return (
              <SelectGroup key={providerId}>
                <SelectLabel className="flex items-center gap-2">
                  {PROVIDER_DISPLAY_NAMES[providerId] || providerId}
                  <Badge variant="secondary" className="text-xs">
                    {providerModels.length}
                  </Badge>
                </SelectLabel>
                {providerModels.map((model) => (
                  <SelectItem
                    key={`${model.providerId}:${model.id}`}
                    value={`${model.providerId}:${model.id}`}
                  >
                    <div className="flex flex-col">
                      <span>{model.displayName}</span>
                      {model.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
