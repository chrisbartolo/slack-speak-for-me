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

export interface SheetsWriteJobData {
  workspaceId: string;
  userId: string; // Report owner
  spreadsheetId: string;
  submission: {
    timestamp: string; // ISO string
    submitterName: string;
    submitterSlackId: string;
    achievements: string;
    focus: string;
    blockers: string;
    shoutouts: string;
  };
}

export interface SheetsWriteJobResult {
  success: boolean;
}
