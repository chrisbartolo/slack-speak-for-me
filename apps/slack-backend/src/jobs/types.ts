export interface AIResponseJobData {
  workspaceId: string;
  userId: string;
  channelId: string;
  messageTs: string;
  threadTs?: string; // Thread timestamp for replies (used in YOLO mode)
  triggerMessageText: string;
  contextMessages: Array<{
    userId: string;
    text: string;
    ts: string;
  }>;
  triggeredBy: 'mention' | 'reply' | 'thread' | 'message_action' | 'dm';
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

export interface ReportGenerationJobData {
  workspaceId: string;
  userId: string;
  spreadsheetId: string;
  responseUrl?: string; // For slash command acknowledgment
  weekStartDate?: string; // ISO string, defaults to this week's Monday
}

export interface ReportGenerationJobResult {
  success: boolean;
  report?: string;
  missingSubmitters?: string[];
  processingTimeMs?: number;
}

export interface UsageReporterJobData {
  triggeredBy: 'schedule' | 'manual';
}

export interface UsageReporterJobResult {
  total: number;
  reported: number;
  skipped: number;
  failed: number;
}
