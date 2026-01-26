/**
 * Mock data factories for tests
 *
 * Uses consistent test IDs:
 * - T123 for team
 * - U123, U456, U789 for users
 * - C123 for channel
 * - B123 for bot
 */

export interface MockSlackMessage {
  user: string;
  text: string;
  ts: string;
  channel: string;
  threadTs?: string;
  type: 'message';
}

export interface MockSlackEvent {
  type: string;
  user: string;
  channel: string;
  ts: string;
  text?: string;
  threadTs?: string;
  team?: string;
}

export interface MockInstallation {
  teamId: string;
  botToken: string;
  botUserId: string;
  enterpriseId?: string;
  botScopes?: string;
  userToken?: string;
  userId?: string;
  userScopes?: string;
}

export interface MockWorkspace {
  teamId: string;
  name: string;
  enterpriseId?: string;
}

export interface MockContextMessage {
  userId: string;
  text: string;
  ts: string;
  isBot?: boolean;
}

/**
 * Create a mock Slack message
 */
export function createMockSlackMessage(
  overrides: Partial<MockSlackMessage> = {}
): MockSlackMessage {
  return {
    user: 'U123',
    text: 'Test message',
    ts: '1234567890.123456',
    channel: 'C123',
    type: 'message',
    ...overrides,
  };
}

/**
 * Create a mock Slack event
 */
export function createMockSlackEvent(
  overrides: Partial<MockSlackEvent> = {}
): MockSlackEvent {
  return {
    type: 'message',
    user: 'U123',
    channel: 'C123',
    ts: '1234567890.123456',
    text: 'Test event message',
    team: 'T123',
    ...overrides,
  };
}

/**
 * Create a mock installation record
 */
export function createMockInstallation(
  overrides: Partial<MockInstallation> = {}
): MockInstallation {
  return {
    teamId: 'T123',
    botToken: 'xoxb-test-bot-token',
    botUserId: 'B123',
    botScopes: 'channels:history,chat:write,commands,users:read',
    ...overrides,
  };
}

/**
 * Create a mock workspace record
 */
export function createMockWorkspace(
  overrides: Partial<MockWorkspace> = {}
): MockWorkspace {
  return {
    teamId: 'T123',
    name: 'Test Workspace',
    ...overrides,
  };
}

/**
 * Create a mock context message (for AI context)
 */
export function createMockContextMessage(
  overrides: Partial<MockContextMessage> = {}
): MockContextMessage {
  return {
    userId: 'U123',
    text: 'Context message',
    ts: '1234567890.123456',
    isBot: false,
    ...overrides,
  };
}

/**
 * Create a series of mock thread messages for testing thread context
 */
export function createMockThreadContext(count: number = 3) {
  const messages: MockContextMessage[] = [];
  const users = ['U123', 'U456', 'U789'];

  for (let i = 0; i < count; i++) {
    messages.push({
      userId: users[i % users.length],
      text: `Thread message ${i + 1}`,
      ts: `1234567890.12345${i}`,
      isBot: false,
    });
  }

  return messages;
}

/**
 * Create a mock app mention event
 */
export function createMockAppMentionEvent(
  overrides: Partial<MockSlackEvent> = {}
) {
  return createMockSlackEvent({
    type: 'app_mention',
    text: '<@B123> help me respond to this',
    ...overrides,
  });
}

/**
 * Create a mock message shortcut payload
 */
export function createMockMessageShortcut(messageOverrides: Partial<MockSlackMessage> = {}) {
  const message = createMockSlackMessage(messageOverrides);

  return {
    type: 'message_action',
    callback_id: 'help_me_respond',
    trigger_id: 'trigger_123',
    user: {
      id: 'U123',
      team_id: 'T123',
      name: 'testuser',
    },
    channel: {
      id: message.channel,
      name: 'test-channel',
    },
    message: {
      type: message.type,
      user: message.user,
      text: message.text,
      ts: message.ts,
      thread_ts: message.threadTs,
    },
    team: {
      id: 'T123',
      domain: 'test-workspace',
    },
    response_url: 'https://hooks.slack.com/actions/T123/123456/abcdef',
  };
}

/**
 * Create mock Slack user info
 */
export function createMockSlackUser(overrides: Partial<{
  id: string;
  name: string;
  realName: string;
  email: string;
  isBot: boolean;
}> = {}) {
  return {
    id: overrides.id ?? 'U123',
    team_id: 'T123',
    name: overrides.name ?? 'testuser',
    real_name: overrides.realName ?? 'Test User',
    profile: {
      display_name: overrides.realName ?? 'Test User',
      email: overrides.email ?? 'test@example.com',
    },
    is_bot: overrides.isBot ?? false,
  };
}
