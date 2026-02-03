import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const { knowledgeBaseDocuments } = schema;

// Validation schema for creating knowledge base documents
const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

/**
 * Generate embedding for text (hash-based pseudo-embedding)
 * Same approach as slack-backend/services/knowledge-base.ts
 */
async function embedText(text: string): Promise<number[]> {
  const embedding = new Array(1536).fill(0);
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const chars = normalizedText.split('');

  // Feature 1-100: Character frequency
  for (const char of chars) {
    const idx = char.charCodeAt(0) % 100;
    embedding[idx] += 1 / chars.length;
  }

  // Feature 100-200: Word length distribution
  for (const word of words) {
    const idx = 100 + Math.min(word.length, 20) * 5;
    embedding[idx] += 1 / words.length;
  }

  // Feature 200-300: Common word presence
  const commonWords = ['the', 'a', 'is', 'are', 'was', 'were', 'have', 'has',
    'do', 'does', 'will', 'would', 'could', 'should', 'please', 'thanks',
    'hi', 'hey', 'hello', 'best', 'regards', 'sincerely'];
  for (let i = 0; i < commonWords.length; i++) {
    if (normalizedText.includes(commonWords[i])) {
      embedding[200 + i * 4] = 1;
    }
  }

  // Feature 300-400: Punctuation patterns
  const punctuation = ['!', '?', '.', ',', ';', ':', '-', '...'];
  for (let i = 0; i < punctuation.length; i++) {
    const count = (normalizedText.match(new RegExp('\\' + punctuation[i], 'g')) || []).length;
    embedding[300 + i * 10] = count / Math.max(text.length / 50, 1);
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * Chunk text into segments with overlap
 */
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push(chunk);
    start += chunkSize - overlap;

    if (start + chunkSize >= words.length && start < words.length) {
      const lastChunk = words.slice(start).join(' ');
      if (lastChunk.trim()) {
        chunks.push(lastChunk);
      }
      break;
    }
  }

  return chunks;
}

/**
 * GET /api/admin/knowledge-base
 * List all knowledge base documents for admin's organization
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

    const documents = await db
      .select()
      .from(knowledgeBaseDocuments)
      .where(eq(knowledgeBaseDocuments.organizationId, admin.organizationId))
      .orderBy(sql`${knowledgeBaseDocuments.updatedAt} DESC`);

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Get knowledge base documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/knowledge-base
 * Create a new knowledge base document with inline embedding
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
    const validation = createDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Chunk content if large
    const chunks = chunkText(data.content);

    // Insert each chunk as a separate document
    const insertedDocs = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embedText(chunk);

      // Add chunk number to title if multiple chunks
      const chunkTitle = chunks.length > 1
        ? `${data.title} (Part ${i + 1}/${chunks.length})`
        : data.title;

      const [doc] = await db
        .insert(knowledgeBaseDocuments)
        .values({
          organizationId: admin.organizationId,
          title: chunkTitle,
          content: chunk,
          category: data.category,
          tags: data.tags,
          embedding: JSON.stringify(embedding),
          sourceUrl: data.sourceUrl || null,
        })
        .returning();

      insertedDocs.push(doc);
    }

    // Return first chunk as primary document
    return NextResponse.json({
      document: insertedDocs[0],
      chunksCreated: insertedDocs.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Create knowledge base document error:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}
