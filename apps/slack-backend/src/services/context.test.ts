import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebClient } from '@slack/web-api';
import {
  getConversationContext,
  getThreadContext,
  getContextForMessage,
} from './context.js';

// Mock the logger to prevent console output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the limiter to prevent test timeouts from rate limiting
vi.mock('limiter', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    removeTokens: vi.fn().mockResolvedValue(10), // Always return positive tokens remaining
  })),
}));

describe('Context Service', () => {
  let mockClient: WebClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      conversations: {
        history: vi.fn().mockResolvedValue({
          ok: true,
          messages: [
            { type: 'message', user: 'U123', text: 'Hello', ts: '1234567890.000001' },
            { type: 'message', user: 'U456', text: 'World', ts: '1234567891.000002' },
          ],
        }),
        replies: vi.fn().mockResolvedValue({
          ok: true,
          messages: [
            { type: 'message', user: 'U123', text: 'Thread start', ts: '1234567890.000001' },
            { type: 'message', user: 'U456', text: 'Reply', ts: '1234567891.000002' },
          ],
        }),
      },
    } as unknown as WebClient;
  });

  describe('getConversationContext', () => {
    it('should fetch channel history and return formatted messages', async () => {
      const result = await getConversationContext(mockClient, 'C123');

      expect(mockClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123' })
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('ts');
    });

    it('should return messages in chronological order (reversed from API)', async () => {
      const result = await getConversationContext(mockClient, 'C123');

      // API returns newest first, we reverse to oldest first (chronological)
      expect(result[0].userId).toBe('U456'); // Second message from API comes first after reverse
      expect(result[1].userId).toBe('U123'); // First message from API comes second after reverse
    });

    it('should filter out bot messages', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Human message', ts: '1234567890.000001' },
          { type: 'message', bot_id: 'B456', text: 'Bot message', ts: '1234567891.000002' },
          { type: 'message', user: 'U789', text: 'Another human', ts: '1234567892.000003' },
        ],
      });

      const result = await getConversationContext(mockClient, 'C123');

      expect(result).toHaveLength(2);
      expect(result.every(m => m.userId !== 'unknown')).toBe(true);
      expect(result.find(m => m.text === 'Bot message')).toBeUndefined();
    });

    it('should respect maxMessages option', async () => {
      await getConversationContext(mockClient, 'C123', { maxMessages: 5 });

      expect(mockClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 })
      );
    });

    it('should respect contextWindowMinutes option', async () => {
      const beforeCall = Date.now();
      await getConversationContext(mockClient, 'C123', { contextWindowMinutes: 30 });
      const afterCall = Date.now();

      const call = (mockClient.conversations.history as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const oldestTimestamp = parseFloat(call.oldest);
      const oldestDate = oldestTimestamp * 1000;

      // Oldest should be approximately 30 minutes before now
      const expectedOldest = beforeCall - 30 * 60 * 1000;
      expect(oldestDate).toBeGreaterThanOrEqual(expectedOldest - 1000); // 1s tolerance
      expect(oldestDate).toBeLessThanOrEqual(afterCall - 30 * 60 * 1000 + 1000);
    });

    it('should return empty array on API failure with ok: false', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      });

      const result = await getConversationContext(mockClient, 'C123');

      expect(result).toEqual([]);
    });

    it('should handle empty messages array', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [],
      });

      const result = await getConversationContext(mockClient, 'C123');

      expect(result).toEqual([]);
    });

    it('should throw on API exception', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await expect(getConversationContext(mockClient, 'C123')).rejects.toThrow('Network error');
    });

    it('should filter out messages without text', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Has text', ts: '1234567890.000001' },
          { type: 'message', user: 'U456', ts: '1234567891.000002' }, // No text
          { type: 'message', user: 'U789', text: '', ts: '1234567892.000003' }, // Empty text
        ],
      });

      const result = await getConversationContext(mockClient, 'C123');

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Has text');
    });

    it('should handle undefined messages array in response', async () => {
      (mockClient.conversations.history as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        // messages is undefined
      });

      const result = await getConversationContext(mockClient, 'C123');

      expect(result).toEqual([]);
    });
  });

  describe('getThreadContext', () => {
    it('should fetch thread replies and return formatted messages', async () => {
      const result = await getThreadContext(mockClient, 'C123', '1234567890.000001');

      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          ts: '1234567890.000001',
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('ts');
    });

    it('should filter out bot messages in thread', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Thread parent', ts: '1234567890.000001' },
          { type: 'message', bot_id: 'B456', text: 'Bot reply', ts: '1234567891.000002' },
          { type: 'message', user: 'U789', text: 'Human reply', ts: '1234567892.000003' },
        ],
      });

      const result = await getThreadContext(mockClient, 'C123', '1234567890.000001');

      expect(result).toHaveLength(2);
      expect(result.find(m => m.text === 'Bot reply')).toBeUndefined();
    });

    it('should maintain chronological order (no reverse needed)', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'First', ts: '1234567890.000001' },
          { type: 'message', user: 'U456', text: 'Second', ts: '1234567891.000002' },
          { type: 'message', user: 'U789', text: 'Third', ts: '1234567892.000003' },
        ],
      });

      const result = await getThreadContext(mockClient, 'C123', '1234567890.000001');

      // conversations.replies returns in chronological order already
      expect(result[0].text).toBe('First');
      expect(result[1].text).toBe('Second');
      expect(result[2].text).toBe('Third');
    });

    it('should return empty array on API failure', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'thread_not_found',
      });

      const result = await getThreadContext(mockClient, 'C123', '1234567890.000001');

      expect(result).toEqual([]);
    });

    it('should throw on API exception', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await expect(getThreadContext(mockClient, 'C123', '1234567890.000001')).rejects.toThrow(
        'Network error'
      );
    });

    it('should respect maxMessages option', async () => {
      await getThreadContext(mockClient, 'C123', '1234567890.000001', { maxMessages: 10 });

      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('should respect contextWindowMinutes option', async () => {
      const beforeCall = Date.now();
      await getThreadContext(mockClient, 'C123', '1234567890.000001', { contextWindowMinutes: 15 });
      const afterCall = Date.now();

      const call = (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const oldestTimestamp = parseFloat(call.oldest);
      const oldestDate = oldestTimestamp * 1000;

      const expectedOldest = beforeCall - 15 * 60 * 1000;
      expect(oldestDate).toBeGreaterThanOrEqual(expectedOldest - 1000);
      expect(oldestDate).toBeLessThanOrEqual(afterCall - 15 * 60 * 1000 + 1000);
    });

    it('should handle undefined messages array in response', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        // messages is undefined
      });

      const result = await getThreadContext(mockClient, 'C123', '1234567890.000001');

      expect(result).toEqual([]);
    });
  });

  describe('getContextForMessage', () => {
    it('should use thread context when threadTs differs from messageTs', async () => {
      await getContextForMessage(mockClient, 'C123', '1234567891.000002', '1234567890.000001');

      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          ts: '1234567890.000001', // Uses threadTs, not messageTs
        })
      );
      // Should not call history when we have a thread
      expect(mockClient.conversations.history).not.toHaveBeenCalled();
    });

    it('should check if message is thread parent and use thread context', async () => {
      // Mock replies to return multiple messages (indicating it's a thread)
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [
          { type: 'message', user: 'U123', text: 'Parent', ts: '1234567890.000001' },
          { type: 'message', user: 'U456', text: 'Reply', ts: '1234567891.000002' },
        ],
      });

      await getContextForMessage(mockClient, 'C123', '1234567890.000001');

      // Should call replies to check thread status with limit: 2
      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          ts: '1234567890.000001',
          limit: 2,
        })
      );
      // Should call again for full thread context
      expect(mockClient.conversations.replies).toHaveBeenCalledTimes(2);
    });

    it('should fall back to channel context for non-thread messages', async () => {
      // Mock replies to return single message (not a thread)
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [{ type: 'message', user: 'U123', text: 'Single message', ts: '1234567890.000001' }],
      });

      await getContextForMessage(mockClient, 'C123', '1234567890.000001');

      // Should call replies first to check
      expect(mockClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 2 })
      );
      // Should fall back to history
      expect(mockClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123' })
      );
    });

    it('should handle replies check failure gracefully and use channel context', async () => {
      // First call fails
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Thread check failed')
      );

      await getContextForMessage(mockClient, 'C123', '1234567890.000001');

      // Should fall back to channel context
      expect(mockClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123' })
      );
    });

    it('should check replies when threadTs equals messageTs', async () => {
      // If threadTs === messageTs, it's treated as no threadTs provided
      // The code only skips the thread check if threadTs && threadTs !== messageTs

      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        messages: [{ type: 'message', user: 'U123', text: 'Only parent', ts: '1234567890.000001' }],
      });

      // Call with same ts as threadTs
      await getContextForMessage(mockClient, 'C123', '1234567890.000001', '1234567890.000001');

      // When threadTs === messageTs, the condition threadTs !== messageTs is false
      // So it will fall through to checking replies
      expect(mockClient.conversations.replies).toHaveBeenCalled();
    });

    it('should handle ok: false from replies check and fall back to channel', async () => {
      (mockClient.conversations.replies as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      });

      await getContextForMessage(mockClient, 'C123', '1234567890.000001');

      // Should fall back to channel context when replies check returns ok: false
      expect(mockClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123' })
      );
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to Slack API calls', async () => {
      // Make multiple rapid calls - rate limiter mock allows them through instantly
      const promises = Array(5)
        .fill(null)
        .map(() => getConversationContext(mockClient, 'C123'));

      const results = await Promise.all(promises);

      // All calls should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

      // API should have been called 5 times
      expect(mockClient.conversations.history).toHaveBeenCalledTimes(5);
    });

    it('should rate limit thread context calls', async () => {
      const promises = Array(3)
        .fill(null)
        .map(() => getThreadContext(mockClient, 'C123', '1234567890.000001'));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockClient.conversations.replies).toHaveBeenCalledTimes(3);
    });

    it('should allow mixed API calls through rate limiter', async () => {
      // Mix of history and replies calls
      const promise1 = getConversationContext(mockClient, 'C123');
      const promise2 = getThreadContext(mockClient, 'C123', '1234567890.000001');
      const promise3 = getConversationContext(mockClient, 'C456');

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toHaveLength(3);
      expect(mockClient.conversations.history).toHaveBeenCalledTimes(2);
      expect(mockClient.conversations.replies).toHaveBeenCalledTimes(1);
    });
  });
});
