/**
 * PGlite database helpers for integration tests
 *
 * Provides in-memory PostgreSQL for isolated test execution.
 * Schema matches production database structure.
 */
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@slack-speak/database';
/**
 * Initialize a fresh PGlite instance with schema
 * Call this in beforeAll or beforeEach depending on isolation needs
 */
export declare function setupTestDb(): Promise<import("drizzle-orm/pglite").PgliteDatabase<typeof schema> & {
    $client: PGlite;
}>;
/**
 * Clean up PGlite instance
 * Call this in afterAll to release resources
 */
export declare function cleanupTestDb(): Promise<void>;
/**
 * Get the current test database instance
 * Throws if not initialized
 */
export declare function getTestDb(): import("drizzle-orm/pglite").PgliteDatabase<typeof schema> & {
    $client: PGlite;
};
/**
 * Get the raw PGlite instance for direct SQL execution
 * Useful for verifying data or complex queries
 */
export declare function getPGlite(): PGlite;
/**
 * Clear all tables while keeping schema
 * Useful for resetting state between tests within same suite
 */
export declare function clearAllTables(): Promise<void>;
/**
 * Seed a workspace with installation for testing
 * Returns the created workspace ID
 */
export declare function seedWorkspace(options?: {
    teamId?: string;
    name?: string;
    botToken?: string;
    botUserId?: string;
}): Promise<string>;
//# sourceMappingURL=db.d.ts.map