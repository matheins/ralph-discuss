import type { NormalizedMessage, NormalizedRole, ProviderId } from '../core/types';

export function createMessage(
  role: NormalizedRole,
  content: string,
  metadata?: NormalizedMessage['metadata']
): NormalizedMessage {
  return {
    role,
    content,
    metadata: metadata
      ? {
          ...metadata,
          timestamp: metadata.timestamp ?? Date.now(),
        }
      : undefined,
  };
}

export function normalizeMessagesForProvider(
  messages: NormalizedMessage[],
  providerId: ProviderId,
  systemPrompt?: string
): NormalizedMessage[] {
  // Filter out empty messages
  let normalized = messages.filter((m) => {
    if (typeof m.content === 'string') {
      return m.content.trim().length > 0;
    }
    return m.content.length > 0;
  });

  // Convert content blocks to string if needed
  normalized = normalized.map((m) => ({
    ...m,
    content:
      typeof m.content === 'string'
        ? m.content
        : m.content
            .filter((c) => c.type === 'text')
            .map((c) => (c as { type: 'text'; text: string }).text)
            .join('\n'),
  }));

  switch (providerId) {
    case 'anthropic':
      return normalizeForAnthropic(normalized, systemPrompt);
    case 'openai':
    case 'ollama':
    default:
      return normalizeForOpenAI(normalized, systemPrompt);
  }
}

function normalizeForOpenAI(
  messages: NormalizedMessage[],
  systemPrompt?: string
): NormalizedMessage[] {
  const result: NormalizedMessage[] = [];

  // Add system prompt at the beginning if provided
  if (systemPrompt) {
    result.push(createMessage('system', systemPrompt));
  }

  // Add all messages in order
  for (const message of messages) {
    // Skip system messages if we already added the system prompt
    if (message.role === 'system' && systemPrompt) {
      continue;
    }
    result.push(message);
  }

  return result;
}

function normalizeForAnthropic(
  messages: NormalizedMessage[],
  systemPrompt?: string
): NormalizedMessage[] {
  const result: NormalizedMessage[] = [];

  // Anthropic requires system to be first
  if (systemPrompt) {
    result.push(createMessage('system', systemPrompt));
  }

  // Extract any system messages
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  // Add system messages first (after our system prompt)
  if (!systemPrompt) {
    for (const msg of systemMessages) {
      result.push(msg);
    }
  }

  // Anthropic requires alternating user/assistant messages
  // First non-system message must be from user
  let lastRole: NormalizedRole | null = null;

  for (const message of nonSystemMessages) {
    const role = message.role === 'tool' ? 'user' : message.role;

    // If this is the first message and it's not from user, add a placeholder
    if (result.length === systemMessages.length + (systemPrompt ? 1 : 0) && role !== 'user') {
      result.push(createMessage('user', 'Please continue.'));
      lastRole = 'user';
    }

    // If same role as last, merge with previous message
    if (role === lastRole && result.length > 0) {
      const lastMessage = result[result.length - 1];
      const currentContent = typeof message.content === 'string' ? message.content : '';
      const prevContent = typeof lastMessage.content === 'string' ? lastMessage.content : '';
      lastMessage.content = prevContent + '\n\n' + currentContent;
    } else {
      result.push({
        ...message,
        role: role as NormalizedRole,
      });
      lastRole = role as NormalizedRole;
    }
  }

  return result;
}

// Convert AI SDK message format to normalized format
export function toNormalizedMessages(
  aiSdkMessages: Array<{ role: string; content: string }>,
  providerId?: ProviderId,
  modelId?: string
): NormalizedMessage[] {
  return aiSdkMessages.map((m) => ({
    role: m.role as NormalizedRole,
    content: m.content,
    metadata: providerId || modelId ? { providerId, modelId } : undefined,
  }));
}
