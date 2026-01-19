import type { ModelConfig, ProviderId } from '@/types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    description: 'Most capable OpenAI model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai',
    description: 'Fast and cost-effective',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    providerId: 'openai',
    description: 'Previous generation flagship',
  },
  // Anthropic Models
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    providerId: 'anthropic',
    description: 'Balanced performance and speed',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    providerId: 'anthropic',
    description: 'Most capable Claude model',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    description: 'Fast and efficient',
  },
];

export function getModelById(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === modelId);
}

export function getModelsByProvider(providerId: ProviderId): ModelConfig[] {
  return AVAILABLE_MODELS.filter((m) => m.providerId === providerId);
}
