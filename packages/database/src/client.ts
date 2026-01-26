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

/**
 * Execute a function within a workspace context.
 * Sets app.current_workspace_id for Row-Level Security policies.
 */
export async function withWorkspaceContext<T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set the workspace context for RLS
    await queryClient.unsafe(`SET LOCAL app.current_workspace_id = '${workspaceId}'`);

    // Execute the provided function within this transaction
    return await fn();
  });
}
