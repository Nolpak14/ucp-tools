/**
 * Vitest Test Setup
 * Runs before all tests
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Verify DATABASE_URL is set for integration tests
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - integration tests will be skipped');
}
