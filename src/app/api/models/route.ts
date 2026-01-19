import { NextResponse } from 'next/server';
import { AVAILABLE_MODELS } from '@/lib/ai/models';
import type { ModelOption } from '@/lib/client/types';

export async function GET() {
  try {
    // Convert AVAILABLE_MODELS to ModelOption format
    const models: ModelOption[] = AVAILABLE_MODELS.map((model) => ({
      id: model.id,
      providerId: model.providerId,
      displayName: model.name,
      description: model.description,
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
