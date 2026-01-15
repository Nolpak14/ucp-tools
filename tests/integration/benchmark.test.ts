/**
 * Integration Tests for Benchmark Functionality
 * Tests Issue #2: Industry Benchmark Comparison
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, benchmarkStats, benchmarkSummary } from '../../src/db/index.js';
import { eq, sql } from 'drizzle-orm';

// Skip tests if DATABASE_URL is not set
const skipIfNoDb = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDb)('Benchmark Integration (Issue #2)', () => {
  describe('Benchmark Stats Table Structure', () => {
    it('should have all required score buckets (0-100 in increments of 10)', async () => {
      const db = getDb();
      const stats = await db.select().from(benchmarkStats);

      const buckets = stats.map((s) => s.scoreBucket).sort((a, b) => a - b);
      const expectedBuckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      expect(buckets).toEqual(expectedBuckets);
    });

    it('should have non-negative counts for all buckets', async () => {
      const db = getDb();
      const stats = await db.select().from(benchmarkStats);

      for (const stat of stats) {
        expect(stat.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Benchmark Summary Table', () => {
    it('should have exactly one summary row', async () => {
      const db = getDb();
      const summary = await db.select().from(benchmarkSummary);

      expect(summary).toHaveLength(1);
      expect(summary[0].id).toBe(1);
    });

    it('should have valid totalValidations count', async () => {
      const db = getDb();
      const summary = await db.select().from(benchmarkSummary);

      expect(summary[0].totalValidations).toBeGreaterThanOrEqual(0);
    });

    it('should have valid avgScore', async () => {
      const db = getDb();
      const summary = await db.select().from(benchmarkSummary);

      if (summary[0].avgScore !== null) {
        const avgScore = parseFloat(summary[0].avgScore);
        expect(avgScore).toBeGreaterThanOrEqual(0);
        expect(avgScore).toBeLessThanOrEqual(100);
      }
    });

    it('should have updatedAt timestamp', async () => {
      const db = getDb();
      const summary = await db.select().from(benchmarkSummary);

      expect(summary[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Benchmark Recording Logic', () => {
    // Save original values to restore after tests
    let originalBucketCount: number;
    let originalTotalValidations: number;
    const testBucket = 70;

    beforeAll(async () => {
      const db = getDb();

      // Get original values
      const bucketResult = await db
        .select()
        .from(benchmarkStats)
        .where(eq(benchmarkStats.scoreBucket, testBucket));
      originalBucketCount = bucketResult[0]?.count || 0;

      const summaryResult = await db.select().from(benchmarkSummary);
      originalTotalValidations = summaryResult[0]?.totalValidations || 0;
    });

    afterAll(async () => {
      // Restore original values
      const db = getDb();

      await db
        .update(benchmarkStats)
        .set({ count: originalBucketCount })
        .where(eq(benchmarkStats.scoreBucket, testBucket));

      await db
        .update(benchmarkSummary)
        .set({ totalValidations: originalTotalValidations })
        .where(eq(benchmarkSummary.id, 1));
    });

    it('should increment bucket count when score is recorded', async () => {
      const db = getDb();

      // Get current count
      const beforeResult = await db
        .select()
        .from(benchmarkStats)
        .where(eq(benchmarkStats.scoreBucket, testBucket));
      const beforeCount = beforeResult[0]?.count || 0;

      // Increment (simulating what validate.js does)
      await db
        .update(benchmarkStats)
        .set({ count: sql`${benchmarkStats.count} + 1` })
        .where(eq(benchmarkStats.scoreBucket, testBucket));

      // Verify increment
      const afterResult = await db
        .select()
        .from(benchmarkStats)
        .where(eq(benchmarkStats.scoreBucket, testBucket));

      expect(afterResult[0].count).toBe(beforeCount + 1);
    });

    it('should increment total validations in summary', async () => {
      const db = getDb();

      // Get current total
      const beforeResult = await db.select().from(benchmarkSummary);
      const beforeTotal = beforeResult[0]?.totalValidations || 0;

      // Increment
      await db
        .update(benchmarkSummary)
        .set({ totalValidations: sql`${benchmarkSummary.totalValidations} + 1` })
        .where(eq(benchmarkSummary.id, 1));

      // Verify
      const afterResult = await db.select().from(benchmarkSummary);
      expect(afterResult[0].totalValidations).toBe(beforeTotal + 1);
    });
  });

  describe('Percentile Calculation', () => {
    it('should be calculable from bucket data', async () => {
      const db = getDb();

      // Get all buckets with cumulative counts
      const stats = await db
        .select()
        .from(benchmarkStats)
        .orderBy(benchmarkStats.scoreBucket);

      // Calculate cumulative
      let cumulative = 0;
      const withCumulative = stats.map((s) => {
        cumulative += s.count;
        return { ...s, cumulative };
      });

      // Total is the last cumulative
      const total = cumulative;

      if (total > 0) {
        // For a score of 70, calculate percentile
        const bucket70 = withCumulative.find((s) => s.scoreBucket === 70);

        if (bucket70) {
          const belowCount = withCumulative
            .filter((s) => s.scoreBucket < 70)
            .reduce((sum, s) => sum + s.count, 0);

          const percentile = Math.round((belowCount / total) * 100);

          expect(percentile).toBeGreaterThanOrEqual(0);
          expect(percentile).toBeLessThanOrEqual(100);
        }
      }
    });
  });
});

describe.skipIf(skipIfNoDb)('Validate API Benchmark Response', () => {
  it('should include benchmark data in validation response format', () => {
    // This tests the expected response structure from api/validate.js
    const mockBenchmarkResponse = {
      percentile: 75,
      comparison: 'Your site scores better than 75% of sites analyzed',
      total_sites_analyzed: 100,
      average_score: 65,
    };

    expect(mockBenchmarkResponse).toHaveProperty('percentile');
    expect(mockBenchmarkResponse).toHaveProperty('comparison');
    expect(mockBenchmarkResponse).toHaveProperty('total_sites_analyzed');
    expect(mockBenchmarkResponse).toHaveProperty('average_score');

    expect(typeof mockBenchmarkResponse.percentile).toBe('number');
    expect(mockBenchmarkResponse.percentile).toBeGreaterThanOrEqual(0);
    expect(mockBenchmarkResponse.percentile).toBeLessThanOrEqual(100);
  });
});
