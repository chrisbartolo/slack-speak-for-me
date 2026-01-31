import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file from repository root
config({ path: '../../.env' });

const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis - can be a URL (rediss://user:pass@host:port) or just hostname
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_TLS: z.coerce.boolean().default(false),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().min(1, 'SLACK_CLIENT_ID is required'),
  SLACK_CLIENT_SECRET: z.string().min(1, 'SLACK_CLIENT_SECRET is required'),
  SLACK_SIGNING_SECRET: z.string().min(1, 'SLACK_SIGNING_SECRET is required'),
  SLACK_STATE_SECRET: z.string().min(32, 'SLACK_STATE_SECRET must be at least 32 characters'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/oauth/google/callback'),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // App
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
});

type Env = z.infer<typeof EnvSchema>;

let env: Env;

try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    console.error('');

    for (const issue of error.errors) {
      const path = issue.path.join('.');
      console.error(`  • ${path}: ${issue.message}`);
    }

    console.error('');
    console.error('Required environment variables:');
    console.error('  - SLACK_CLIENT_ID');
    console.error('  - SLACK_CLIENT_SECRET');
    console.error('  - SLACK_SIGNING_SECRET');
    console.error('  - SLACK_STATE_SECRET (min 32 characters)');
    console.error('  - GOOGLE_CLIENT_ID');
    console.error('  - GOOGLE_CLIENT_SECRET');
    console.error('  - DATABASE_URL');
    console.error('  - ENCRYPTION_KEY (64 hex characters)');
    console.error('  - ANTHROPIC_API_KEY');
    console.error('');
    console.error('Optional (with defaults):');
    console.error('  - GOOGLE_REDIRECT_URI (default: http://localhost:3000/oauth/google/callback)');
    console.error('  - REDIS_HOST (default: localhost)');
    console.error('  - REDIS_PORT (default: 6379)');
    console.error('  - NODE_ENV (default: development)');
    console.error('  - PORT (default: 3000)');

    process.exit(1);
  }

  throw error;
}

/**
 * Returns the encryption key as a Buffer
 */
export function getEncryptionKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function getGoogleClientId(): string {
  return env.GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret(): string {
  return env.GOOGLE_CLIENT_SECRET;
}

export function getGoogleRedirectUri(): string {
  return env.GOOGLE_REDIRECT_URI;
}

export { env };
