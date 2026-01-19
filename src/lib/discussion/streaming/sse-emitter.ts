import type { DiscussionEvent } from '../core/types';
import { toSSEEvent, formatSSE, formatKeepAlive } from './event-types';
import { KEEP_ALIVE_INTERVAL_MS } from '../core/constants';

export class SSEEmitter {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private closed = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static create(): { stream: ReadableStream<Uint8Array>; emitter: SSEEmitter } {
    const emitter = new SSEEmitter();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        emitter.controller = controller;
        emitter.startKeepAlive();
      },
      cancel: () => {
        emitter.close();
      },
    });

    return { stream, emitter };
  }

  emit(event: DiscussionEvent): void {
    if (this.closed || !this.controller) return;

    const sseEvent = toSSEEvent(event);
    const formatted = formatSSE(sseEvent);

    try {
      this.controller.enqueue(this.encoder.encode(formatted));
    } catch {
      this.closed = true;
    }
  }

  emitRaw(eventName: string, data: unknown): void {
    if (this.closed || !this.controller) return;

    const formatted = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    try {
      this.controller.enqueue(this.encoder.encode(formatted));
    } catch {
      this.closed = true;
    }
  }

  emitComment(comment: string): void {
    if (this.closed || !this.controller) return;
    try {
      this.controller.enqueue(this.encoder.encode(`: ${comment}\n\n`));
    } catch {
      this.closed = true;
    }
  }

  emitKeepAlive(): void {
    if (this.closed || !this.controller) return;
    try {
      this.controller.enqueue(this.encoder.encode(formatKeepAlive()));
    } catch {
      this.closed = true;
    }
  }

  close(): void {
    if (this.closed || !this.controller) return;

    this.stopKeepAlive();

    try {
      this.controller.close();
    } catch {
      // Controller may already be closed
    }
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      this.emitKeepAlive();
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}
