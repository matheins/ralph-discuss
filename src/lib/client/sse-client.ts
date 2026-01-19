import type { SSEEvent } from './types';

// ============================================================================
// SSE Event Parsing
// ============================================================================

export function parseSSEEvent(eventType: string, data: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(data);

    switch (eventType) {
      case 'discussion-started':
        return { type: 'discussion-started', data: parsed };
      case 'round-started':
        return { type: 'round-started', data: parsed };
      case 'turn-started':
        return { type: 'turn-started', data: parsed };
      case 'turn-chunk':
        return { type: 'turn-chunk', data: parsed };
      case 'turn-completed':
        return { type: 'turn-completed', data: parsed };
      case 'consensus-check-started':
        return { type: 'consensus-check-started', data: parsed };
      case 'consensus-vote':
        return { type: 'consensus-vote', data: parsed };
      case 'consensus-result':
        return { type: 'consensus-result', data: parsed };
      case 'round-completed':
        return { type: 'round-completed', data: parsed };
      case 'discussion-completed':
        return { type: 'discussion-completed', data: parsed };
      case 'discussion-error':
        return { type: 'discussion-error', data: parsed };
      case 'discussion-aborted':
        return { type: 'discussion-aborted', data: parsed };
      default:
        console.warn(`Unknown SSE event type: ${eventType}`);
        return null;
    }
  } catch (error) {
    console.error('Failed to parse SSE event:', error, { eventType, data });
    return null;
  }
}

// ============================================================================
// SSE Connection Management
// ============================================================================

export interface SSEConnectionOptions {
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class SSEConnection {
  private abortController: AbortController | null = null;
  private closed = false;

  constructor(
    private url: string,
    private options: SSEConnectionOptions
  ) {}

  async connect(body: unknown): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!this.closed) {
        const { done, value } = await reader.read();

        if (done) {
          this.options.onClose();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        const events = this.extractEvents(buffer);
        buffer = events.remaining;

        for (const event of events.parsed) {
          const sseEvent = parseSSEEvent(event.type, event.data);
          if (sseEvent) {
            this.options.onEvent(sseEvent);
          }
        }
      }
    } catch (error) {
      if (!this.closed) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private extractEvents(buffer: string): {
    parsed: Array<{ type: string; data: string }>;
    remaining: string;
  } {
    const parsed: Array<{ type: string; data: string }> = [];
    const lines = buffer.split('\n');

    let currentEvent: { type?: string; data?: string } = {};
    let processedUpTo = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('event: ')) {
        currentEvent.type = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        currentEvent.data = line.slice(6);
      } else if (line === '' && currentEvent.type && currentEvent.data) {
        // Empty line marks end of event
        parsed.push({ type: currentEvent.type, data: currentEvent.data });
        currentEvent = {};
        processedUpTo = lines.slice(0, i + 1).join('\n').length + 1;
      } else if (line.startsWith(':')) {
        // Comment/keep-alive, ignore
        processedUpTo = lines.slice(0, i + 1).join('\n').length + 1;
      }
    }

    return {
      parsed,
      remaining: buffer.slice(processedUpTo),
    };
  }

  close(): void {
    this.closed = true;
    this.abortController?.abort();
  }
}
