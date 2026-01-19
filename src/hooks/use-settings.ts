'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage, STORAGE_KEYS } from './use-local-storage';
import type {
  ModelParametersConfig,
  DiscussionSettingsConfig,
  UIConfig,
  ApiKeyStatus,
} from '@/lib/config/types';
import {
  DEFAULT_MODEL_PARAMETERS,
  DEFAULT_DISCUSSION_SETTINGS,
  DEFAULT_UI_CONFIG,
  MODEL_PARAMETER_PRESETS,
  type PresetName,
} from '@/lib/config/defaults';
import {
  validateConfig,
  partialModelParametersSchema,
  partialDiscussionSettingsSchema,
} from '@/lib/config/schema';

// ============================================================================
// Settings Hook Return Type
// ============================================================================

interface UseSettingsReturn {
  // Model Parameters
  modelParams: ModelParametersConfig;
  updateModelParams: (updates: Partial<ModelParametersConfig>) => void;
  resetModelParams: () => void;
  applyPreset: (preset: PresetName) => void;

  // Discussion Settings
  discussionSettings: DiscussionSettingsConfig;
  updateDiscussionSettings: (updates: Partial<DiscussionSettingsConfig>) => void;
  resetDiscussionSettings: () => void;

  // UI Settings
  uiSettings: UIConfig;
  updateUiSettings: (updates: Partial<UIConfig>) => void;

  // API Key Status (from server)
  apiKeyStatus: Record<string, ApiKeyStatus>;
  refreshApiKeyStatus: () => Promise<void>;
  setApiKey: (providerId: 'openai' | 'anthropic', key: string) => Promise<boolean>;
  clearApiKey: (providerId: 'openai' | 'anthropic') => Promise<void>;
  validateApiKey: (providerId: 'openai' | 'anthropic') => Promise<boolean>;

  // General
  isLoading: boolean;
  validationErrors: Record<string, string>;
  resetAllSettings: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSettings(): UseSettingsReturn {
  // ============================================================================
  // Local Storage State
  // ============================================================================

  const {
    value: modelParams,
    setValue: setModelParams,
    isLoaded: modelParamsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_MODEL_PARAMS,
    defaultValue: DEFAULT_MODEL_PARAMETERS,
  });

  const {
    value: discussionSettings,
    setValue: setDiscussionSettings,
    isLoaded: discussionSettingsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_DISCUSSION,
    defaultValue: DEFAULT_DISCUSSION_SETTINGS,
  });

  const {
    value: uiSettings,
    setValue: setUiSettings,
    isLoaded: uiSettingsLoaded,
  } = useLocalStorage({
    key: STORAGE_KEYS.SETTINGS_UI,
    defaultValue: DEFAULT_UI_CONFIG,
  });

  // ============================================================================
  // Server State
  // ============================================================================

  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, ApiKeyStatus>>({});
  const [isLoadingServer, setIsLoadingServer] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch API key status on mount
  const refreshApiKeyStatus = useCallback(async () => {
    setIsLoadingServer(true);
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setApiKeyStatus(data.apiKeyStatus || {});
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    refreshApiKeyStatus();
  }, [refreshApiKeyStatus]);

  // ============================================================================
  // Model Parameters
  // ============================================================================

  const updateModelParams = useCallback(
    (updates: Partial<ModelParametersConfig>) => {
      const result = validateConfig(partialModelParametersSchema, updates);
      if (!result.success) {
        setValidationErrors((prev) => ({ ...prev, ...result.errors }));
        return;
      }

      setValidationErrors((prev) => {
        const next = { ...prev };
        Object.keys(updates).forEach((key) => delete next[key]);
        return next;
      });

      setModelParams((prev) => ({ ...prev, ...updates }));
    },
    [setModelParams]
  );

  const resetModelParams = useCallback(() => {
    setModelParams(DEFAULT_MODEL_PARAMETERS);
  }, [setModelParams]);

  const applyPreset = useCallback(
    (preset: PresetName) => {
      const presetValues = MODEL_PARAMETER_PRESETS[preset].values;
      setModelParams((prev) => ({ ...prev, ...presetValues }));
    },
    [setModelParams]
  );

  // ============================================================================
  // Discussion Settings
  // ============================================================================

  const updateDiscussionSettings = useCallback(
    (updates: Partial<DiscussionSettingsConfig>) => {
      const result = validateConfig(partialDiscussionSettingsSchema, updates);
      if (!result.success) {
        setValidationErrors((prev) => ({ ...prev, ...result.errors }));
        return;
      }

      setValidationErrors((prev) => {
        const next = { ...prev };
        Object.keys(updates).forEach((key) => delete next[key]);
        return next;
      });

      setDiscussionSettings((prev) => ({ ...prev, ...updates }));
    },
    [setDiscussionSettings]
  );

  const resetDiscussionSettings = useCallback(() => {
    setDiscussionSettings(DEFAULT_DISCUSSION_SETTINGS);
  }, [setDiscussionSettings]);

  // ============================================================================
  // UI Settings
  // ============================================================================

  const updateUiSettings = useCallback(
    (updates: Partial<UIConfig>) => {
      setUiSettings((prev) => ({ ...prev, ...updates }));
    },
    [setUiSettings]
  );

  // ============================================================================
  // API Key Management
  // ============================================================================

  const setApiKey = useCallback(
    async (providerId: 'openai' | 'anthropic', key: string): Promise<boolean> => {
      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'setApiKey', providerId, key }),
        });

        if (response.ok) {
          await refreshApiKeyStatus();
          return true;
        }

        const data = await response.json();
        setValidationErrors((prev) => ({
          ...prev,
          [`apiKey.${providerId}`]: data.error || 'Failed to set API key',
        }));
        return false;
      } catch (error) {
        setValidationErrors((prev) => ({
          ...prev,
          [`apiKey.${providerId}`]: 'Network error',
        }));
        return false;
      }
    },
    [refreshApiKeyStatus]
  );

  const clearApiKey = useCallback(
    async (providerId: 'openai' | 'anthropic'): Promise<void> => {
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clearApiKey', providerId }),
        });
        await refreshApiKeyStatus();
      } catch (error) {
        console.error('Failed to clear API key:', error);
      }
    },
    [refreshApiKeyStatus]
  );

  const validateApiKeyFn = useCallback(
    async (providerId: 'openai' | 'anthropic'): Promise<boolean> => {
      try {
        const response = await fetch('/api/config/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId }),
        });

        const data = await response.json();
        await refreshApiKeyStatus();
        return data.isValid;
      } catch (error) {
        return false;
      }
    },
    [refreshApiKeyStatus]
  );

  // ============================================================================
  // General
  // ============================================================================

  const isLoading = !modelParamsLoaded || !discussionSettingsLoaded || !uiSettingsLoaded || isLoadingServer;

  const resetAllSettings = useCallback(() => {
    setModelParams(DEFAULT_MODEL_PARAMETERS);
    setDiscussionSettings(DEFAULT_DISCUSSION_SETTINGS);
    setUiSettings(DEFAULT_UI_CONFIG);
    setValidationErrors({});
  }, [setModelParams, setDiscussionSettings, setUiSettings]);

  return {
    modelParams,
    updateModelParams,
    resetModelParams,
    applyPreset,

    discussionSettings,
    updateDiscussionSettings,
    resetDiscussionSettings,

    uiSettings,
    updateUiSettings,

    apiKeyStatus,
    refreshApiKeyStatus,
    setApiKey,
    clearApiKey,
    validateApiKey: validateApiKeyFn,

    isLoading,
    validationErrors,
    resetAllSettings,
  };
}
