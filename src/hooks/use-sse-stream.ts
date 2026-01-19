'use client';

import { useCallback, useRef, useState } from 'react';
import { SSEConnection } from '@/lib/client/sse-client';
import type { SSEEvent } from '@/lib/client/types';

interface UseSSEStreamOptions {
  url: string;
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

interface UseSSEStreamReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: (body: unknown) => Promise<void>;
  disconnect: () => void;
  error: Error | null;
}

export function useSSEStream(options: UseSSEStreamOptions): UseSSEStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connectionRef = useRef<SSEConnection | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async (body: unknown) => {
    // Clean up existing connection
    if (connectionRef.current) {
      connectionRef.current.close();
    }

    setIsConnecting(true);
    setError(null);

    const connection = new SSEConnection(optionsRef.current.url, {
      onEvent: (event) => {
        setIsConnected(true);
        setIsConnecting(false);
        optionsRef.current.onEvent(event);
      },
      onError: (err) => {
        setError(err);
        setIsConnected(false);
        setIsConnecting(false);
        optionsRef.current.onError?.(err);
      },
      onClose: () => {
        setIsConnected(false);
        setIsConnecting(false);
        optionsRef.current.onClose?.();
      },
    });

    connectionRef.current = connection;

    try {
      await connection.connect(body);
    } catch {
      // Error already handled in onError callback
    }
  }, []);

  const disconnect = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    error,
  };
}
