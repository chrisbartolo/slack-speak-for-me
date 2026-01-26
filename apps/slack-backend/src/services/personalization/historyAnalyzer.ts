import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { db, messageEmbeddings } from '@slack-speak/database';
import { requireConsent, ConsentType } from './consentService.js';
import { logger } from '../../utils/logger.js';

export interface MessageExample {
  messageText: string;
  threadContext: string | null;
  similarity: number;
}

export interface WritingPatterns {
  avgMessageLength: number;
  avgSentencesPerMessage: number;
  commonGreetings: string[];
  commonSignoffs: string[];
  punctuationStyle: 'minimal' | 'standard' | 'heavy';
  sampleSize: number;
}

/**
 * Generate embedding for text
 *
 * Note: Using text-embedding-3-small via OpenAI for production since Claude
 * doesn't have a native embedding endpoint. In production, evaluate
 * whether to use OpenAI or Voyage AI embeddings.
 *
 * FALLBACK: For now, use a simple hash-based pseudo-embedding
 * that captures basic text characteristics. Replace with real
 * embedding API when ready.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  // Simple pseudo-embedding based on text characteristics
  // This is a placeholder - replace with real embedding API
  // Dimension: 1536 to match schema
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
 * Store a message embedding for later retrieval
 * Only call this after user has sent a message (not for received messages)
 */
export async function storeMessageEmbedding(params: {
  workspaceId: string;
  userId: string;
  messageText: string;
  threadContext?: string;
}): Promise<void> {
  // Check consent before storing (paranoid check - caller should also verify)
  await requireConsent(params.workspaceId, params.userId, ConsentType.MESSAGE_HISTORY_ANALYSIS);

  // Skip very short messages (not useful for style learning)
  if (params.messageText.length < 20) {
    return;
  }

  const embedding = await generateEmbedding(params.messageText);

  await db.insert(messageEmbeddings).values({
    workspaceId: params.workspaceId,
    userId: params.userId,
    messageText: params.messageText,
    threadContext: params.threadContext || null,
    // Store embedding as JSON string (pgvector handles conversion in raw queries)
    embedding: JSON.stringify(embedding),
  });

  logger.debug({
    userId: params.userId,
    messageLength: params.messageText.length,
  }, 'Stored message embedding');
}

/**
 * Find messages similar to the current context
 * Uses pgvector cosine similarity for semantic search
 */
export async function findSimilarMessages(params: {
  workspaceId: string;
  userId: string;
  contextText: string;
  limit?: number;
}): Promise<MessageExample[]> {
  const limit = params.limit || 5;

  // Check consent
  await requireConsent(params.workspaceId, params.userId, ConsentType.MESSAGE_HISTORY_ANALYSIS);

  // Generate embedding for context
  const contextEmbedding = await generateEmbedding(params.contextText);

  // Query with pgvector similarity
  // Note: The embedding column stores JSON, so we need to cast
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    // Use raw SQL for pgvector operations
    const results = await db.execute(sql`
      SELECT
        message_text,
        thread_context,
        1 - (embedding::vector <=> ${JSON.stringify(contextEmbedding)}::vector) as similarity
      FROM message_embeddings
      WHERE workspace_id = ${params.workspaceId}
        AND user_id = ${params.userId}
        AND created_at > ${ninetyDaysAgo.toISOString()}::timestamp
      ORDER BY embedding::vector <=> ${JSON.stringify(contextEmbedding)}::vector
      LIMIT ${limit}
    `);

    // db.execute with postgres-js returns array-like RowList directly
    const rows = results as unknown as Array<{ message_text: string; thread_context: string | null; similarity: number }>;
    return rows.map(row => ({
      messageText: row.message_text,
      threadContext: row.thread_context,
      similarity: Number(row.similarity) || 0,
    }));
  } catch (error) {
    // If pgvector query fails, fall back to recent messages
    logger.warn({ error }, 'pgvector query failed, falling back to recent messages');

    const fallback = await db
      .select()
      .from(messageEmbeddings)
      .where(
        and(
          eq(messageEmbeddings.workspaceId, params.workspaceId),
          eq(messageEmbeddings.userId, params.userId),
          gte(messageEmbeddings.createdAt, ninetyDaysAgo)
        )
      )
      .orderBy(desc(messageEmbeddings.createdAt))
      .limit(limit);

    return fallback.map(row => ({
      messageText: row.messageText,
      threadContext: row.threadContext,
      similarity: 0.5, // Unknown similarity
    }));
  }
}

/**
 * Analyze writing patterns from message history
 * Extracts aggregate style characteristics
 */
export async function analyzeWritingPatterns(params: {
  workspaceId: string;
  userId: string;
}): Promise<WritingPatterns> {
  // Check consent
  await requireConsent(params.workspaceId, params.userId, ConsentType.MESSAGE_HISTORY_ANALYSIS);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const messages = await db
    .select({
      messageText: messageEmbeddings.messageText,
    })
    .from(messageEmbeddings)
    .where(
      and(
        eq(messageEmbeddings.workspaceId, params.workspaceId),
        eq(messageEmbeddings.userId, params.userId),
        gte(messageEmbeddings.createdAt, ninetyDaysAgo)
      )
    )
    .limit(200);

  if (messages.length === 0) {
    return {
      avgMessageLength: 0,
      avgSentencesPerMessage: 0,
      commonGreetings: [],
      commonSignoffs: [],
      punctuationStyle: 'standard',
      sampleSize: 0,
    };
  }

  // Analyze patterns
  let totalLength = 0;
  let totalSentences = 0;
  const greetings: Map<string, number> = new Map();
  const signoffs: Map<string, number> = new Map();
  let exclamationCount = 0;
  let questionCount = 0;
  let periodCount = 0;

  const greetingPatterns = /^(hi|hey|hello|good morning|good afternoon|good evening)[,!\s]*/i;
  const signoffPatterns = /(best|regards|thanks|thank you|cheers|sincerely)[,!\s]*$/i;

  for (const { messageText } of messages) {
    totalLength += messageText.length;
    totalSentences += (messageText.match(/[.!?]+/g) || []).length || 1;

    // Check for greetings
    const greetingMatch = messageText.match(greetingPatterns);
    if (greetingMatch) {
      const greeting = greetingMatch[1].toLowerCase();
      greetings.set(greeting, (greetings.get(greeting) || 0) + 1);
    }

    // Check for signoffs
    const signoffMatch = messageText.match(signoffPatterns);
    if (signoffMatch) {
      const signoff = signoffMatch[1].toLowerCase();
      signoffs.set(signoff, (signoffs.get(signoff) || 0) + 1);
    }

    // Count punctuation
    exclamationCount += (messageText.match(/!/g) || []).length;
    questionCount += (messageText.match(/\?/g) || []).length;
    periodCount += (messageText.match(/\./g) || []).length;
  }

  // Determine punctuation style
  const punctuationTotal = exclamationCount + questionCount + periodCount;
  const punctuationPerMessage = punctuationTotal / messages.length;
  let punctuationStyle: 'minimal' | 'standard' | 'heavy' = 'standard';
  if (punctuationPerMessage < 1) {
    punctuationStyle = 'minimal';
  } else if (punctuationPerMessage > 3) {
    punctuationStyle = 'heavy';
  }

  return {
    avgMessageLength: Math.round(totalLength / messages.length),
    avgSentencesPerMessage: Math.round((totalSentences / messages.length) * 10) / 10,
    commonGreetings: Array.from(greetings.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([greeting]) => greeting),
    commonSignoffs: Array.from(signoffs.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([signoff]) => signoff),
    punctuationStyle,
    sampleSize: messages.length,
  };
}

/**
 * Get the count of stored messages for a user
 * Useful for determining learning phase (cold start handling)
 */
export async function getMessageHistoryCount(
  workspaceId: string,
  userId: string
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(messageEmbeddings)
    .where(
      and(
        eq(messageEmbeddings.workspaceId, workspaceId),
        eq(messageEmbeddings.userId, userId)
      )
    );

  return Number(result[0]?.count) || 0;
}
