import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  getGuardrailConfig,
  upsertGuardrailConfig,
  PREDEFINED_CATEGORIES,
} from '@/lib/admin/guardrails';

/**
 * GET /api/admin/guardrails
 * Returns guardrail config and predefined categories
 */
export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const config = await getGuardrailConfig(session.organizationId);

    return NextResponse.json({
      config,
      predefinedCategories: PREDEFINED_CATEGORIES,
    });
  } catch (error) {
    console.error('Error fetching guardrail config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guardrail configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/guardrails
 * Updates guardrail configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { enabledCategories, blockedKeywords, triggerMode } = body;

    // Validate required fields
    if (!Array.isArray(enabledCategories)) {
      return NextResponse.json(
        { error: 'enabledCategories must be an array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(blockedKeywords)) {
      return NextResponse.json(
        { error: 'blockedKeywords must be an array' },
        { status: 400 }
      );
    }

    if (!triggerMode) {
      return NextResponse.json(
        { error: 'triggerMode is required' },
        { status: 400 }
      );
    }

    const updated = await upsertGuardrailConfig(session.organizationId, {
      enabledCategories,
      blockedKeywords,
      triggerMode,
    });

    return NextResponse.json({ config: updated });
  } catch (error) {
    console.error('Error updating guardrail config:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update guardrail configuration' },
      { status: 500 }
    );
  }
}
