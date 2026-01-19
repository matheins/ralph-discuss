'use client';

import { useDiscussion } from '@/hooks/use-discussion';
import { useAvailableModels } from '@/hooks/use-available-models';
import { ModelSelector } from './model-selector';
import { PromptInput } from './prompt-input';
import { MessageList } from './message-list';
import { ConsensusCard } from './consensus-card';
import { DiscussionControls } from './discussion-controls';
import { ErrorDisplay } from './error-display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LAYOUT } from '@/config/ui-constants';

export function DiscussionContainer() {
  const {
    state,
    setPrompt,
    setModelA,
    setModelB,
    startDiscussion,
    abortDiscussion,
    resetDiscussion,
    canStart,
    isConnecting,
  } = useDiscussion();

  const { models, isLoading: modelsLoading } = useAvailableModels();

  // ============================================================================
  // Setup Phase UI
  // ============================================================================

  if (state.uiPhase === 'setup') {
    return (
      <div className={`${LAYOUT.containerPadding} ${LAYOUT.maxMessageWidth} mx-auto py-8`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">ralph-discuss</CardTitle>
            <p className="text-gray-600 dark:text-gray-400">
              Select two AI models and enter a prompt. The models will discuss and
              collaborate to find the best solution.
            </p>
          </CardHeader>
          <CardContent className={LAYOUT.sectionGap}>
            {/* Model Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelsLoading ? (
                <>
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </>
              ) : (
                <>
                  <ModelSelector
                    label="Model A"
                    models={models}
                    selectedModel={state.modelA}
                    onSelect={setModelA}
                    excludeModelId={state.modelB?.modelId}
                  />
                  <ModelSelector
                    label="Model B"
                    models={models}
                    selectedModel={state.modelB}
                    onSelect={setModelB}
                    excludeModelId={state.modelA?.modelId}
                  />
                </>
              )}
            </div>

            {/* Prompt Input */}
            <PromptInput
              value={state.prompt}
              onChange={setPrompt}
              onSubmit={startDiscussion}
              canSubmit={canStart}
              isLoading={isConnecting}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Active/Completed Phase UI
  // ============================================================================

  return (
    <div className={`${LAYOUT.containerPadding} h-full flex flex-col py-4`}>
      {/* Header with prompt summary */}
      <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mb-4`}>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-medium text-gray-800 dark:text-gray-200">
                Discussion Topic
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {state.prompt}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{state.modelA?.displayName}</span>
              <span>vs</span>
              <span>{state.modelB?.displayName}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full`}>
          <ErrorDisplay
            error={state.error}
            onRetry={state.error.recoverable ? startDiscussion : undefined}
            onDismiss={resetDiscussion}
          />
        </div>
      )}

      {/* Message List */}
      {state.modelA && state.modelB && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full flex-1 min-h-0`}>
          <MessageList
            rounds={state.rounds}
            currentRound={state.currentRound}
            streamingTurn={state.streamingTurn}
            serverPhase={state.serverPhase}
            modelA={state.modelA}
            modelB={state.modelB}
          />
        </div>
      )}

      {/* Consensus Card */}
      {state.uiPhase === 'completed' && state.stoppingReason && (
        <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mt-4`}>
          <ConsensusCard
            solution={state.finalConsensus?.solution || getLastRoundSummary(state)}
            achievedAtRound={state.finalConsensus?.achievedAtRound || state.currentRound}
            stoppingReason={state.stoppingReason}
          />
        </div>
      )}

      {/* Controls */}
      <div className={`${LAYOUT.maxMessageWidth} mx-auto w-full mt-4`}>
        <DiscussionControls
          uiPhase={state.uiPhase}
          canStart={canStart}
          onStart={startDiscussion}
          onAbort={abortDiscussion}
          onReset={resetDiscussion}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getLastRoundSummary(state: { rounds: Array<{ modelATurn?: { content: string }; modelBTurn?: { content: string } }> }): string {
  const lastRound = state.rounds[state.rounds.length - 1];
  if (!lastRound) return 'No discussion content.';

  const lastTurn = lastRound.modelBTurn || lastRound.modelATurn;
  if (!lastTurn) return 'No discussion content.';

  // Return last 500 characters as summary
  const content = lastTurn.content;
  if (content.length <= 500) return content;
  return '...' + content.slice(-500);
}
