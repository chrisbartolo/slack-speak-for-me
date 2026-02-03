import { db, responseTemplates } from '@slack-speak/database';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export interface TemplateMatch {
  id: string;
  name: string;
  content: string;
  score: number;
}

/**
 * Find relevant templates by keyword matching
 * Returns templates scored by keyword overlap with trigger message
 */
export async function findRelevantTemplates(
  organizationId: string,
  triggerMessage: string,
  maxResults: number = 2
): Promise<string> {
  try {
    // Fetch approved templates for org
    const templates = await db
      .select()
      .from(responseTemplates)
      .where(
        and(
          eq(responseTemplates.organizationId, organizationId),
          eq(responseTemplates.status, 'approved')
        )
      );

    if (templates.length === 0) {
      return ''; // No templates available
    }

    // Split trigger message into words (lowercase, filter short words)
    const triggerWords = triggerMessage
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3); // Ignore short words

    if (triggerWords.length === 0) {
      return ''; // No meaningful words to match
    }

    // Score each template by keyword overlap
    const scoredTemplates: TemplateMatch[] = [];

    for (const template of templates) {
      let score = 0;

      // Check name and description for matches (primary signal)
      const templateText = `${template.name} ${template.description || ''}`.toLowerCase();
      for (const triggerWord of triggerWords) {
        if (templateText.includes(triggerWord)) {
          score += 1; // Full point for name/description matches
        }
      }

      // Also check content for matches (secondary signal, lower weight)
      const contentText = template.content.toLowerCase();
      for (const triggerWord of triggerWords) {
        if (contentText.includes(triggerWord)) {
          score += 0.3; // Lower weight for content matches (avoid over-matching)
        }
      }

      // Only include templates with at least 1 match
      if (score >= 1) {
        scoredTemplates.push({
          id: template.id,
          name: template.name,
          content: template.content,
          score,
        });
      }
    }

    // Sort by score descending and take top N
    const topTemplates = scoredTemplates
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    if (topTemplates.length === 0) {
      return ''; // No relevant templates found
    }

    // Format for AI prompt injection
    const formattedTemplates = topTemplates
      .map(template => {
        // Truncate content to first 200 chars for context
        const preview = template.content.length > 200
          ? template.content.slice(0, 200) + '...'
          : template.content;
        return `- **${template.name}**: ${preview}`;
      })
      .join('\n');

    return `\n<response_templates>
Relevant team response templates that may help:
${formattedTemplates}

You may use these templates as inspiration, but adapt them to fit the specific situation.
</response_templates>\n`;
  } catch (error) {
    logger.warn({ error, organizationId }, 'Failed to find relevant templates');
    return ''; // Fail gracefully - templates are optional context
  }
}
