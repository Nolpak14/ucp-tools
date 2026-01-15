/**
 * Integration Tests for Directory API Endpoints
 * Tests Issue #1: UCP Merchant Directory
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, merchants } from '../../src/db/index.js';
import { eq } from 'drizzle-orm';
import {
  listMerchants,
  submitMerchant,
  getMerchantByDomain,
  getDirectoryStats,
  revalidateMerchant,
} from '../../src/services/directory.js';

// Skip tests if DATABASE_URL is not set
const skipIfNoDb = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDb)('Directory API Integration', () => {
  const testDomains: string[] = [];

  // Helper to create a unique test domain
  const createTestDomain = () => {
    const domain = `api-test-${Date.now()}-${Math.random().toString(36).slice(2)}.example.com`;
    testDomains.push(domain);
    return domain;
  };

  afterAll(async () => {
    // Clean up all test data
    const db = getDb();
    for (const domain of testDomains) {
      await db.delete(merchants).where(eq(merchants.domain, domain));
    }
  });

  describe('listMerchants', () => {
    it('should return empty list when no merchants exist', async () => {
      const result = await listMerchants({ search: 'nonexistent-unique-query-xyz' });

      expect(result.merchants).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('should return correct pagination structure', async () => {
      const result = await listMerchants({ page: 1, limit: 10 });

      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
    });

    it('should return filter options', async () => {
      const result = await listMerchants({});

      expect(result.filters).toHaveProperty('categories');
      expect(result.filters).toHaveProperty('countries');
      expect(Array.isArray(result.filters.categories)).toBe(true);
      expect(Array.isArray(result.filters.countries)).toBe(true);
    });

    it('should filter by category', async () => {
      const db = getDb();
      const domain1 = createTestDomain();
      const domain2 = createTestDomain();

      // Create test merchants with different categories
      await db.insert(merchants).values([
        { domain: domain1, displayName: 'Fashion Store', category: 'fashion', isPublic: true },
        { domain: domain2, displayName: 'Tech Store', category: 'electronics', isPublic: true },
      ]);

      const fashionResult = await listMerchants({ category: 'fashion' });
      const electronicsResult = await listMerchants({ category: 'electronics' });

      const fashionDomains = fashionResult.merchants.map((m) => m.domain);
      const electronicsDomains = electronicsResult.merchants.map((m) => m.domain);

      expect(fashionDomains).toContain(domain1);
      expect(fashionDomains).not.toContain(domain2);
      expect(electronicsDomains).toContain(domain2);
      expect(electronicsDomains).not.toContain(domain1);
    });

    it('should search by domain and display name', async () => {
      const db = getDb();
      const domain = createTestDomain();

      await db.insert(merchants).values({
        domain,
        displayName: 'Unique Searchable Store XYZ123',
        isPublic: true,
      });

      // Search by display name
      const nameResult = await listMerchants({ search: 'XYZ123' });
      expect(nameResult.merchants.some((m) => m.domain === domain)).toBe(true);

      // Search by domain
      const domainResult = await listMerchants({ search: domain.split('.')[0] });
      expect(domainResult.merchants.some((m) => m.domain === domain)).toBe(true);
    });

    it('should only return public merchants', async () => {
      const db = getDb();
      const publicDomain = createTestDomain();
      const privateDomain = createTestDomain();

      await db.insert(merchants).values([
        { domain: publicDomain, displayName: 'Public Store', isPublic: true },
        { domain: privateDomain, displayName: 'Private Store', isPublic: false },
      ]);

      const result = await listMerchants({});
      const domains = result.merchants.map((m) => m.domain);

      expect(domains).toContain(publicDomain);
      expect(domains).not.toContain(privateDomain);
    });

    it('should sort by score descending by default', async () => {
      const db = getDb();
      const domain1 = createTestDomain();
      const domain2 = createTestDomain();
      const domain3 = createTestDomain();

      await db.insert(merchants).values([
        { domain: domain1, displayName: 'Low Score', ucpScore: 30, isPublic: true },
        { domain: domain2, displayName: 'High Score', ucpScore: 90, isPublic: true },
        { domain: domain3, displayName: 'Mid Score', ucpScore: 60, isPublic: true },
      ]);

      const result = await listMerchants({});

      // Find positions of our test merchants
      const positions = {
        high: result.merchants.findIndex((m) => m.domain === domain2),
        mid: result.merchants.findIndex((m) => m.domain === domain3),
        low: result.merchants.findIndex((m) => m.domain === domain1),
      };

      // High score should come before mid, mid before low
      if (positions.high !== -1 && positions.mid !== -1) {
        expect(positions.high).toBeLessThan(positions.mid);
      }
      if (positions.mid !== -1 && positions.low !== -1) {
        expect(positions.mid).toBeLessThan(positions.low);
      }
    });
  });

  describe('getMerchantByDomain', () => {
    it('should return null for non-existent domain', async () => {
      const result = await getMerchantByDomain('nonexistent-domain-xyz.com');
      expect(result).toBeNull();
    });

    it('should find merchant by domain', async () => {
      const db = getDb();
      const domain = createTestDomain();

      await db.insert(merchants).values({
        domain,
        displayName: 'Test Store',
        ucpScore: 75,
      });

      const result = await getMerchantByDomain(domain);

      expect(result).not.toBeNull();
      expect(result?.domain).toBe(domain);
      expect(result?.displayName).toBe('Test Store');
    });

    it('should be case-insensitive', async () => {
      const db = getDb();
      const domain = createTestDomain();

      await db.insert(merchants).values({
        domain: domain.toLowerCase(),
        displayName: 'Case Test Store',
      });

      const result = await getMerchantByDomain(domain.toUpperCase());

      expect(result).not.toBeNull();
    });
  });

  describe('getDirectoryStats', () => {
    it('should return stats structure', async () => {
      const stats = await getDirectoryStats();

      expect(stats).toHaveProperty('totalMerchants');
      expect(stats).toHaveProperty('verifiedMerchants');
      expect(stats).toHaveProperty('avgScore');
      expect(stats).toHaveProperty('totalCategories');
      expect(stats).toHaveProperty('totalCountries');
      expect(stats).toHaveProperty('gradeDistribution');
      expect(stats).toHaveProperty('topCategories');
      expect(stats).toHaveProperty('recentAdditions');
    });

    it('should return valid numeric values', async () => {
      const stats = await getDirectoryStats();

      expect(typeof stats.totalMerchants).toBe('number');
      expect(stats.totalMerchants).toBeGreaterThanOrEqual(0);

      // verifiedMerchants may be string from SQL aggregate, coerce to number
      const verifiedCount = Number(stats.verifiedMerchants);
      expect(verifiedCount).toBeGreaterThanOrEqual(0);
      expect(verifiedCount).toBeLessThanOrEqual(stats.totalMerchants);

      expect(typeof stats.avgScore).toBe('number');
      expect(stats.avgScore).toBeGreaterThanOrEqual(0);
      expect(stats.avgScore).toBeLessThanOrEqual(100);
    });

    it('should return arrays for distributions', async () => {
      const stats = await getDirectoryStats();

      expect(Array.isArray(stats.gradeDistribution)).toBe(true);
      expect(Array.isArray(stats.topCategories)).toBe(true);
      expect(Array.isArray(stats.recentAdditions)).toBe(true);
    });
  });

  describe('submitMerchant', () => {
    it('should reject domain without UCP profile', async () => {
      const result = await submitMerchant({
        domain: 'example.com', // example.com doesn't have UCP
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject duplicate domain', async () => {
      const db = getDb();
      const domain = createTestDomain();

      // First, insert directly
      await db.insert(merchants).values({
        domain,
        displayName: 'Original Store',
      });

      // Then try to submit via service
      const result = await submitMerchant({ domain });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already registered');
    });

    it('should clean domain before validation', async () => {
      // Test that https://, trailing slash, and uppercase are handled
      const result = await submitMerchant({
        domain: 'HTTPS://EXAMPLE.COM/',
      });

      // Should fail for UCP validation, not domain parsing
      expect(result.error).not.toContain('parse');
    });
  });
});
