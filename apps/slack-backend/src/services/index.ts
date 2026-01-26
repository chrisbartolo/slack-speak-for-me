// AI service - response suggestion generation
export { generateSuggestion } from './ai.js';

// Watch service - conversation tracking and thread participation
export {
  watchConversation,
  unwatchConversation,
  isWatching,
  getWatchedConversations,
  recordThreadParticipation,
  isParticipatingInThread,
} from './watch.js';
