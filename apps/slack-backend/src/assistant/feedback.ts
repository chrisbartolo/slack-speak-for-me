/**
 * Build a feedback block for assistant responses.
 * Uses Slack's context_actions block with feedback_buttons element.
 */
export function createFeedbackBlock(suggestionId: string) {
  return {
    type: 'context_actions',
    elements: [
      {
        type: 'feedback_buttons',
        action_id: 'ai_feedback',
        positive_button: {
          text: { type: 'plain_text', text: 'Good' },
          value: JSON.stringify({ suggestionId, feedback: 'positive' }),
          accessibility_label: 'This was a good suggestion',
        },
        negative_button: {
          text: { type: 'plain_text', text: 'Bad' },
          value: JSON.stringify({ suggestionId, feedback: 'negative' }),
          accessibility_label: 'This was a bad suggestion',
        },
      },
    ],
  };
}
