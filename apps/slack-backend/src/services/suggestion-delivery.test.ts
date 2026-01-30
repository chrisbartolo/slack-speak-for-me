import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebClient } from '@slack/web-api';
import type { KnownBlock } from '@slack/types';
import { buildSuggestionBlocks, sendSuggestionEphemeral } from './suggestion-delivery.js';

describe('Suggestion Delivery Service', () => {
  describe('buildSuggestionBlocks', () => {
    it('should build valid Block Kit structure with correct number of blocks', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');

      // header, context, divider, section, actions, context (6 total)
      expect(blocks).toHaveLength(6);
    });

    it('should include header with suggestion title', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const header = blocks[0] as KnownBlock;

      expect(header.type).toBe('header');
      expect((header as { text: { text: string } }).text.text).toContain('Suggested Response');
    });

    it('should include context label for mention trigger', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const contextBlock = blocks[1] as KnownBlock;

      expect(contextBlock.type).toBe('context');
      const contextText = JSON.stringify(contextBlock);
      expect(contextText).toContain('mentioned you');
    });

    it('should include context label for reply trigger', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'reply');
      const contextBlock = blocks[1] as KnownBlock;

      expect(contextBlock.type).toBe('context');
      const contextText = JSON.stringify(contextBlock);
      expect(contextText).toContain('replied to you');
    });

    it('should include context label for thread trigger', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'thread');
      const contextBlock = blocks[1] as KnownBlock;

      expect(contextBlock.type).toBe('context');
      const contextText = JSON.stringify(contextBlock);
      expect(contextText).toContain('thread');
    });

    it('should include context label for message_action trigger', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'message_action');
      const contextBlock = blocks[1] as KnownBlock;

      expect(contextBlock.type).toBe('context');
      const contextText = JSON.stringify(contextBlock);
      expect(contextText).toContain('requested');
    });

    it('should include divider block', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const divider = blocks[2] as KnownBlock;

      expect(divider.type).toBe('divider');
    });

    it('should include suggestion text in section block', () => {
      const suggestionText = 'This is my test suggestion with specific content';
      const blocks = buildSuggestionBlocks('sug_123', suggestionText, 'mention');
      const section = blocks[3] as KnownBlock;

      expect(section.type).toBe('section');
      const sectionText = JSON.stringify(section);
      expect(sectionText).toContain(suggestionText);
    });

    it('should include Send, Refine, and Dismiss buttons in actions block', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const actions = blocks[4] as { type: string; elements: Array<{ action_id: string }> };

      expect(actions.type).toBe('actions');
      expect(actions.elements).toHaveLength(3);

      const actionIds = actions.elements.map(e => e.action_id);
      expect(actionIds).toContain('send_suggestion');
      expect(actionIds).toContain('refine_suggestion');
      expect(actionIds).toContain('dismiss_suggestion');
    });

    it('should have Send button as primary style', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const actions = blocks[4] as { type: string; elements: Array<{ action_id: string; style?: string }> };

      const sendButton = actions.elements.find(e => e.action_id === 'send_suggestion');
      expect(sendButton?.style).toBe('primary');
    });

    it('should include suggestionId in all button values', () => {
      const suggestionId = 'sug_unique_789';
      const blocks = buildSuggestionBlocks(suggestionId, 'Test suggestion', 'mention');
      const actions = blocks[4] as { type: string; elements: Array<{ value: string }> };

      actions.elements.forEach(element => {
        // Values may be JSON stringified or plain - just check they contain the suggestionId
        expect(element.value).toContain(suggestionId);
      });
    });

    it('should include footer context with visibility notice', () => {
      const blocks = buildSuggestionBlocks('sug_123', 'Test suggestion', 'mention');
      const footer = blocks[5] as KnownBlock;

      expect(footer.type).toBe('context');
      const footerText = JSON.stringify(footer);
      expect(footerText.toLowerCase()).toContain('only visible to you');
    });

    it('should handle long suggestion text', () => {
      const longText = 'A'.repeat(3000);
      const blocks = buildSuggestionBlocks('sug_123', longText, 'mention');
      const section = blocks[3] as KnownBlock;

      expect(section.type).toBe('section');
      const sectionText = JSON.stringify(section);
      expect(sectionText).toContain(longText);
    });

    it('should handle special characters in suggestion text', () => {
      const specialText = 'Test with <html> & "quotes" and \'apostrophes\' and @mentions';
      const blocks = buildSuggestionBlocks('sug_123', specialText, 'mention');
      const section = blocks[3] as { type: string; text: { type: string; text: string } };

      expect(section.type).toBe('section');
      // Verify the text is preserved in the block (unescaped)
      expect(section.text.text).toBe(specialText);
    });
  });

  describe('sendSuggestionEphemeral', () => {
    let mockClient: WebClient;

    beforeEach(() => {
      mockClient = {
        chat: {
          postEphemeral: vi.fn().mockResolvedValue({ ok: true, message_ts: '1234567890.123456' }),
        },
      } as unknown as WebClient;
    });

    it('should send ephemeral message to correct user and channel', async () => {
      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C123',
        userId: 'U456',
        suggestionId: 'sug_789',
        suggestion: 'Test suggestion',
        triggerContext: 'mention',
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          user: 'U456',
        })
      );
    });

    it('should include fallback text for clients without Block Kit support', async () => {
      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C123',
        userId: 'U456',
        suggestionId: 'sug_789',
        suggestion: 'Test suggestion',
        triggerContext: 'mention',
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
        })
      );
    });

    it('should pass built blocks to API', async () => {
      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C123',
        userId: 'U456',
        suggestionId: 'sug_789',
        suggestion: 'Test suggestion',
        triggerContext: 'mention',
      });

      expect(mockClient.chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'header' }),
            expect.objectContaining({ type: 'actions' }),
          ]),
        })
      );
    });

    it('should propagate API errors', async () => {
      const error = new Error('Slack API error');
      (mockClient.chat.postEphemeral as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(
        sendSuggestionEphemeral({
          client: mockClient,
          channelId: 'C123',
          userId: 'U456',
          suggestionId: 'sug_789',
          suggestion: 'Test suggestion',
          triggerContext: 'mention',
        })
      ).rejects.toThrow('Slack API error');
    });

    it('should work with all trigger context types', async () => {
      const triggerContexts: Array<'mention' | 'reply' | 'thread' | 'message_action'> = [
        'mention',
        'reply',
        'thread',
        'message_action',
      ];

      for (const triggerContext of triggerContexts) {
        vi.clearAllMocks();

        await sendSuggestionEphemeral({
          client: mockClient,
          channelId: 'C123',
          userId: 'U456',
          suggestionId: 'sug_789',
          suggestion: 'Test suggestion',
          triggerContext,
        });

        expect(mockClient.chat.postEphemeral).toHaveBeenCalledTimes(1);
      }
    });

    it('should include the suggestion text in blocks', async () => {
      const suggestionText = 'This is the specific suggestion text to verify';

      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C123',
        userId: 'U456',
        suggestionId: 'sug_789',
        suggestion: suggestionText,
        triggerContext: 'mention',
      });

      const call = (mockClient.chat.postEphemeral as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const blocksJson = JSON.stringify(call.blocks);
      expect(blocksJson).toContain(suggestionText);
    });

    it('should include the suggestionId in button values', async () => {
      const suggestionId = 'sug_unique_test_id';

      await sendSuggestionEphemeral({
        client: mockClient,
        channelId: 'C123',
        userId: 'U456',
        suggestionId,
        suggestion: 'Test suggestion',
        triggerContext: 'mention',
      });

      const call = (mockClient.chat.postEphemeral as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const blocksJson = JSON.stringify(call.blocks);
      expect(blocksJson).toContain(suggestionId);
    });
  });
});
