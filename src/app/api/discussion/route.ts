import { NextRequest } from 'next/server';
import {
  DiscussionEngine,
  SSEEmitter,
  type DiscussionConfig,
  DEFAULT_DISCUSSION_OPTIONS,
} from '@/lib/discussion';
import { providerRegistry, type ProviderId } from '@/lib/ai';

interface StartDiscussionBody {
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
  options?: Partial<typeof DEFAULT_DISCUSSION_OPTIONS>;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: StartDiscussionBody = await request.json();

    // Validate required fields
    if (!body.prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.modelA?.modelId || !body.modelB?.modelId) {
      return new Response(JSON.stringify({ error: 'Both models must be specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body.modelA?.providerId || !body.modelB?.providerId) {
      return new Response(JSON.stringify({ error: 'Provider IDs are required for both models' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate providers are available
    try {
      providerRegistry.get(body.modelA.providerId);
      providerRegistry.get(body.modelB.providerId);
    } catch {
      return new Response(JSON.stringify({ error: 'Provider not available' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build config
    const config: DiscussionConfig = {
      prompt: body.prompt.trim(),
      participants: {
        modelA: {
          role: 'model-a',
          modelId: body.modelA.modelId,
          providerId: body.modelA.providerId,
          displayName: body.modelA.displayName || body.modelA.modelId,
        },
        modelB: {
          role: 'model-b',
          modelId: body.modelB.modelId,
          providerId: body.modelB.providerId,
          displayName: body.modelB.displayName || body.modelB.modelId,
        },
      },
      options: {
        ...DEFAULT_DISCUSSION_OPTIONS,
        ...body.options,
      },
    };

    // Create SSE stream
    const { stream, emitter } = SSEEmitter.create();

    // Create and start discussion engine
    const engine = new DiscussionEngine();

    // Wire up event handler
    const unsubscribe = engine.onEvent((event) => {
      emitter.emit(event);

      // Close stream when discussion ends
      if (
        event.type === 'discussion_completed' ||
        event.type === 'discussion_error' ||
        event.type === 'discussion_aborted'
      ) {
        setTimeout(() => emitter.close(), 100);
      }
    });

    // Start discussion in background
    engine.start(config).catch((error) => {
      console.error('Discussion engine error:', error);
      emitter.emitRaw('error', { message: error instanceof Error ? error.message : 'Unknown error' });
      emitter.close();
    });

    // Handle client disconnect
    request.signal.addEventListener('abort', () => {
      engine.abort();
      unsubscribe();
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('API route error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({
      message: 'Discussion API',
      usage: 'POST with { prompt, modelA: { modelId, providerId }, modelB: { modelId, providerId } }',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
