import { db, knowledgeBaseDocuments } from '@slack-speak/database';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Generate embedding for text
 *
 * Uses hash-based pseudo-embedding (same approach as historyAnalyzer.ts)
 * that captures basic text characteristics. This is a placeholder approach
 * that works for similarity ranking; a real embedding API can replace it later.
 *
 * Dimension: 1536 to match schema
 */
async function embedText(text: string): Promise<number[]> {
  // Simple pseudo-embedding based on text characteristics
  const embedding = new Array(1536).fill(0);

  // Hash various text features into the embedding
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
 *
 * @param text - Text to chunk
 * @param chunkSize - Words per chunk (default: 500)
 * @param overlap - Overlap words (default: 50)
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

    // Move forward by chunkSize - overlap
    start += chunkSize - overlap;

    // If we're close to the end, just include remaining words in last chunk
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
 * Index a document with embedding
 *
 * Large documents (>500 words) are chunked into 500-word segments with 50-word overlap.
 * Each chunk is stored as a separate row with the same title prefix.
 */
export async function indexDocument(params: {
  organizationId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  sourceUrl?: string;
}): Promise<string> {
  const chunks = chunkText(params.content);

  logger.info({
    organizationId: params.organizationId,
    title: params.title,
    chunks: chunks.length,
  }, 'Indexing document');

  // Insert each chunk as a separate document
  const insertedIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await embedText(chunk);

    // Add chunk number to title if multiple chunks
    const chunkTitle = chunks.length > 1
      ? `${params.title} (Part ${i + 1}/${chunks.length})`
      : params.title;

    const [inserted] = await db.insert(knowledgeBaseDocuments).values({
      organizationId: params.organizationId,
      title: chunkTitle,
      content: chunk,
      category: params.category,
      tags: params.tags,
      embedding: JSON.stringify(embedding),
      sourceUrl: params.sourceUrl,
    }).returning({ id: knowledgeBaseDocuments.id });

    insertedIds.push(inserted.id);
  }

  logger.info({
    organizationId: params.organizationId,
    documentIds: insertedIds,
  }, 'Document indexed successfully');

  // Return first chunk ID as the primary document ID
  return insertedIds[0];
}

/**
 * Search knowledge base using semantic similarity
 *
 * @param params.organizationId - Organization ID
 * @param params.query - Search query
 * @param params.limit - Max results (default: 3)
 * @param params.timeout - Timeout in ms (default: 500)
 */
export async function searchKnowledgeBase(params: {
  organizationId: string;
  query: string;
  limit?: number;
  timeout?: number;
}): Promise<Array<{ id: string; title: string; content: string; similarity: number }>> {
  const limit = params.limit || 3;
  const timeout = params.timeout || 500;

  // Generate embedding for query
  const queryEmbedding = await embedText(params.query);

  // Create timeout promise
  const timeoutPromise = new Promise<Array<{ id: string; title: string; content: string; similarity: number }>>((resolve) => {
    setTimeout(() => {
      logger.warn({
        organizationId: params.organizationId,
        query: params.query,
        timeout,
      }, 'Knowledge base search timed out');
      resolve([]);
    }, timeout);
  });

  // Create search promise
  const searchPromise = (async () => {
    try {
      // Use raw SQL for pgvector operations
      const results = await db.execute(sql`
        SELECT
          id,
          title,
          content,
          1 - (embedding::vector <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
        FROM knowledge_base_documents
        WHERE organization_id = ${params.organizationId}
          AND is_active = true
        ORDER BY embedding::vector <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `);

      const rows = results as unknown as Array<{
        id: string;
        title: string;
        content: string;
        similarity: number;
      }>;

      return rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        similarity: Number(row.similarity) || 0,
      }));
    } catch (error) {
      logger.error({
        error,
        organizationId: params.organizationId,
        query: params.query,
      }, 'Knowledge base search failed');
      return [];
    }
  })();

  // Race between search and timeout
  return Promise.race([searchPromise, timeoutPromise]);
}

/**
 * Get all documents for an organization
 */
export async function getDocuments(organizationId: string) {
  return db
    .select()
    .from(knowledgeBaseDocuments)
    .where(eq(knowledgeBaseDocuments.organizationId, organizationId))
    .orderBy(sql`${knowledgeBaseDocuments.updatedAt} DESC`);
}

/**
 * Get a single document by ID with org check
 */
export async function getDocumentById(id: string, organizationId: string) {
  const [doc] = await db
    .select()
    .from(knowledgeBaseDocuments)
    .where(
      and(
        eq(knowledgeBaseDocuments.id, id),
        eq(knowledgeBaseDocuments.organizationId, organizationId)
      )
    )
    .limit(1);

  return doc || null;
}

/**
 * Update a document
 *
 * If content changes, caller should re-index by queueing a background job
 */
export async function updateDocument(
  id: string,
  organizationId: string,
  data: Partial<{
    title: string;
    content: string;
    category: string;
    tags: string[];
    isActive: boolean;
  }>
) {
  const [updated] = await db
    .update(knowledgeBaseDocuments)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(knowledgeBaseDocuments.id, id),
        eq(knowledgeBaseDocuments.organizationId, organizationId)
      )
    )
    .returning();

  return updated;
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(id: string, organizationId: string) {
  const [deleted] = await db
    .update(knowledgeBaseDocuments)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(knowledgeBaseDocuments.id, id),
        eq(knowledgeBaseDocuments.organizationId, organizationId)
      )
    )
    .returning();

  return deleted;
}
