import { eq, and, gte, desc } from 'drizzle-orm';
import { db, refinementFeedback } from '@slack-speak/database';
import { logger } from '../../utils/logger.js';

export interface RefinementEvent {
  workspaceId: string;
  userId: string;
  suggestionId: string;
  original: string;
  modified: string;
  refinementType?: 'tone' | 'length' | 'word_choice' | 'structure';
}

export interface RefinementPatterns {
  /** Phrases user frequently adds to suggestions */
  frequentAdditions: string[];
  /** Phrases user frequently removes from suggestions */
  frequentRemovals: string[];
  /** Detected tone shift direction (e.g., "more_casual", "more_formal") */
  toneShift: string | null;
  /** Average length change ratio (positive = user makes longer, negative = shorter) */
  lengthTrend: number;
  /** Total refinements analyzed */
  sampleSize: number;
}

/**
 * Track a refinement event when user modifies a suggestion
 */
export async function trackRefinement(event: RefinementEvent): Promise<void> {
  // Detect refinement type if not provided
  const refinementType = event.refinementType || detectRefinementType(
    event.original,
    event.modified
  );

  await db.insert(refinementFeedback).values({
    workspaceId: event.workspaceId,
    userId: event.userId,
    suggestionId: event.suggestionId,
    originalText: event.original,
    modifiedText: event.modified,
    refinementType,
  });

  logger.info({
    userId: event.userId,
    refinementType,
  }, 'Tracked refinement event');
}

/**
 * Get refinement patterns from user's history
 * Analyzes last 30 days of refinements
 */
export async function getRefinementPatterns(
  workspaceId: string,
  userId: string
): Promise<RefinementPatterns> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const events = await db
    .select()
    .from(refinementFeedback)
    .where(
      and(
        eq(refinementFeedback.workspaceId, workspaceId),
        eq(refinementFeedback.userId, userId),
        gte(refinementFeedback.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(refinementFeedback.createdAt))
    .limit(100); // Cap at 100 most recent

  if (events.length === 0) {
    return {
      frequentAdditions: [],
      frequentRemovals: [],
      toneShift: null,
      lengthTrend: 0,
      sampleSize: 0,
    };
  }

  // Extract patterns
  const additions: Map<string, number> = new Map();
  const removals: Map<string, number> = new Map();
  let totalLengthChange = 0;
  let toneShiftCount = { formal: 0, casual: 0 };

  for (const event of events) {
    // Compute diff
    const diff = computeDiff(event.originalText, event.modifiedText);

    // Track additions
    for (const phrase of diff.added) {
      const normalized = phrase.toLowerCase().trim();
      if (normalized.length >= 3 && normalized.length <= 50) {
        additions.set(normalized, (additions.get(normalized) || 0) + 1);
      }
    }

    // Track removals
    for (const phrase of diff.removed) {
      const normalized = phrase.toLowerCase().trim();
      if (normalized.length >= 3 && normalized.length <= 50) {
        removals.set(normalized, (removals.get(normalized) || 0) + 1);
      }
    }

    // Track length trend
    totalLengthChange += event.modifiedText.length - event.originalText.length;

    // Detect tone shift
    const toneChange = detectToneChange(event.originalText, event.modifiedText);
    if (toneChange === 'more_formal') toneShiftCount.formal++;
    if (toneChange === 'more_casual') toneShiftCount.casual++;
  }

  // Get phrases appearing 2+ times (threshold for pattern)
  const frequentAdditions = Array.from(additions.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);

  const frequentRemovals = Array.from(removals.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);

  // Determine overall tone shift
  let toneShift: string | null = null;
  if (toneShiftCount.formal > toneShiftCount.casual * 2) {
    toneShift = 'more_formal';
  } else if (toneShiftCount.casual > toneShiftCount.formal * 2) {
    toneShift = 'more_casual';
  }

  return {
    frequentAdditions,
    frequentRemovals,
    toneShift,
    lengthTrend: totalLengthChange / events.length,
    sampleSize: events.length,
  };
}

/**
 * Detect what type of refinement was made
 */
function detectRefinementType(
  original: string,
  modified: string
): 'tone' | 'length' | 'word_choice' | 'structure' {
  const lengthRatio = modified.length / original.length;

  // Significant length change
  if (lengthRatio < 0.7 || lengthRatio > 1.3) {
    return 'length';
  }

  // Check for structural changes (sentence count, punctuation)
  const originalSentences = original.split(/[.!?]+/).length;
  const modifiedSentences = modified.split(/[.!?]+/).length;
  if (Math.abs(originalSentences - modifiedSentences) >= 2) {
    return 'structure';
  }

  // Check for tone indicators
  const formalIndicators = /\b(please|kindly|would you|could you|sincerely|regards)\b/gi;
  const casualIndicators = /\b(hey|hi|thanks|cool|awesome|btw|gonna)\b/gi;

  const origFormal = (original.match(formalIndicators) || []).length;
  const modFormal = (modified.match(formalIndicators) || []).length;
  const origCasual = (original.match(casualIndicators) || []).length;
  const modCasual = (modified.match(casualIndicators) || []).length;

  if (Math.abs(modFormal - origFormal) + Math.abs(modCasual - origCasual) >= 2) {
    return 'tone';
  }

  // Default to word choice
  return 'word_choice';
}

/**
 * Simple diff computation for phrase extraction
 */
function computeDiff(original: string, modified: string): {
  added: string[];
  removed: string[];
} {
  const originalWords = new Set(original.toLowerCase().split(/\s+/));
  const modifiedWords = new Set(modified.toLowerCase().split(/\s+/));

  const added: string[] = [];
  const removed: string[] = [];

  for (const word of modifiedWords) {
    if (!originalWords.has(word) && word.length >= 3) {
      added.push(word);
    }
  }

  for (const word of originalWords) {
    if (!modifiedWords.has(word) && word.length >= 3) {
      removed.push(word);
    }
  }

  return { added, removed };
}

/**
 * Detect if modification shifted tone
 */
function detectToneChange(
  original: string,
  modified: string
): 'more_formal' | 'more_casual' | null {
  const formalIndicators = /\b(please|kindly|would you|could you|sincerely|regards|appreciate)\b/gi;
  const casualIndicators = /\b(hey|hi|thanks|cool|awesome|btw|gonna|yeah|sure)\b/gi;

  const origFormalScore = (original.match(formalIndicators) || []).length;
  const modFormalScore = (modified.match(formalIndicators) || []).length;
  const origCasualScore = (original.match(casualIndicators) || []).length;
  const modCasualScore = (modified.match(casualIndicators) || []).length;

  const formalDelta = modFormalScore - origFormalScore;
  const casualDelta = modCasualScore - origCasualScore;

  if (formalDelta > casualDelta && formalDelta > 0) {
    return 'more_formal';
  }
  if (casualDelta > formalDelta && casualDelta > 0) {
    return 'more_casual';
  }
  return null;
}
