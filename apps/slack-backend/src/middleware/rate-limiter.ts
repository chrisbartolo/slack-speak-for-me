import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';

const logger = pino({ name: 'rate-limiter' });

/**
 * Node HTTP handler type used by Bolt custom routes.
 */
type NodeHttpHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

/**
 * Create a rate limiter with memory store.
 * Uses in-memory store for simplicity and reliability.
 * For distributed rate limiting across multiple instances, Redis store can be added later.
 */
function createRateLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message: { error: string };
}): RateLimitRequestHandler {
  logger.info(`Rate limiter "${options.prefix}" initialized (memory store)`);

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    message: options.message,
    handler: (req, res, _next, optionsUsed) => {
      logger.warn({
        ip: req.ip,
        path: req.path,
        prefix: options.prefix,
      }, 'Rate limit exceeded');
      res.status(optionsUsed.statusCode).json(optionsUsed.message);
    },
  });
}

/**
 * General API rate limiter.
 * 100 requests per 15 minutes per IP.
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  prefix: 'rl:api:',
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth rate limiter for OAuth endpoints.
 * 10 attempts per hour per IP.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  prefix: 'rl:auth:',
  message: { error: 'Too many authentication attempts.' },
});

/**
 * GDPR rate limiter for data export/deletion endpoints.
 * 5 requests per 24 hours per IP.
 */
export const gdprRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  prefix: 'rl:gdpr:',
  message: { error: 'Data export/deletion limit reached. Try again tomorrow.' },
});

/**
 * Create an Express-compatible mock for Node HTTP handlers.
 * This allows express-rate-limit middleware to work with Bolt custom routes.
 */
function createExpressMock(req: IncomingMessage, res: ServerResponse) {
  // Extract IP from various sources (proxy headers, connection)
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.socket?.remoteAddress || '127.0.0.1';

  // Parse URL for path
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Capture original methods before overwriting to avoid infinite recursion
  const originalSetHeader = res.setHeader.bind(res);

  // Create Express-like request object
  const expressReq = Object.assign(req, {
    ip,
    path: url.pathname,
    app: { get: () => undefined }, // Minimal app mock
  });

  // Create Express-like response object with chainable methods
  const expressRes = {
    // Preserve all original response properties/methods
    ...res,
    statusCode: res.statusCode,
    status: function(code: number) {
      res.statusCode = code;
      return this;
    },
    json: function(data: unknown) {
      originalSetHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return this;
    },
    set: function(name: string, value: string) {
      originalSetHeader(name, value);
      return this;
    },
    setHeader: function(name: string, value: string | number | readonly string[]) {
      originalSetHeader(name, value);
      return this;
    },
    writeHead: res.writeHead.bind(res),
    end: res.end.bind(res),
    writableEnded: res.writableEnded,
  };

  return { expressReq, expressRes };
}

/**
 * Wrap a Node HTTP handler with rate limiting.
 * Applies the specified rate limiter before the handler executes.
 *
 * @param limiter - The rate limiter to apply (apiRateLimiter, authRateLimiter, or gdprRateLimiter)
 * @param handler - The original Node HTTP handler
 * @returns A new handler that applies rate limiting first
 */
export function withRateLimit(
  limiter: RateLimitRequestHandler,
  handler: NodeHttpHandler
): NodeHttpHandler {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const { expressReq, expressRes } = createExpressMock(req, res);

    return new Promise<void>((resolve) => {
      // Run the rate limiter middleware
      // @ts-expect-error - We're adapting Node HTTP to Express-like interface
      limiter(expressReq, expressRes, async (err?: Error) => {
        if (err) {
          logger.error({ err }, 'Rate limiter error');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
          resolve();
          return;
        }

        // If response was already sent (rate limited), don't call handler
        if (res.writableEnded) {
          resolve();
          return;
        }

        // Call the original handler
        try {
          await handler(req, res);
        } catch (handlerErr) {
          logger.error({ err: handlerErr }, 'Handler error after rate limit check');
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
        resolve();
      });
    });
  };
}
