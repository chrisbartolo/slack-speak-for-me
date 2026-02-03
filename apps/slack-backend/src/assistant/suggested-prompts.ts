interface SuggestedPrompt {
  title: string;
  message: string;
}

/**
 * Generate context-aware suggested prompts based on the channel the user is viewing.
 */
export function generateSuggestedPrompts(context: { channel_id?: string }): SuggestedPrompt[] {
  const { channel_id } = context;

  if (channel_id?.startsWith('D')) {
    // DM context
    return [
      { title: 'Professional tone', message: 'Help me respond professionally to this message' },
      { title: 'Empathetic reply', message: 'Help me write an empathetic response' },
      { title: 'De-escalate', message: 'Help me de-escalate this conversation' },
    ];
  }

  if (channel_id?.startsWith('C') || channel_id?.startsWith('G')) {
    // Channel or group context
    return [
      { title: 'Suggest response', message: 'Suggest a response to the latest message' },
      { title: 'Join discussion', message: 'Help me contribute to this discussion' },
      { title: 'Summarize', message: 'Summarize the key points in this conversation' },
    ];
  }

  // No channel context (generic)
  return [
    { title: 'Professional message', message: 'Help me craft a professional message' },
    { title: 'Rewrite concisely', message: 'Help me rewrite this more concisely' },
    { title: 'Difficult message', message: 'Help me respond to a difficult workplace message' },
  ];
}
