/**
 * Unit tests for Report Action handlers (Copy/Refine buttons)
 *
 * Tests verify:
 * - report_copy action: Opens modal with copyable text
 * - report_refine action: Opens refinement modal with input
 * - Error handling for both actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { App } from '@slack/bolt';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import { registerReportActionHandlers } from './report-actions.js';
import { logger } from '../../utils/logger.js';

describe('Report Action Handlers', () => {
  let mockApp: Partial<App>;
  let copyHandler: Function;
  let refineHandler: Function;
  let mockViewsOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsOpen = vi.fn().mockResolvedValue({ ok: true, view: { id: 'V123' } });

    // Capture handlers when registered
    mockApp = {
      action: vi.fn((actionId: string, handler: Function) => {
        if (actionId === 'report_copy') {
          copyHandler = handler;
        }
        if (actionId === 'report_refine') {
          refineHandler = handler;
        }
      }),
    };

    registerReportActionHandlers(mockApp as App);
  });

  describe('Handler registration', () => {
    it('should register handler for report_copy action', () => {
      expect(mockApp.action).toHaveBeenCalledWith('report_copy', expect.any(Function));
    });

    it('should register handler for report_refine action', () => {
      expect(mockApp.action).toHaveBeenCalledWith('report_refine', expect.any(Function));
    });
  });

  describe('report_copy action', () => {
    const createCopyActionPayload = (report: string) => ({
      ack: vi.fn().mockResolvedValue(undefined),
      action: { value: JSON.stringify({ report }) },
      client: { views: { open: mockViewsOpen } },
      body: { trigger_id: 'trigger_123' },
    });

    it('should call ack() immediately', async () => {
      const payload = createCopyActionPayload('Test report content');

      await copyHandler(payload);

      expect(payload.ack).toHaveBeenCalled();
    });

    it('should open modal with copyable report text', async () => {
      const payload = createCopyActionPayload('This is the report content');

      await copyHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalledWith({
        trigger_id: 'trigger_123',
        view: expect.objectContaining({
          type: 'modal',
          title: expect.objectContaining({
            type: 'plain_text',
            text: 'Copy Report',
          }),
        }),
      });
    });

    it('should include report in code block for easy copying', async () => {
      const reportContent = 'Weekly Report\n- Item 1\n- Item 2';
      const payload = createCopyActionPayload(reportContent);

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      // Find the section with the report
      const reportSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('```')
      );

      expect(reportSection).toBeDefined();
      expect(reportSection.text.text).toContain('```' + reportContent + '```');
    });

    it('should include instruction text', async () => {
      const payload = createCopyActionPayload('Report');

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const instructionSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Triple-click')
      );

      expect(instructionSection).toBeDefined();
    });

    it('should have close button', async () => {
      const payload = createCopyActionPayload('Report');

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];

      expect(viewCall.view.close).toEqual({
        type: 'plain_text',
        text: 'Close',
      });
    });

    it('should parse report from action value JSON', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ report: 'Parsed report content' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_456' },
      };

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;
      const reportSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Parsed report content')
      );

      expect(reportSection).toBeDefined();
    });

    it('should use trigger_id from body', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ report: 'Report' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'specific_trigger_999' },
      };

      await copyHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_id: 'specific_trigger_999',
        })
      );
    });

    it('should handle views.open failure gracefully', async () => {
      mockViewsOpen.mockRejectedValueOnce(new Error('API error'));
      const payload = createCopyActionPayload('Report');

      await copyHandler(payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error), action: 'report_copy' }),
        'Failed to open copy modal'
      );
    });

    it('should handle special characters in report', async () => {
      const reportWithSpecialChars = 'Report with `backticks` and *asterisks* and <angle>';
      const payload = createCopyActionPayload(reportWithSpecialChars);

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;
      const reportSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes(reportWithSpecialChars)
      );

      expect(reportSection).toBeDefined();
    });

    it('should handle empty report', async () => {
      const payload = createCopyActionPayload('');

      await copyHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalled();
    });

    it('should handle very long report', async () => {
      const longReport = 'A'.repeat(3000);
      const payload = createCopyActionPayload(longReport);

      await copyHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalled();
    });
  });

  describe('report_refine action', () => {
    const createRefineActionPayload = (report: string, userId: string = 'U123') => ({
      ack: vi.fn().mockResolvedValue(undefined),
      action: { value: JSON.stringify({ report }) },
      client: { views: { open: mockViewsOpen } },
      body: { trigger_id: 'trigger_123', user: { id: userId } },
    });

    it('should call ack() immediately', async () => {
      const payload = createRefineActionPayload('Test report');

      await refineHandler(payload);

      expect(payload.ack).toHaveBeenCalled();
    });

    it('should open refinement modal', async () => {
      const payload = createRefineActionPayload('Test report');

      await refineHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalledWith({
        trigger_id: 'trigger_123',
        view: expect.objectContaining({
          type: 'modal',
          title: expect.objectContaining({
            type: 'plain_text',
            text: 'Refine Report',
          }),
        }),
      });
    });

    it('should set callback_id for form submission', async () => {
      const payload = createRefineActionPayload('Test report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];

      expect(viewCall.view.callback_id).toBe('report_refinement_submit');
    });

    it('should store report and history in private_metadata', async () => {
      const payload = createRefineActionPayload('Current report content');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const metadata = JSON.parse(viewCall.view.private_metadata);

      expect(metadata).toEqual({
        currentReport: 'Current report content',
        history: [],
      });
    });

    it('should display current report in modal', async () => {
      const payload = createRefineActionPayload('My weekly report summary');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const reportSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('My weekly report summary')
      );

      expect(reportSection).toBeDefined();
    });

    it('should include label for current report', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const labelSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.includes('Current Report')
      );

      expect(labelSection).toBeDefined();
    });

    it('should include input block for feedback', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const inputBlock = blocks.find(
        (b: any) => b.type === 'input' && b.block_id === 'feedback_block'
      );

      expect(inputBlock).toBeDefined();
      expect(inputBlock.element.action_id).toBe('feedback_input');
      expect(inputBlock.element.multiline).toBe(true);
    });

    it('should have placeholder text for feedback input', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const inputBlock = blocks.find(
        (b: any) => b.type === 'input' && b.block_id === 'feedback_block'
      );

      expect(inputBlock.element.placeholder.text).toContain('How would you like to change');
    });

    it('should have submit and close buttons', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];

      expect(viewCall.view.submit).toEqual({
        type: 'plain_text',
        text: 'Refine',
      });
      expect(viewCall.view.close).toEqual({
        type: 'plain_text',
        text: 'Cancel',
      });
    });

    it('should include divider between report and input', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const divider = blocks.find((b: any) => b.type === 'divider');

      expect(divider).toBeDefined();
    });

    it('should truncate long reports to Slack limit', async () => {
      const longReport = 'A'.repeat(3500); // Longer than 2900 char limit
      const payload = createRefineActionPayload(longReport);

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const reportSection = blocks.find(
        (b: any) => b.type === 'section' && b.text?.text?.length > 2000
      );

      // Report should be truncated
      expect(reportSection.text.text.length).toBeLessThanOrEqual(2900);
    });

    it('should log success when modal opened', async () => {
      const payload = createRefineActionPayload('Report', 'U789');

      await refineHandler(payload);

      expect(logger.info).toHaveBeenCalledWith(
        { userId: 'U789' },
        'Opened report refinement modal'
      );
    });

    it('should handle views.open failure gracefully', async () => {
      mockViewsOpen.mockRejectedValueOnce(new Error('API error'));
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error), action: 'report_refine' }),
        'Failed to open refinement modal'
      );
    });

    it('should use trigger_id from body', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ report: 'Report' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'specific_trigger_888', user: { id: 'U123' } },
      };

      await refineHandler(payload);

      expect(mockViewsOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger_id: 'specific_trigger_888',
        })
      );
    });

    it('should handle report with newlines', async () => {
      const reportWithNewlines = 'Line 1\nLine 2\nLine 3';
      const payload = createRefineActionPayload(reportWithNewlines);

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const metadata = JSON.parse(viewCall.view.private_metadata);

      expect(metadata.currentReport).toBe(reportWithNewlines);
    });

    it('should handle report with special markdown', async () => {
      const reportWithMarkdown = '## Header\n- *Bold*\n- _Italic_';
      const payload = createRefineActionPayload(reportWithMarkdown);

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const metadata = JSON.parse(viewCall.view.private_metadata);

      expect(metadata.currentReport).toBe(reportWithMarkdown);
    });

    it('should include feedback input label', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      const inputBlock = blocks.find(
        (b: any) => b.type === 'input' && b.block_id === 'feedback_block'
      );

      expect(inputBlock.label).toEqual({
        type: 'plain_text',
        text: 'Your Feedback',
      });
    });

    it('should initialize empty history array', async () => {
      const payload = createRefineActionPayload('Report');

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const metadata = JSON.parse(viewCall.view.private_metadata);

      expect(metadata.history).toEqual([]);
    });
  });

  describe('Action value parsing', () => {
    it('should handle malformed JSON in copy action', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: 'not valid json' },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123' },
      };

      // Handler catches the error and logs it
      await copyHandler(payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error), action: 'report_copy' }),
        'Failed to open copy modal'
      );
      expect(mockViewsOpen).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON in refine action', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: '{invalid json}' },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123', user: { id: 'U123' } },
      };

      // Handler catches the error and logs it
      await refineHandler(payload);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error), action: 'report_refine' }),
        'Failed to open refinement modal'
      );
      expect(mockViewsOpen).not.toHaveBeenCalled();
    });

    it('should handle missing report in copy action value', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ other: 'data' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123' },
      };

      await copyHandler(payload);

      // Should handle gracefully - undefined report
      expect(mockViewsOpen).toHaveBeenCalled();
    });

    it('should handle missing report in refine action value', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ other: 'data' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123', user: { id: 'U123' } },
      };

      await refineHandler(payload);

      // Throws when trying to call substring on undefined, caught and logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error), action: 'report_refine' }),
        'Failed to open refinement modal'
      );
      expect(mockViewsOpen).not.toHaveBeenCalled();
    });
  });

  describe('Modal block structure', () => {
    it('copy modal should have correct block order', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ report: 'Test' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123' },
      };

      await copyHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      expect(blocks[0].type).toBe('section'); // Instructions
      expect(blocks[1].type).toBe('section'); // Report in code block
    });

    it('refine modal should have correct block order', async () => {
      const payload = {
        ack: vi.fn().mockResolvedValue(undefined),
        action: { value: JSON.stringify({ report: 'Test' }) },
        client: { views: { open: mockViewsOpen } },
        body: { trigger_id: 'trigger_123', user: { id: 'U123' } },
      };

      await refineHandler(payload);

      const viewCall = mockViewsOpen.mock.calls[0][0];
      const blocks = viewCall.view.blocks;

      expect(blocks[0].type).toBe('section'); // Label
      expect(blocks[1].type).toBe('section'); // Report content
      expect(blocks[2].type).toBe('divider');
      expect(blocks[3].type).toBe('input'); // Feedback input
    });
  });
});
