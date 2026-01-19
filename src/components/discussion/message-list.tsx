'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { StreamingIndicator } from './streaming-indicator';
import { RoundHeader } from './round-header';
import type { RoundDisplay, StreamingTurn, SelectedModel } from '@/lib/client/types';
import type { DiscussionPhase } from '@/lib/discussion';

interface MessageListProps {
  rounds: RoundDisplay[];
  currentRound: number;
  streamingTurn: StreamingTurn | null;
  serverPhase: DiscussionPhase;
  modelA: SelectedModel;
  modelB: SelectedModel;
}

export function MessageList({
  rounds,
  currentRound,
  streamingTurn,
  serverPhase,
  modelA,
  modelB,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rounds, streamingTurn]);

  const getDisplayName = (role: 'model-a' | 'model-b') => {
    return role === 'model-a' ? modelA.displayName : modelB.displayName;
  };

  const isWaitingForTurn = (role: 'model-a' | 'model-b') => {
    const phase = serverPhase;
    if (role === 'model-a') {
      return phase === 'model-a-turn' || phase === 'consensus-check-a';
    }
    return phase === 'model-b-turn' || phase === 'consensus-check-b';
  };

  return (
    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
      <div className="space-y-4 pb-4">
        {rounds.map((round) => (
          <div key={round.number}>
            <RoundHeader
              roundNumber={round.number}
              consensusResult={round.consensusResult}
              isCurrentRound={round.number === currentRound}
            />

            {/* Model A Turn */}
            {round.modelATurn ? (
              <MessageBubble
                role="model-a"
                displayName={getDisplayName('model-a')}
                content={round.modelATurn.content}
                turn={round.modelATurn}
              />
            ) : streamingTurn?.role === 'model-a' && round.number === currentRound ? (
              <MessageBubble
                role="model-a"
                displayName={getDisplayName('model-a')}
                content={streamingTurn.content}
                isStreaming
              />
            ) : isWaitingForTurn('model-a') && round.number === currentRound ? (
              <StreamingIndicator
                role="model-a"
                displayName={getDisplayName('model-a')}
                phase={serverPhase}
              />
            ) : null}

            {/* Model B Turn */}
            {round.modelBTurn ? (
              <div className="mt-4">
                <MessageBubble
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  content={round.modelBTurn.content}
                  turn={round.modelBTurn}
                />
              </div>
            ) : streamingTurn?.role === 'model-b' && round.number === currentRound ? (
              <div className="mt-4">
                <MessageBubble
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  content={streamingTurn.content}
                  isStreaming
                />
              </div>
            ) : isWaitingForTurn('model-b') && round.number === currentRound && round.modelATurn ? (
              <div className="mt-4">
                <StreamingIndicator
                  role="model-b"
                  displayName={getDisplayName('model-b')}
                  phase={serverPhase}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
