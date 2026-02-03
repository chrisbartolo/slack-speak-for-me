import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  getOrgStyleSettings,
  upsertOrgStyleSettings,
  type OrgStyleData,
} from '@/lib/admin/org-style';

export async function GET() {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    const settings = await getOrgStyleSettings(session.organizationId);

    return NextResponse.json({
      settings: settings || {
        styleMode: 'fallback',
        tone: null,
        formality: null,
        preferredPhrases: [],
        avoidPhrases: [],
        customGuidance: null,
      },
    });
  } catch (error) {
    console.error('Get org style settings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate and upsert (validation happens in service)
    const updated = await upsertOrgStyleSettings(
      session.organizationId,
      body as OrgStyleData
    );

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error('Update org style settings error:', error);

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid settings data', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
