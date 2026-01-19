import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/server/config-manager';

export async function POST(request: NextRequest) {
  try {
    const { providerId } = await request.json();

    if (!providerId || !['openai', 'anthropic'].includes(providerId)) {
      return NextResponse.json(
        { error: 'Invalid provider ID' },
        { status: 400 }
      );
    }

    const result = await validateApiKey(providerId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
}
