import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Set test environment variables
process.env.SLACK_SKIP_SIGNATURE_VERIFICATION = 'true';
process.env.NODE_ENV = 'test';

// Anthropic API handlers
const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Mocked AI suggestion' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  }),
];

// Slack API handlers
const slackHandlers = [
  http.post('https://slack.com/api/chat.postEphemeral', () => {
    return HttpResponse.json({
      ok: true,
      message_ts: '1234567890.123456',
    });
  }),

  http.post('https://slack.com/api/conversations.history', () => {
    return HttpResponse.json({
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123',
          text: 'Hello world',
          ts: '1234567890.123456',
        },
        {
          type: 'message',
          user: 'U456',
          text: 'Hi there!',
          ts: '1234567890.123457',
        },
      ],
      has_more: false,
    });
  }),

  http.post('https://slack.com/api/conversations.replies', () => {
    return HttpResponse.json({
      ok: true,
      messages: [
        {
          type: 'message',
          user: 'U123',
          text: 'Thread parent message',
          ts: '1234567890.123456',
          thread_ts: '1234567890.123456',
          reply_count: 2,
        },
        {
          type: 'message',
          user: 'U456',
          text: 'Thread reply 1',
          ts: '1234567890.123457',
          thread_ts: '1234567890.123456',
        },
        {
          type: 'message',
          user: 'U789',
          text: 'Thread reply 2',
          ts: '1234567890.123458',
          thread_ts: '1234567890.123456',
        },
      ],
      has_more: false,
    });
  }),

  http.post('https://slack.com/api/users.info', () => {
    return HttpResponse.json({
      ok: true,
      user: {
        id: 'U123',
        team_id: 'T123',
        name: 'testuser',
        real_name: 'Test User',
        profile: {
          display_name: 'Test User',
          email: 'test@example.com',
        },
        is_bot: false,
      },
    });
  }),

  http.post('https://slack.com/api/auth.test', () => {
    return HttpResponse.json({
      ok: true,
      team_id: 'T123',
      user_id: 'U123',
      bot_id: 'B123',
      team: 'Test Team',
      user: 'testbot',
    });
  }),

  http.post('https://slack.com/api/views.open', () => {
    return HttpResponse.json({
      ok: true,
      view: {
        id: 'V123',
        team_id: 'T123',
        type: 'modal',
        title: { type: 'plain_text', text: 'Test Modal' },
      },
    });
  }),

  http.post('https://slack.com/api/views.update', () => {
    return HttpResponse.json({
      ok: true,
      view: {
        id: 'V123',
        team_id: 'T123',
        type: 'modal',
        title: { type: 'plain_text', text: 'Updated Modal' },
      },
    });
  }),

  http.post('https://slack.com/api/chat.postMessage', () => {
    return HttpResponse.json({
      ok: true,
      channel: 'C123',
      ts: '1234567890.123456',
      message: {
        text: 'Test message',
        ts: '1234567890.123456',
      },
    });
  }),

  http.post('https://slack.com/api/chat.update', () => {
    return HttpResponse.json({
      ok: true,
      channel: 'C123',
      ts: '1234567890.123456',
      text: 'Updated message',
    });
  }),

  http.post('https://slack.com/api/chat.delete', () => {
    return HttpResponse.json({
      ok: true,
      channel: 'C123',
      ts: '1234567890.123456',
    });
  }),
];

// Combine all handlers
export const handlers = [...anthropicHandlers, ...slackHandlers];

// Create MSW server
export const server = setupServer(...handlers);

// Setup lifecycle hooks
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
