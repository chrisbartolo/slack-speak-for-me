import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const { clientProfiles } = schema;

// Validation schema for creating/updating client profiles
const createClientSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  domain: z.string().optional(),
  servicesProvided: z.array(z.string()).optional(),
  contractDetails: z.string().max(2000, 'Contract details must be 2000 characters or less').optional(),
  accountManager: z.string().optional(),
  relationshipStatus: z.enum(['active', 'at_risk', 'churned']).optional(),
  lifetimeValue: z.number().int().optional(),
  startDate: z.string().optional(), // ISO date string
  renewalDate: z.string().optional(), // ISO date string
});

/**
 * GET /api/admin/clients
 * List all client profiles for admin's organization
 */
export async function GET() {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const profiles = await db
      .select()
      .from(clientProfiles)
      .where(eq(clientProfiles.organizationId, admin.organizationId))
      .orderBy(clientProfiles.updatedAt);

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Get client profiles error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client profiles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients
 * Create a new client profile
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = createClientSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Parse dates if provided
    const startDate = data.startDate ? new Date(data.startDate) : undefined;
    const renewalDate = data.renewalDate ? new Date(data.renewalDate) : undefined;

    const [profile] = await db
      .insert(clientProfiles)
      .values({
        organizationId: admin.organizationId,
        companyName: data.companyName,
        domain: data.domain,
        servicesProvided: data.servicesProvided,
        contractDetails: data.contractDetails,
        accountManager: data.accountManager,
        relationshipStatus: data.relationshipStatus || 'active',
        lifetimeValue: data.lifetimeValue,
        startDate,
        renewalDate,
      })
      .returning();

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('Create client profile error:', error);
    return NextResponse.json(
      { error: 'Failed to create client profile' },
      { status: 500 }
    );
  }
}
