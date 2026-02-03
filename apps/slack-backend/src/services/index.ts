// AI service - response suggestion generation and refinement
export { generateSuggestion, refineSuggestion, UsageLimitExceededError } from './ai.js';

// Usage enforcement - billing limits and tracking
export {
  checkUsageAllowed,
  recordUsageEvent,
  getUsageStatus,
} from './usage-enforcement.js';

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
  getWatchersForChannel,
  isAutoRespondEnabled,
  logAutoResponse,
  undoAutoResponse,
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

// Stripe meter reporter - usage billing integration
export {
  reportUsageToStripe,
  reportUnreportedUsageBatch,
} from './stripe-meter-reporter.js';

// Client profiles - client relationship management
export {
  getClientProfiles,
  getClientProfileById,
  createClientProfile,
  updateClientProfile,
  deleteClientProfile,
  getClientContactBySlackUserId,
  getClientContactsByProfile,
  addClientContact,
  removeClientContact,
} from './client-profiles.js';

// Sentiment detector - conversation tone and tension analysis
export {
  analyzeSentiment,
  type SentimentAnalysis,
} from './sentiment-detector.js';

// Brand voice - organization-level tone and style guidelines
export {
  getBrandVoiceTemplates,
  getBrandVoiceTemplateById,
  createBrandVoiceTemplate,
  updateBrandVoiceTemplate,
  deleteBrandVoiceTemplate,
  getBrandVoiceContext,
} from './brand-voice.js';

// Knowledge base - document indexing and semantic search
export {
  indexDocument,
  searchKnowledgeBase,
  getDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from './knowledge-base.js';

// Escalation monitor - tension detection and admin alerting
export {
  triggerEscalationAlert,
  acknowledgeAlert,
  resolveAlert,
  markFalsePositive,
  getEscalationAlerts,
  getAlertStats,
} from './escalation-monitor.js';

// Guardrails - content filtering and violation logging
export {
  checkAndEnforceGuardrails,
  getGuardrailConfig,
  checkGuardrails,
} from './guardrails.js';

// Org style - organization-level style resolution
export {
  resolveStyleContext,
  checkYoloPermission,
} from './org-style.js';

// Template matcher - relevant template discovery
export {
  findRelevantTemplates,
} from './template-matcher.js';
