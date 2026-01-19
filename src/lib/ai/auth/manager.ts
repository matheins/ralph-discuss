import type { ProviderId, AuthStatus } from '../core/types';
import { providerRegistry } from '../providers/registry';

type KeySource = 'environment' | 'runtime' | 'none';

interface KeyInfo {
  key: string | undefined;
  source: KeySource;
  validatedAt?: number;
  status: AuthStatus;
}

const ENV_VAR_MAP: Record<ProviderId, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: '', // Ollama doesn't require an API key
};

const VALIDATION_CACHE_MS = 5 * 60 * 1000; // 5 minutes

class AuthManager {
  private keys = new Map<ProviderId, KeyInfo>();
  private static instance: AuthManager | null = null;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  initialize(): void {
    const providers: ProviderId[] = ['openai', 'anthropic', 'ollama'];

    for (const providerId of providers) {
      const envVar = ENV_VAR_MAP[providerId];
      const envKey = envVar ? process.env[envVar] : undefined;

      this.keys.set(providerId, {
        key: envKey,
        source: envKey ? 'environment' : 'none',
        status: envKey ? 'unknown' : 'missing',
      });
    }
  }

  getApiKey(providerId: ProviderId): string | undefined {
    return this.keys.get(providerId)?.key;
  }

  setApiKey(providerId: ProviderId, key: string): void {
    this.keys.set(providerId, {
      key,
      source: 'runtime',
      status: 'unknown',
      validatedAt: undefined,
    });

    // Update provider if registered
    const provider = providerRegistry.getOptional(providerId);
    if (provider) {
      provider.setApiKey(key);
    }
  }

  async getAuthStatus(
    providerId: ProviderId,
    forceValidate = false
  ): Promise<AuthStatus> {
    const info = this.keys.get(providerId);

    if (!info || info.source === 'none' || !info.key) {
      return 'missing';
    }

    // Return cached status if valid and not forcing revalidation
    if (
      !forceValidate &&
      info.validatedAt &&
      Date.now() - info.validatedAt < VALIDATION_CACHE_MS &&
      info.status !== 'unknown'
    ) {
      return info.status;
    }

    // Validate with provider
    const provider = providerRegistry.getOptional(providerId);
    if (provider) {
      const status = await provider.validateApiKey(info.key);
      info.status = status;
      info.validatedAt = Date.now();
      return status;
    }

    return info.status;
  }

  getMaskedKey(providerId: ProviderId): string | undefined {
    const key = this.keys.get(providerId)?.key;
    if (!key) return undefined;

    if (key.length <= 8) {
      return '****';
    }

    return '****' + key.slice(-4);
  }

  getKeySource(providerId: ProviderId): KeySource {
    return this.keys.get(providerId)?.source || 'none';
  }

  clearKey(providerId: ProviderId): void {
    this.keys.set(providerId, {
      key: undefined,
      source: 'none',
      status: 'missing',
    });
  }

  getAllStatuses(): Record<ProviderId, { status: AuthStatus; source: KeySource }> {
    const result: Partial<Record<ProviderId, { status: AuthStatus; source: KeySource }>> = {};

    for (const [providerId, info] of this.keys) {
      result[providerId] = {
        status: info.status,
        source: info.source,
      };
    }

    return result as Record<ProviderId, { status: AuthStatus; source: KeySource }>;
  }

  static reset(): void {
    AuthManager.instance = null;
  }
}

export const authManager = AuthManager.getInstance();
export { AuthManager };
