import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema.js';

// Type for our database instance
type Database = NeonHttpDatabase<typeof schema>;

// Lazy-loaded database instance (for serverless cold starts)
let dbInstance: Database | null = null;

/**
 * Get the Drizzle database instance.
 * Lazily creates the connection on first use.
 */
export function getDb(): Database {
  if (!dbInstance) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const sql = neon(process.env.DATABASE_URL);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

// Re-export schema for convenience
export * from './schema.js';
export { schema };
