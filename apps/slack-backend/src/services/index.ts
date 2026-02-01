// AI service - response suggestion generation and refinement
export { generateSuggestion, refineSuggestion } from './ai.js';

// Context service - conversation and thread history retrieval
export {
  getConversationContext,
  getThreadContext,
  getContextForMessage,
  type ContextMessage,
} from './context.js';

// Watch service - conversation tracking and thread participation
export {
  watchConversation,
  unwatchConversation,
  isWatching,
  getWatchedConversations,
  recordThreadParticipation,
  isParticipatingInThread,
} from './watch.js';

// Suggestion delivery - ephemeral message with Block Kit
export {
  sendSuggestionEphemeral,
  buildSuggestionBlocks,
} from './suggestion-delivery.js';

// Personalization - user style preferences management
export {
  getStylePreferences,
  upsertStylePreferences,
  deleteStylePreferences,
} from './personalization/index.js';

// Google Sheets - workflow submission read/write
export {
  appendSubmission,
  getSubmissions,
  getSubmissionStatus,
  type WorkflowSubmission,
} from './google-sheets.js';

// Report generator - AI-powered weekly reports
export {
  generateWeeklyReport,
  getMissingSubmitters,
  getReportSettings,
  refineReport,
  type RefineReportOptions,
  type RefineReportResult,
} from './report-generator.js';

// Feedback tracker - suggestion acceptance/refinement/dismissal tracking
export {
  trackFeedback,
  trackAcceptance,
  trackRefinement,
  trackDismissal,
} from './feedback-tracker.js';

// Audit logger - security-relevant event logging
export {
  logAuditEvent,
  auditLogin,
  auditLogout,
  auditDataExport,
  auditDataDeletion,
  auditSettingsChange,
  auditOAuthConnected,
  auditOAuthDisconnected,
  auditSubscriptionCreated,
  auditSubscriptionCancelled,
  type AuditLogEntry,
} from './audit-logger.js';
