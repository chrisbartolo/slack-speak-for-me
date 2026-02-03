import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const { knowledgeBaseDocuments } = schema;

// Validation schema for updating knowledge base documents
const updateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  content: z.string().min(10, 'Content must be at least 10 characters').optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/knowledge-base/[id]
 * Update a knowledge base document
 */
export async function PUT(
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
    const validation = updateDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Update document
    const [updated] = await db
      .update(knowledgeBaseDocuments)
      .set({
        ...data,
        sourceUrl: data.sourceUrl || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeBaseDocuments.id, id),
          eq(knowledgeBaseDocuments.organizationId, admin.organizationId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Note: If content changed, we should re-index the document
    // For now, we'll just update the metadata
    // A background job could periodically re-index updated documents

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error('Update knowledge base document error:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/knowledge-base/[id]
 * Delete a knowledge base document (soft delete)
 */
export async function DELETE(
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

    // Soft delete
    const [deleted] = await db
      .update(knowledgeBaseDocuments)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeBaseDocuments.id, id),
          eq(knowledgeBaseDocuments.organizationId, admin.organizationId)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge base document error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
