import { NextRequest, NextResponse } from 'next/server';
import {
  validateApiKey,
  checkOllamaStatus,
  getApiKeyStatus,
} from '@/lib/server/config-manager';

export async function GET(request: NextRequest) {
  const providerId = request.nextUrl.searchParams.get('provider');

  if (!providerId) {
    return NextResponse.json(
      { error: 'Provider ID is required' },
      { status: 400 }
    );
  }

  try {
    if (providerId === 'ollama') {
      const status = await checkOllamaStatus();
      return NextResponse.json({
        providerId: 'ollama',
        isAvailable: status.isAvailable,
        modelsCount: status.modelsAvailable,
        errorMessage: status.errorMessage,
      });
    }

    if (providerId === 'openai' || providerId === 'anthropic') {
      const keyStatus = getApiKeyStatus(providerId);

      if (!keyStatus.isConfigured) {
        return NextResponse.json({
          providerId,
          isAvailable: false,
          modelsCount: 0,
          errorMessage: 'API key not configured',
        });
      }

      const validationResult = await validateApiKey(providerId);

      return NextResponse.json({
        providerId,
        isAvailable: validationResult.isValid,
        modelsCount: validationResult.modelsAvailable || 0,
        errorMessage: validationResult.errorMessage,
      });
    }

    return NextResponse.json(
      { error: 'Unknown provider' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Provider status error:', error);
    return NextResponse.json(
      { error: 'Failed to check provider status' },
      { status: 500 }
    );
  }
}
