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
