import { NextRequest, NextResponse } from 'next/server';
import {
  getServerConfig,
  setRuntimeApiKey,
  clearRuntimeApiKey,
  getMaskedApiKey,
  getApiKeyStatus,
} from '@/lib/server/config-manager';
import { validateApiKeyFormat } from '@/lib/config/schema';
import { isKeyMasked } from '@/lib/config/env';

// ============================================================================
// GET - Retrieve Configuration
// ============================================================================

export async function GET() {
  try {
    const config = getServerConfig();

    // Add masked API keys for display
    const maskedKeys = {
      openai: getMaskedApiKey('openai'),
      anthropic: getMaskedApiKey('anthropic'),
    };

    return NextResponse.json({
      ...config,
      maskedApiKeys: maskedKeys,
    });
  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Update Configuration
// ============================================================================

interface ConfigAction {
  action: 'setApiKey' | 'clearApiKey';
  providerId?: 'openai' | 'anthropic';
  key?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfigAction = await request.json();

    switch (body.action) {
      case 'setApiKey': {
        if (!body.providerId || !body.key) {
          return NextResponse.json(
            { error: 'Provider ID and key are required' },
            { status: 400 }
          );
        }

        // Reject masked keys (user didn't change it)
        if (isKeyMasked(body.key)) {
          return NextResponse.json(
            { error: 'Please enter a new API key' },
            { status: 400 }
          );
        }

        // Validate format
        if (!validateApiKeyFormat(body.providerId, body.key)) {
          return NextResponse.json(
            { error: 'Invalid API key format' },
            { status: 400 }
          );
        }

        setRuntimeApiKey(body.providerId, body.key);

        return NextResponse.json({
          success: true,
          status: getApiKeyStatus(body.providerId),
        });
      }

      case 'clearApiKey': {
        if (!body.providerId) {
          return NextResponse.json(
            { error: 'Provider ID is required' },
            { status: 400 }
          );
        }

        clearRuntimeApiKey(body.providerId);

        return NextResponse.json({
          success: true,
          status: getApiKeyStatus(body.providerId),
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Config POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
