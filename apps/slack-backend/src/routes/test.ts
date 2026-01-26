import type { IncomingMessage, ServerResponse } from 'http';
import { generateSuggestion, refineSuggestion } from '../services/ai.js';
import {
  watchConversation,
  unwatchConversation,
  getWatchedConversations,
} from '../services/watch.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to parse JSON body from incoming request
 */
function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString();
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to send JSON response
 */
function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: Record<string, unknown>
): void {
  const response = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(response);
}

/**
 * Helper to send HTML response
 */
function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * Parse URL query parameters
 */
function parseQueryParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return {};
  }

  const queryString = url.slice(queryIndex + 1);
  const params: Record<string, string> = {};

  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }

  return params;
}

/**
 * Parse URL path parameters from pattern like /api/test/watches/:teamId/:userId
 */
function parsePathParams(
  url: string,
  pattern: string
): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const urlParts = url.split('?')[0].split('/');

  if (patternParts.length !== urlParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = urlParts[i];
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * GET /test - Serve HTML testing page
 */
function handleTestPage(_req: IncomingMessage, res: ServerResponse): void {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Slack App Testing</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; }
    h1 { color: #1264A3; }
    .warning { background: #FFF3CD; border: 1px solid #FFE69C; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .test-section { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .test-section h2 { margin-top: 0; color: #333; }
    input, textarea { width: 100%; padding: 10px; margin: 5px 0 15px 0; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
    textarea { height: 100px; font-family: monospace; }
    button { padding: 12px 24px; background: #1264A3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 10px; }
    button:hover { background: #0D4F7E; }
    button.secondary { background: #6c757d; }
    .result { background: #f8f9fa; padding: 15px; margin-top: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; font-size: 13px; max-height: 300px; overflow-y: auto; }
    .result.error { background: #F8D7DA; color: #842029; }
    .result.success { background: #D1E7DD; color: #0F5132; }
    label { font-weight: 600; color: #555; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    select { width: 100%; padding: 10px; margin: 5px 0 15px 0; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Slack Speak for Me - Testing Interface</h1>

  <div class="warning">
    <strong>Development Only:</strong> This page is only available in non-production environments.
    It allows testing handlers and AI without connecting to Slack.
  </div>

  <div class="test-section">
    <h2>Test app_mention Event</h2>
    <p>Simulate a user mentioning the bot in a channel.</p>
    <div class="grid">
      <div>
        <label>User ID</label>
        <input type="text" id="mention-user" placeholder="U123" value="U123" />
      </div>
      <div>
        <label>Channel ID</label>
        <input type="text" id="mention-channel" placeholder="C456" value="C456" />
      </div>
    </div>
    <label>Thread TS (optional)</label>
    <input type="text" id="mention-thread" placeholder="1234567890.000001" />
    <label>Message Text</label>
    <textarea id="mention-text" placeholder="@bot help me respond to this difficult email">@bot Can you help me draft a response to this customer complaint?</textarea>
    <button onclick="testAppMention()">Send app_mention</button>
    <div id="mention-result" class="result" style="display:none"></div>
  </div>

  <div class="test-section">
    <h2>Test Message Event</h2>
    <p>Simulate a message in a channel/thread to test reply detection.</p>
    <div class="grid">
      <div>
        <label>User ID</label>
        <input type="text" id="msg-user" placeholder="U456" value="U456" />
      </div>
      <div>
        <label>Channel ID</label>
        <input type="text" id="msg-channel" placeholder="C456" value="C456" />
      </div>
    </div>
    <label>Thread TS (for thread replies)</label>
    <input type="text" id="msg-thread" placeholder="1234567890.000001" value="1234567890.000001" />
    <label>Message Text</label>
    <textarea id="msg-text">This is a reply in the thread that might trigger a suggestion.</textarea>
    <button onclick="testMessage()">Send Message Event</button>
    <div id="msg-result" class="result" style="display:none"></div>
  </div>

  <div class="test-section">
    <h2>Test AI Generation Directly</h2>
    <p>Call the AI service directly without going through Slack events.</p>
    <label>Context (previous messages)</label>
    <textarea id="ai-context" placeholder="Previous conversation context...">Customer: I've been waiting 3 weeks for my order and no one has responded to my emails.
Support: We apologize for the delay. Let me look into this immediately.</textarea>
    <label>Trigger Message</label>
    <textarea id="ai-trigger" placeholder="The message to respond to...">This is unacceptable. I want a full refund and I'm reporting this to the BBB.</textarea>
    <label>Trigger Type</label>
    <select id="ai-trigger-type">
      <option value="mention">Mention</option>
      <option value="reply">Reply</option>
      <option value="thread">Thread</option>
      <option value="message_action">Message Action</option>
    </select>
    <button onclick="testAI()">Generate Suggestion</button>
    <div id="ai-result" class="result" style="display:none"></div>
  </div>

  <div class="test-section">
    <h2>Test AI Refinement</h2>
    <p>Refine an existing suggestion with additional instructions.</p>
    <label>Original Suggestion</label>
    <textarea id="refine-original">I understand your frustration and apologize for the delay in processing your order.</textarea>
    <label>Refinement Request</label>
    <textarea id="refine-request" style="height: 60px;">Make it more empathetic and offer compensation</textarea>
    <button onclick="testRefine()">Refine Suggestion</button>
    <div id="refine-result" class="result" style="display:none"></div>
  </div>

  <div class="test-section">
    <h2>Manage Watches</h2>
    <p>View and manage watched conversations for a user.</p>
    <div class="grid">
      <div>
        <label>Team ID</label>
        <input type="text" id="watch-team" placeholder="T123" value="T123" />
      </div>
      <div>
        <label>User ID</label>
        <input type="text" id="watch-user" placeholder="U123" value="U123" />
      </div>
    </div>
    <label>Channel ID</label>
    <input type="text" id="watch-channel" placeholder="C456" value="C456" />
    <button onclick="addWatch()">Add Watch</button>
    <button onclick="removeWatch()" class="secondary">Remove Watch</button>
    <button onclick="listWatches()" class="secondary">List Watches</button>
    <div id="watch-result" class="result" style="display:none"></div>
  </div>

  <script>
    function showResult(elementId, data, isError = false) {
      const el = document.getElementById(elementId);
      el.style.display = 'block';
      el.className = 'result ' + (isError ? 'error' : 'success');
      el.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }

    async function testAppMention() {
      try {
        const result = await fetch('/api/test/app-mention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: document.getElementById('mention-user').value,
            channel: document.getElementById('mention-channel').value,
            text: document.getElementById('mention-text').value,
            threadTs: document.getElementById('mention-thread').value || undefined,
          }),
        }).then(r => r.json());
        showResult('mention-result', result, !result.success);
      } catch (err) {
        showResult('mention-result', { error: err.message }, true);
      }
    }

    async function testMessage() {
      try {
        const result = await fetch('/api/test/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: document.getElementById('msg-user').value,
            channel: document.getElementById('msg-channel').value,
            text: document.getElementById('msg-text').value,
            threadTs: document.getElementById('msg-thread').value || undefined,
          }),
        }).then(r => r.json());
        showResult('msg-result', result, !result.success);
      } catch (err) {
        showResult('msg-result', { error: err.message }, true);
      }
    }

    async function testAI() {
      showResult('ai-result', 'Generating suggestion...', false);
      try {
        const result = await fetch('/api/test/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: document.getElementById('ai-context').value,
            trigger: document.getElementById('ai-trigger').value,
            triggeredBy: document.getElementById('ai-trigger-type').value,
          }),
        }).then(r => r.json());
        showResult('ai-result', result, !result.success);
      } catch (err) {
        showResult('ai-result', { error: err.message }, true);
      }
    }

    async function testRefine() {
      showResult('refine-result', 'Refining suggestion...', false);
      try {
        const result = await fetch('/api/test/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalSuggestion: document.getElementById('refine-original').value,
            refinementRequest: document.getElementById('refine-request').value,
          }),
        }).then(r => r.json());
        showResult('refine-result', result, !result.success);
      } catch (err) {
        showResult('refine-result', { error: err.message }, true);
      }
    }

    async function addWatch() {
      try {
        const result = await fetch('/api/test/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: document.getElementById('watch-team').value,
            userId: document.getElementById('watch-user').value,
            channelId: document.getElementById('watch-channel').value,
          }),
        }).then(r => r.json());
        showResult('watch-result', result, !result.success);
      } catch (err) {
        showResult('watch-result', { error: err.message }, true);
      }
    }

    async function removeWatch() {
      try {
        const result = await fetch('/api/test/watch', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: document.getElementById('watch-team').value,
            userId: document.getElementById('watch-user').value,
            channelId: document.getElementById('watch-channel').value,
          }),
        }).then(r => r.json());
        showResult('watch-result', result, !result.success);
      } catch (err) {
        showResult('watch-result', { error: err.message }, true);
      }
    }

    async function listWatches() {
      try {
        const teamId = document.getElementById('watch-team').value;
        const userId = document.getElementById('watch-user').value;
        const result = await fetch('/api/test/watches?teamId=' + encodeURIComponent(teamId) + '&userId=' + encodeURIComponent(userId)).then(r => r.json());
        showResult('watch-result', result, !result.success);
      } catch (err) {
        showResult('watch-result', { error: err.message }, true);
      }
    }
  </script>
</body>
</html>`;

  sendHtml(res, html);
}

/**
 * POST /api/test/app-mention - Simulate app_mention event
 */
async function handleTestAppMention(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { user, channel, text, threadTs } = body as {
      user?: string;
      channel?: string;
      text?: string;
      threadTs?: string;
    };

    if (!user || !channel || !text) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: user, channel, text',
      });
      return;
    }

    // Note: In a real app, this would trigger the app_mention handler
    // For testing purposes, we just log and acknowledge
    logger.info({ user, channel, text, threadTs }, 'Test app_mention simulated');

    sendJson(res, 200, {
      success: true,
      message: 'app_mention event simulated',
      data: { user, channel, text, threadTs },
      note: 'Full handler integration requires Slack context. Use AI test endpoint for direct generation.',
    });
  } catch (error) {
    logger.error({ error }, 'Test app_mention error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/test/message - Simulate message event
 */
async function handleTestMessage(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { user, channel, text, threadTs } = body as {
      user?: string;
      channel?: string;
      text?: string;
      threadTs?: string;
    };

    if (!user || !channel || !text) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: user, channel, text',
      });
      return;
    }

    // Note: In a real app, this would trigger the message handler
    // For testing purposes, we just log and acknowledge
    logger.info({ user, channel, text, threadTs }, 'Test message simulated');

    sendJson(res, 200, {
      success: true,
      message: 'Message event simulated',
      data: { user, channel, text, threadTs },
      note: 'Full handler integration requires Slack context. Use AI test endpoint for direct generation.',
    });
  } catch (error) {
    logger.error({ error }, 'Test message error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/test/ai - Test AI generation directly
 */
async function handleTestAI(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { context, trigger, triggeredBy } = body as {
      context?: string;
      trigger?: string;
      triggeredBy?: 'mention' | 'reply' | 'thread' | 'message_action';
    };

    if (!trigger) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required field: trigger',
      });
      return;
    }

    // Build context messages from the context string
    const contextMessages = context
      ? context.split('\n').filter(Boolean).map((line, idx) => ({
          userId: `U${idx}`,
          text: line,
          ts: `${Date.now() - (1000 * (10 - idx))}.000000`,
        }))
      : [];

    const result = await generateSuggestion({
      triggerMessage: trigger,
      contextMessages,
      triggeredBy: triggeredBy || 'mention',
    });

    sendJson(res, 200, {
      success: true,
      suggestion: result.suggestion,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    logger.error({ error }, 'Test AI generation error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/test/refine - Test AI refinement
 */
async function handleTestRefine(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { originalSuggestion, refinementRequest, history } = body as {
      originalSuggestion?: string;
      refinementRequest?: string;
      history?: Array<{ suggestion: string; refinementRequest?: string }>;
    };

    if (!originalSuggestion || !refinementRequest) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: originalSuggestion, refinementRequest',
      });
      return;
    }

    const result = await refineSuggestion({
      originalSuggestion,
      refinementRequest,
      history,
    });

    sendJson(res, 200, {
      success: true,
      suggestion: result.suggestion,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    logger.error({ error }, 'Test AI refinement error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/test/watches - List watches for user
 * Accepts query params: teamId, userId
 * Also supports path params: /api/test/watches/:teamId/:userId
 */
async function handleListWatches(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // Try path params first (for /api/test/watches/:teamId/:userId)
    let teamId: string | undefined;
    let userId: string | undefined;

    const pathParams = parsePathParams(
      req.url || '',
      '/api/test/watches/:teamId/:userId'
    );

    if (pathParams) {
      teamId = pathParams.teamId;
      userId = pathParams.userId;
    } else {
      // Fall back to query params
      const queryParams = parseQueryParams(req.url || '');
      teamId = queryParams.teamId;
      userId = queryParams.userId;
    }

    if (!teamId || !userId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required parameters: teamId, userId. Use query params or path /api/test/watches/:teamId/:userId',
      });
      return;
    }

    const channels = await getWatchedConversations(teamId, userId);

    sendJson(res, 200, {
      success: true,
      teamId,
      userId,
      channels,
      count: channels.length,
    });
  } catch (error) {
    logger.error({ error }, 'List watches error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/test/watch - Add watch
 */
async function handleAddWatch(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { teamId, userId, channelId } = body as {
      teamId?: string;
      userId?: string;
      channelId?: string;
    };

    if (!teamId || !userId || !channelId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: teamId, userId, channelId',
      });
      return;
    }

    await watchConversation(teamId, userId, channelId);

    sendJson(res, 200, {
      success: true,
      message: 'Watch added',
      data: { teamId, userId, channelId },
    });
  } catch (error) {
    logger.error({ error }, 'Add watch error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/test/watch - Remove watch
 */
async function handleRemoveWatch(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseBody(req);
    const { teamId, userId, channelId } = body as {
      teamId?: string;
      userId?: string;
      channelId?: string;
    };

    if (!teamId || !userId || !channelId) {
      sendJson(res, 400, {
        success: false,
        error: 'Missing required fields: teamId, userId, channelId',
      });
      return;
    }

    await unwatchConversation(teamId, userId, channelId);

    sendJson(res, 200, {
      success: true,
      message: 'Watch removed',
      data: { teamId, userId, channelId },
    });
  } catch (error) {
    logger.error({ error }, 'Remove watch error');
    sendJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Production blocker - returns 403 for all test routes
 */
function handleProductionBlock(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  sendJson(res, 403, { error: 'Test routes disabled in production' });
}

/**
 * Route handler that dispatches based on method and path
 */
function createTestApiHandler(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const result = handler(req, res);
    if (result instanceof Promise) {
      result.catch((error) => {
        logger.error({ error }, 'Test route error');
        sendJson(res, 500, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  };
}

/**
 * Test routes for development/debugging.
 * All routes are disabled in production.
 *
 * These use Bolt's customRoutes format (raw HTTP handlers).
 */
export const testRoutes = process.env.NODE_ENV === 'production'
  ? [
      { path: '/test', method: 'GET', handler: handleProductionBlock },
      { path: '/api/test/app-mention', method: 'POST', handler: handleProductionBlock },
      { path: '/api/test/message', method: 'POST', handler: handleProductionBlock },
      { path: '/api/test/ai', method: 'POST', handler: handleProductionBlock },
      { path: '/api/test/refine', method: 'POST', handler: handleProductionBlock },
      { path: '/api/test/watches', method: 'GET', handler: handleProductionBlock },
      { path: '/api/test/watch', method: 'POST', handler: handleProductionBlock },
      { path: '/api/test/watch', method: 'DELETE', handler: handleProductionBlock },
    ]
  : [
      { path: '/test', method: 'GET', handler: handleTestPage },
      {
        path: '/api/test/app-mention',
        method: 'POST',
        handler: createTestApiHandler(handleTestAppMention),
      },
      {
        path: '/api/test/message',
        method: 'POST',
        handler: createTestApiHandler(handleTestMessage),
      },
      {
        path: '/api/test/ai',
        method: 'POST',
        handler: createTestApiHandler(handleTestAI),
      },
      {
        path: '/api/test/refine',
        method: 'POST',
        handler: createTestApiHandler(handleTestRefine),
      },
      {
        path: '/api/test/watches',
        method: 'GET',
        handler: createTestApiHandler(handleListWatches),
      },
      {
        path: '/api/test/watch',
        method: 'POST',
        handler: createTestApiHandler(handleAddWatch),
      },
      {
        path: '/api/test/watch',
        method: 'DELETE',
        handler: createTestApiHandler(handleRemoveWatch),
      },
    ];

/**
 * Log that test endpoints are registered.
 */
export function logTestEndpointsRegistered(): void {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Test endpoints registered at /test and /api/test/*');
  }
}
