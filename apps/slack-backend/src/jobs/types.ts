export interface AIResponseJobData {
  workspaceId: string;
  userId: string;
  channelId: string;
  messageTs: string;
  triggerMessageText: string;
  contextMessages: Array<{
    userId: string;
    text: string;
    ts: string;
  }>;
  triggeredBy: 'mention' | 'reply' | 'thread' | 'message_action';
}

export interface AIResponseJobResult {
  suggestionId: string;
  suggestion: string;
  processingTimeMs: number;
}
