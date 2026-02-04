import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const { kbCandidates, knowledgeBaseDocuments } = schema;

// Validation schema for review actions
const reviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'merge']),
  rejectionReason: z.string().optional(),
  mergeWithId: z.string().uuid().optional(),
});

/**
 * GET /api/admin/kb-candidates/[id]
 * Get a single KB candidate
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const { id } = await params;

    const [candidate] = await db
      .select()
      .from(kbCandidates)
      .where(
        and(
          eq(kbCandidates.id, id),
          eq(kbCandidates.organizationId, admin.organizationId)
        )
      );

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ candidate });
  } catch (error) {
    console.error('Get KB candidate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KB candidate' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/kb-candidates/[id]
 * Perform review actions: approve, reject, or merge
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();

    if (!admin.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validation = reviewActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { action, rejectionReason, mergeWithId } = validation.data;

    // First, verify the candidate exists and belongs to this org
    const [candidate] = await db
      .select()
      .from(kbCandidates)
      .where(
        and(
          eq(kbCandidates.id, id),
          eq(kbCandidates.organizationId, admin.organizationId)
        )
      );

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'approve': {
        // Insert into knowledgeBaseDocuments
        const [publishedDoc] = await db
          .insert(knowledgeBaseDocuments)
          .values({
            organizationId: admin.organizationId,
            title: candidate.title,
            content: candidate.content,
            category: candidate.category,
            tags: candidate.tags,
            embedding: candidate.embedding,
            isActive: true,
          })
          .returning();

        // Update candidate status
        await db
          .update(kbCandidates)
          .set({
            status: 'approved',
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            publishedDocumentId: publishedDoc.id,
            updatedAt: new Date(),
          })
          .where(eq(kbCandidates.id, id));

        return NextResponse.json({
          success: true,
          documentId: publishedDoc.id,
        });
      }

      case 'reject': {
        if (!rejectionReason) {
          return NextResponse.json(
            { error: 'Rejection reason is required' },
            { status: 400 }
          );
        }

        await db
          .update(kbCandidates)
          .set({
            status: 'rejected',
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            rejectionReason,
            updatedAt: new Date(),
          })
          .where(eq(kbCandidates.id, id));

        return NextResponse.json({ success: true });
      }

      case 'merge': {
        if (!mergeWithId) {
          return NextResponse.json(
            { error: 'mergeWithId is required for merge action' },
            { status: 400 }
          );
        }

        // Verify target candidate exists in same organization
        const [targetCandidate] = await db
          .select()
          .from(kbCandidates)
          .where(
            and(
              eq(kbCandidates.id, mergeWithId),
              eq(kbCandidates.organizationId, admin.organizationId)
            )
          );

        if (!targetCandidate) {
          return NextResponse.json(
            { error: 'Target candidate not found' },
            { status: 404 }
          );
        }

        // Add this candidate's acceptance count to target
        await db
          .update(kbCandidates)
          .set({
            acceptanceCount: (targetCandidate.acceptanceCount || 0) + (candidate.acceptanceCount || 0),
            updatedAt: new Date(),
          })
          .where(eq(kbCandidates.id, mergeWithId));

        // Mark this candidate as merged
        await db
          .update(kbCandidates)
          .set({
            status: 'merged',
            mergedIntoId: mergeWithId,
            reviewedBy: admin.userId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(kbCandidates.id, id));

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('KB candidate review action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform review action' },
      { status: 500 }
    );
  }
}
