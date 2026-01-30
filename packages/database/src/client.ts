import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || '';

const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// UUID v4 format validation regex (prevents SQL injection)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a properly formatted UUID.
 * This prevents SQL injection in RLS context setting.
 */
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Execute a function within a workspace context.
 * Sets app.current_workspace_id for Row-Level Security policies.
 *
 * @throws Error if workspaceId is not a valid UUID format
 */
export async function withWorkspaceContext<T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Validate UUID format to prevent SQL injection
  if (!isValidUUID(workspaceId)) {
    throw new Error(`Invalid workspace ID format: must be a valid UUID`);
  }

  return await db.transaction(async (tx) => {
    // Set the workspace context for RLS (safe after UUID validation)
    await queryClient.unsafe(`SET LOCAL app.current_workspace_id = '${workspaceId}'`);

    // Execute the provided function within this transaction
    return await fn();
  });
}
