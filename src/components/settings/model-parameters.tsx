'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ModelParametersConfig } from '@/lib/config/types';
import { PARAMETER_BOUNDS, MODEL_PARAMETER_PRESETS, type PresetName } from '@/lib/config/defaults';
import { PARAMETER_LABELS, PRESET_LABELS } from '@/config/settings-constants';

interface ModelParametersProps {
  values: ModelParametersConfig;
  onChange: (updates: Partial<ModelParametersConfig>) => void;
  onApplyPreset: (preset: PresetName) => void;
  errors?: Record<string, string>;
}

export function ModelParameters({
  values,
  onChange,
  onApplyPreset,
  errors = {},
}: ModelParametersProps) {
  return (
    <div className="space-y-6">
      {/* Presets */}
      <div className="space-y-2">
        <Label>Quick Presets</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MODEL_PARAMETER_PRESETS) as PresetName[]).map((preset) => (
            <TooltipProvider key={preset}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onApplyPreset(preset)}
                  >
                    {PRESET_LABELS[preset].name}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{PRESET_LABELS[preset].description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <ParameterSlider
        id="temperature"
        value={values.temperature}
        onChange={(v) => onChange({ temperature: v })}
        bounds={PARAMETER_BOUNDS.temperature}
        labels={PARAMETER_LABELS.temperature}
        error={errors.temperature}
      />

      {/* Max Tokens */}
      <ParameterSlider
        id="maxTokensPerTurn"
        value={values.maxTokensPerTurn}
        onChange={(v) => onChange({ maxTokensPerTurn: v })}
        bounds={PARAMETER_BOUNDS.maxTokensPerTurn}
        labels={PARAMETER_LABELS.maxTokensPerTurn}
        error={errors.maxTokensPerTurn}
        showInput
      />

      {/* Top P */}
      <ParameterSlider
        id="topP"
        value={values.topP}
        onChange={(v) => onChange({ topP: v })}
        bounds={PARAMETER_BOUNDS.topP}
        labels={PARAMETER_LABELS.topP}
        error={errors.topP}
      />

      {/* Frequency Penalty */}
      <ParameterSlider
        id="frequencyPenalty"
        value={values.frequencyPenalty}
        onChange={(v) => onChange({ frequencyPenalty: v })}
        bounds={PARAMETER_BOUNDS.frequencyPenalty}
        labels={PARAMETER_LABELS.frequencyPenalty}
        error={errors.frequencyPenalty}
      />

      {/* Presence Penalty */}
      <ParameterSlider
        id="presencePenalty"
        value={values.presencePenalty}
        onChange={(v) => onChange({ presencePenalty: v })}
        bounds={PARAMETER_BOUNDS.presencePenalty}
        labels={PARAMETER_LABELS.presencePenalty}
        error={errors.presencePenalty}
      />
    </div>
  );
}

// ============================================================================
// Parameter Slider Subcomponent
// ============================================================================

interface ParameterSliderProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  bounds: { min: number; max: number; step: number };
  labels: { label: string; description: string; tooltip?: string };
  error?: string;
  showInput?: boolean;
}

function ParameterSlider({
  id,
  value,
  onChange,
  bounds,
  labels,
  error,
  showInput = false,
}: ParameterSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor={id} className="cursor-help">
                {labels.label}
              </Label>
            </TooltipTrigger>
            {labels.tooltip && (
              <TooltipContent>
                <p>{labels.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Badge variant="secondary" className="font-mono">
          {value}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {labels.description}
      </p>
      <div className="flex items-center gap-4">
        <Slider
          id={id}
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          className="flex-1"
        />
        {showInput && (
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            className="w-24"
          />
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
