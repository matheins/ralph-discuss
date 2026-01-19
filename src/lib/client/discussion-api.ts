import type { ProviderId } from '@/lib/ai';
import type { DiscussionOptions } from '@/lib/discussion';

// ============================================================================
// Request Types
// ============================================================================

export interface StartDiscussionRequest {
  prompt: string;
  modelA: {
    modelId: string;
    providerId: ProviderId;
    displayName?: string;
  };
  modelB: {
    modelId: string;
    providerId: ProviderId;
    displayName?: string;
  };
  options?: Partial<DiscussionOptions>;
}

// ============================================================================
// API Client
// ============================================================================

export const discussionApi = {
  /**
   * Get the SSE endpoint URL for starting a discussion
   */
  getDiscussionEndpoint(): string {
    return '/api/discussion';
  },

  /**
   * Validate a discussion request before sending
   */
  validateRequest(request: StartDiscussionRequest): string | null {
    if (!request.prompt?.trim()) {
      return 'Prompt is required';
    }

    if (request.prompt.trim().length < 10) {
      return 'Prompt must be at least 10 characters';
    }

    if (request.prompt.trim().length > 10000) {
      return 'Prompt must be less than 10,000 characters';
    }

    if (!request.modelA?.modelId || !request.modelA?.providerId) {
      return 'Model A must be selected';
    }

    if (!request.modelB?.modelId || !request.modelB?.providerId) {
      return 'Model B must be selected';
    }

    return null;
  },

  /**
   * Build the request body for starting a discussion
   */
  buildRequestBody(
    prompt: string,
    modelA: { modelId: string; providerId: ProviderId; displayName: string },
    modelB: { modelId: string; providerId: ProviderId; displayName: string },
    options?: Partial<DiscussionOptions>
  ): StartDiscussionRequest {
    return {
      prompt: prompt.trim(),
      modelA: {
        modelId: modelA.modelId,
        providerId: modelA.providerId,
        displayName: modelA.displayName,
      },
      modelB: {
        modelId: modelB.modelId,
        providerId: modelB.providerId,
        displayName: modelB.displayName,
      },
      options,
    };
  },
};
