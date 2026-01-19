'use client';

import { useSettings } from '@/hooks/use-settings';
import { useProviderStatus } from '@/hooks/use-provider-status';
import { SettingsSection } from './settings-section';
import { ApiKeyInput } from './api-key-input';
import { ProviderStatus } from './provider-status';
import { ModelParameters } from './model-parameters';
import { DiscussionSettings } from './discussion-settings';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SETTINGS_SECTIONS } from '@/config/settings-constants';

export function SettingsPanel() {
  const {
    modelParams,
    updateModelParams,
    resetModelParams,
    applyPreset,
    discussionSettings,
    updateDiscussionSettings,
    resetDiscussionSettings,
    apiKeyStatus,
    setApiKey,
    clearApiKey,
    validateApiKey,
    isLoading,
    validationErrors,
  } = useSettings();

  const { statuses: providerStatuses, checkProvider } = useProviderStatus();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="apiKeys" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="model">Model</TabsTrigger>
        <TabsTrigger value="discussion">Discussion</TabsTrigger>
      </TabsList>

      {/* API Keys Tab */}
      <TabsContent value="apiKeys" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.apiKeys.title}
          description={SETTINGS_SECTIONS.apiKeys.description}
        >
          <div className="space-y-6">
            <ApiKeyInput
              providerId="openai"
              maskedKey={apiKeyStatus.openai?.isConfigured ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : null}
              status={apiKeyStatus.openai}
              onSave={(key) => setApiKey('openai', key)}
              onClear={() => clearApiKey('openai')}
              onValidate={() => validateApiKey('openai')}
              error={validationErrors['apiKey.openai']}
            />
            <ApiKeyInput
              providerId="anthropic"
              maskedKey={apiKeyStatus.anthropic?.isConfigured ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : null}
              status={apiKeyStatus.anthropic}
              onSave={(key) => setApiKey('anthropic', key)}
              onClear={() => clearApiKey('anthropic')}
              onValidate={() => validateApiKey('anthropic')}
              error={validationErrors['apiKey.anthropic']}
            />
          </div>
        </SettingsSection>
      </TabsContent>

      {/* Providers Tab */}
      <TabsContent value="providers" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.providers.title}
          description={SETTINGS_SECTIONS.providers.description}
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <ProviderStatus
              providerId="openai"
              isAvailable={providerStatuses.openai.isAvailable}
              isChecking={providerStatuses.openai.isChecking}
              modelsCount={providerStatuses.openai.modelsCount}
              errorMessage={providerStatuses.openai.errorMessage}
              onRefresh={() => checkProvider('openai')}
            />
            <ProviderStatus
              providerId="anthropic"
              isAvailable={providerStatuses.anthropic.isAvailable}
              isChecking={providerStatuses.anthropic.isChecking}
              modelsCount={providerStatuses.anthropic.modelsCount}
              errorMessage={providerStatuses.anthropic.errorMessage}
              onRefresh={() => checkProvider('anthropic')}
            />
            <ProviderStatus
              providerId="ollama"
              isAvailable={providerStatuses.ollama.isAvailable}
              isChecking={providerStatuses.ollama.isChecking}
              modelsCount={providerStatuses.ollama.modelsCount}
              errorMessage={providerStatuses.ollama.errorMessage}
              onRefresh={() => checkProvider('ollama')}
            />
          </div>
        </SettingsSection>
      </TabsContent>

      {/* Model Parameters Tab */}
      <TabsContent value="model" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.modelParameters.title}
          description={SETTINGS_SECTIONS.modelParameters.description}
          onReset={resetModelParams}
        >
          <ModelParameters
            values={modelParams}
            onChange={updateModelParams}
            onApplyPreset={applyPreset}
            errors={validationErrors}
          />
        </SettingsSection>
      </TabsContent>

      {/* Discussion Settings Tab */}
      <TabsContent value="discussion" className="space-y-4 mt-4">
        <SettingsSection
          title={SETTINGS_SECTIONS.discussionSettings.title}
          description={SETTINGS_SECTIONS.discussionSettings.description}
          onReset={resetDiscussionSettings}
        >
          <DiscussionSettings
            values={discussionSettings}
            onChange={updateDiscussionSettings}
            errors={validationErrors}
          />
        </SettingsSection>
      </TabsContent>
    </Tabs>
  );
}
