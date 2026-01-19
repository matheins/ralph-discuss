'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { DiscussionSettingsConfig } from '@/lib/config/types';
import { PARAMETER_BOUNDS } from '@/lib/config/defaults';
import { PARAMETER_LABELS } from '@/config/settings-constants';

interface DiscussionSettingsProps {
  values: DiscussionSettingsConfig;
  onChange: (updates: Partial<DiscussionSettingsConfig>) => void;
  errors?: Record<string, string>;
}

export function DiscussionSettings({
  values,
  onChange,
}: DiscussionSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Safety Limits */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Safety Limits
        </h4>

        {/* Max Iterations */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.maxIterations.label}</Label>
            <Badge variant="secondary">{values.maxIterations} rounds</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.maxIterations.description}</p>
          <Slider
            value={[values.maxIterations]}
            onValueChange={([v]) => onChange({ maxIterations: v })}
            min={PARAMETER_BOUNDS.maxIterations.min}
            max={PARAMETER_BOUNDS.maxIterations.max}
            step={PARAMETER_BOUNDS.maxIterations.step}
          />
        </div>

        {/* Turn Timeout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.turnTimeoutSeconds.label}</Label>
            <Badge variant="secondary">{values.turnTimeoutSeconds}s</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.turnTimeoutSeconds.description}</p>
          <Slider
            value={[values.turnTimeoutSeconds]}
            onValueChange={([v]) => onChange({ turnTimeoutSeconds: v })}
            min={PARAMETER_BOUNDS.turnTimeoutSeconds.min}
            max={PARAMETER_BOUNDS.turnTimeoutSeconds.max}
            step={PARAMETER_BOUNDS.turnTimeoutSeconds.step}
          />
        </div>

        {/* Total Timeout */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.totalTimeoutMinutes.label}</Label>
            <Badge variant="secondary">{values.totalTimeoutMinutes} min</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.totalTimeoutMinutes.description}</p>
          <Slider
            value={[values.totalTimeoutMinutes]}
            onValueChange={([v]) => onChange({ totalTimeoutMinutes: v })}
            min={PARAMETER_BOUNDS.totalTimeoutMinutes.min}
            max={PARAMETER_BOUNDS.totalTimeoutMinutes.max}
            step={PARAMETER_BOUNDS.totalTimeoutMinutes.step}
          />
        </div>
      </div>

      {/* Consensus Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Consensus Settings
        </h4>

        {/* Min Rounds */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{PARAMETER_LABELS.minRoundsBeforeConsensus.label}</Label>
            <Badge variant="secondary">{values.minRoundsBeforeConsensus}</Badge>
          </div>
          <p className="text-xs text-gray-500">{PARAMETER_LABELS.minRoundsBeforeConsensus.description}</p>
          <Slider
            value={[values.minRoundsBeforeConsensus]}
            onValueChange={([v]) => onChange({ minRoundsBeforeConsensus: v })}
            min={PARAMETER_BOUNDS.minRoundsBeforeConsensus.min}
            max={PARAMETER_BOUNDS.minRoundsBeforeConsensus.max}
            step={PARAMETER_BOUNDS.minRoundsBeforeConsensus.step}
          />
        </div>

        {/* Require Both Consensus */}
        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.requireBothConsensus.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.requireBothConsensus.description}</p>
          </div>
          <Switch
            checked={values.requireBothConsensus}
            onCheckedChange={(v) => onChange({ requireBothConsensus: v })}
          />
        </div>
      </div>

      {/* Display Settings */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Display Settings
        </h4>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.autoScrollEnabled.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.autoScrollEnabled.description}</p>
          </div>
          <Switch
            checked={values.autoScrollEnabled}
            onCheckedChange={(v) => onChange({ autoScrollEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.showTokenUsage.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.showTokenUsage.description}</p>
          </div>
          <Switch
            checked={values.showTokenUsage}
            onCheckedChange={(v) => onChange({ showTokenUsage: v })}
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>{PARAMETER_LABELS.showTimings.label}</Label>
            <p className="text-xs text-gray-500">{PARAMETER_LABELS.showTimings.description}</p>
          </div>
          <Switch
            checked={values.showTimings}
            onCheckedChange={(v) => onChange({ showTimings: v })}
          />
        </div>
      </div>
    </div>
  );
}
