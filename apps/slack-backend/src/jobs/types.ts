export interface AIResponseJobData {
  workspaceId: string;
  suggestionId: string;
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
  responseUrl?: string; // From interaction payloads - enables posting directly in DMs
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

export interface KBIndexJobData {
  organizationId: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  sourceUrl?: string;
}

export interface KBIndexJobResult {
  documentId: string;
  chunksCreated: number;
}

export interface EscalationScanJobData {
  triggeredBy: 'scheduler' | 'manual';
}

export interface EscalationScanJobResult {
  organizationsScanned: number;
  alertsCreated: number;
}

export interface DataRetentionJobData {
  triggeredBy: 'schedule' | 'manual';
}

export interface DataRetentionJobResult {
  organizationsProcessed: number;
  feedbackDeleted: number;
  violationsDeleted: number;
  auditLogsDeleted: number;
  errors: number;
}

export interface TrendAggregationJobData {
  triggeredBy: 'schedule' | 'manual';
  targetDate?: string; // ISO date string
}

export interface TrendAggregationJobResult {
  organizationsProcessed: number;
  trendsCreated: number;
  errors: number;
}

export interface KBLearningJobData {
  organizationId: string;
  suggestionId: string;
  suggestionText: string;
  triggerContext: string;
}

export interface KBLearningJobResult {
  candidateId?: string;
  action: 'created' | 'merged' | 'skipped';
}

export interface SatisfactionSurveyJobData {
  triggeredBy: 'schedule' | 'manual';
}

export interface SatisfactionSurveyJobResult {
  usersEligible: number;
  surveysSent: number;
  errors: number;
}

export interface HealthScoreJobData {
  triggeredBy: 'schedule' | 'manual';
  weekStartDate?: string; // ISO date, defaults to previous week
}

export interface HealthScoreJobResult {
  orgsProcessed: number;
  scoresCreated: number;
  errors: number;
}
