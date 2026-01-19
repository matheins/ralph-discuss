import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { ProviderId } from '@/types';

// Provider factory - returns AI SDK provider instance
export function getProvider(providerId: ProviderId) {
  switch (providerId) {
    case 'openai':
      return openai;
    case 'anthropic':
      return anthropic;
    case 'ollama':
      // Ollama provider setup (if installed)
      throw new Error('Ollama provider not yet configured');
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// Get model instance for AI SDK
export function getModel(providerId: ProviderId, modelId: string) {
  const provider = getProvider(providerId);
  return provider(modelId);
}
