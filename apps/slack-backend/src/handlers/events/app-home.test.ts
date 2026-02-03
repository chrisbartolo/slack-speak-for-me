import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { App } from '@slack/bolt';
import { registerAppHomeHandler } from './app-home.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('App Home Handler', () => {
  let mockApp: Partial<App>;
  let homeHandler: Function;
  let mockViewsPublish: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockViewsPublish = vi.fn().mockResolvedValue({ ok: true });

    mockApp = {
      event: vi.fn((eventName: string, handler: Function) => {
        if (eventName === 'app_home_opened') {
          homeHandler = handler;
        }
      }),
    };

    registerAppHomeHandler(mockApp as App);
  });

  it('should register handler for app_home_opened', () => {
    expect(mockApp.event).toHaveBeenCalledWith('app_home_opened', expect.any(Function));
  });

  it('should publish view with correct user_id', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'home' },
      client: { views: { publish: mockViewsPublish } },
    });

    expect(mockViewsPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'U123',
      })
    );
  });

  it('should publish a home-type view', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'home' },
      client: { views: { publish: mockViewsPublish } },
    });

    const call = mockViewsPublish.mock.calls[0][0];
    expect(call.view.type).toBe('home');
  });

  it('should include Welcome header', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'home' },
      client: { views: { publish: mockViewsPublish } },
    });

    const call = mockViewsPublish.mock.calls[0][0];
    const blocks = call.view.blocks;
    const header = blocks[0];
    expect(header.type).toBe('header');
    expect(header.text.text).toContain('Welcome');
  });

  it('should include command listing', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'home' },
      client: { views: { publish: mockViewsPublish } },
    });

    const call = mockViewsPublish.mock.calls[0][0];
    const blocksJson = JSON.stringify(call.view.blocks);
    expect(blocksJson).toContain('/speakforme-watch');
    expect(blocksJson).toContain('/speakforme-unwatch');
    expect(blocksJson).toContain('/speakforme-report');
    expect(blocksJson).toContain('/speakforme-tasks');
  });

  it('should include AI disclaimer in context block', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'home' },
      client: { views: { publish: mockViewsPublish } },
    });

    const call = mockViewsPublish.mock.calls[0][0];
    const blocksJson = JSON.stringify(call.view.blocks);
    expect(blocksJson).toContain('may not always be accurate');
  });

  it('should skip publish when tab is not home', async () => {
    await homeHandler({
      event: { user: 'U123', tab: 'messages' },
      client: { views: { publish: mockViewsPublish } },
    });

    expect(mockViewsPublish).not.toHaveBeenCalled();
  });

  it('should handle views.publish errors gracefully', async () => {
    const { logger } = await import('../../utils/logger.js');
    mockViewsPublish.mockRejectedValueOnce(new Error('publish failed'));

    await expect(
      homeHandler({
        event: { user: 'U123', tab: 'home' },
        client: { views: { publish: mockViewsPublish } },
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error publishing App Home view'
    );
  });
});
