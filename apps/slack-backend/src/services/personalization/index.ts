export {
  getStylePreferences,
  upsertStylePreferences,
  deleteStylePreferences,
} from './preferencesStore.js';

export {
  trackRefinement,
  getRefinementPatterns,
  type RefinementEvent,
  type RefinementPatterns,
} from './feedbackTracker.js';

export {
  hasConsent,
  grantConsent,
  revokeConsent,
  getConsentStatus,
  requireConsent,
  ConsentType,
  ConsentRequiredError,
  type ConsentStatus,
} from './consentService.js';

export {
  storeMessageEmbedding,
  findSimilarMessages,
  analyzeWritingPatterns,
  getMessageHistoryCount,
  type MessageExample,
  type WritingPatterns,
} from './historyAnalyzer.js';
