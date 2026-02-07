import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

// For DigitalOcean managed databases, we need to handle SSL
const dbUrl = process.env.DATABASE_URL || '';
const isProduction = process.env.NODE_ENV === 'production';

export default {
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
    ssl: isProduction ? 'require' : false,
  },
} satisfies Config;
