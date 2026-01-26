// AI service - response suggestion generation
export { generateSuggestion } from './ai.js';

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
