/**
 * Integration Tests for Database
 * Tests database connectivity and schema
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, merchants, benchmarkStats, benchmarkSummary } from '../../src/db/index.js';
import { eq, sql } from 'drizzle-orm';

// Skip tests if DATABASE_URL is not set
const skipIfNoDb = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDb)('Database Integration', () => {
  describe('Connection', () => {
    it('should connect to the database successfully', async () => {
      const db = getDb();
      expect(db).toBeDefined();

      // Simple query to verify connection
      const result = await db.execute(sql`SELECT 1 as test`);
      expect(result).toBeDefined();
    });

    it('should use lazy initialization', () => {
      // getDb should return the same instance
      const db1 = getDb();
      const db2 = getDb();
      expect(db1).toBe(db2);
    });
  });

  describe('Merchants Table', () => {
    const testDomain = `test-${Date.now()}.example.com`;

    afterAll(async () => {
      // Clean up test data
      const db = getDb();
      await db.delete(merchants).where(eq(merchants.domain, testDomain));
    });

    it('should insert a merchant', async () => {
      const db = getDb();

      const result = await db
        .insert(merchants)
        .values({
          domain: testDomain,
          displayName: 'Test Merchant',
          description: 'A test merchant for integration testing',
          category: 'test',
          countryCode: 'US',
          ucpScore: 75,
          ucpGrade: 'C',
          transports: 'REST',
          isPublic: true,
          isVerified: false,
        })
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe(testDomain);
      expect(result[0].id).toBeDefined();
    });

    it('should query merchants', async () => {
      const db = getDb();

      const result = await db
        .select()
        .from(merchants)
        .where(eq(merchants.domain, testDomain));

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Test Merchant');
      expect(result[0].ucpScore).toBe(75);
    });

    it('should update a merchant', async () => {
      const db = getDb();

      await db
        .update(merchants)
        .set({ ucpScore: 85, ucpGrade: 'B' })
        .where(eq(merchants.domain, testDomain));

      const result = await db
        .select()
        .from(merchants)
        .where(eq(merchants.domain, testDomain));

      expect(result[0].ucpScore).toBe(85);
      expect(result[0].ucpGrade).toBe('B');
    });

    it('should enforce unique domain constraint', async () => {
      const db = getDb();

      await expect(
        db.insert(merchants).values({
          domain: testDomain,
          displayName: 'Duplicate Merchant',
        })
      ).rejects.toThrow();
    });
  });

  describe('Benchmark Stats Table (Issue #2)', () => {
    it('should have score buckets from 0 to 100', async () => {
      const db = getDb();

      const result = await db.select().from(benchmarkStats);

      expect(result.length).toBe(11); // 0, 10, 20, ..., 100

      const buckets = result.map((r) => r.scoreBucket).sort((a, b) => a - b);
      expect(buckets).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    });

    it('should have count field for each bucket', async () => {
      const db = getDb();

      const result = await db.select().from(benchmarkStats);

      for (const row of result) {
        expect(typeof row.count).toBe('number');
        expect(row.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Benchmark Summary Table (Issue #2)', () => {
    it('should have a summary row', async () => {
      const db = getDb();

      const result = await db.select().from(benchmarkSummary);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('should track total validations', async () => {
      const db = getDb();

      const result = await db.select().from(benchmarkSummary);

      expect(typeof result[0].totalValidations).toBe('number');
      expect(result[0].totalValidations).toBeGreaterThanOrEqual(0);
    });

    it('should track average score', async () => {
      const db = getDb();

      const result = await db.select().from(benchmarkSummary);

      // avgScore can be null or a string (decimal type)
      if (result[0].avgScore !== null) {
        const avgScore = parseFloat(result[0].avgScore);
        expect(avgScore).toBeGreaterThanOrEqual(0);
        expect(avgScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
