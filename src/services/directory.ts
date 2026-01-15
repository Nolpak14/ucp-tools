/**
 * Directory Service
 * Business logic for the UCP Merchant Directory
 */

import { eq, ilike, sql, desc, asc, and, count, SQL } from 'drizzle-orm';
import { getDb, merchants, type Merchant, type NewMerchant } from '../db/index.js';

// Types
export interface ListMerchantsParams {
  page?: number;
  limit?: number;
  category?: string;
  country?: string;
  search?: string;
  sort?: 'score' | 'domain' | 'displayName' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface ListMerchantsResult {
  merchants: Merchant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categories: { name: string; count: number }[];
    countries: { code: string; count: number }[];
  };
}

export interface SubmitMerchantParams {
  domain: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  category?: string;
  countryCode?: string;
}

export interface DirectoryStats {
  totalMerchants: number;
  verifiedMerchants: number;
  avgScore: number;
  totalCategories: number;
  totalCountries: number;
  gradeDistribution: { grade: string; count: number }[];
  topCategories: { name: string; count: number }[];
  recentAdditions: { domain: string; displayName: string; grade: string | null; addedAt: Date }[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  score?: number;
  grade?: string;
  transports?: string;
  ucpVersion?: string;
}

// UCP Profile structure (minimal typing for validation)
interface UcpProfile {
  ucp?: {
    version?: string;
    services?: Record<string, { rest?: unknown; mcp?: unknown; a2a?: unknown; embedded?: unknown }>;
    capabilities?: Array<{ name: string }>;
  };
  signing_keys?: unknown[];
}

/**
 * Fetch UCP profile from a URL, return null if not valid JSON
 */
async function tryFetchProfile(url: string): Promise<UcpProfile | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'UCP-Directory/1.0 (https://ucptools.dev)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const text = await res.text();
    // Check if response looks like JSON (not HTML)
    if (text.trim().startsWith('<')) return null;

    return JSON.parse(text) as UcpProfile;
  } catch {
    return null;
  }
}

/**
 * Validate a domain's UCP profile
 */
export async function validateDomain(domain: string): Promise<ValidationResult> {
  // Try both /.well-known/ucp and /.well-known/ucp.json
  const urls = [
    `https://${domain}/.well-known/ucp`,
    `https://${domain}/.well-known/ucp.json`,
  ];

  let profile: UcpProfile | null = null;

  for (const url of urls) {
    profile = await tryFetchProfile(url);
    if (profile) break;
  }

  try {
    if (!profile) {
      return { valid: false, error: 'No UCP profile found at /.well-known/ucp or /.well-known/ucp.json' };
    }

    // Basic validation
    if (!profile?.ucp?.version || !profile?.ucp?.services) {
      return { valid: false, error: 'Invalid UCP profile structure' };
    }

    // Extract transports
    const transports = new Set<string>();
    for (const svc of Object.values(profile.ucp.services || {})) {
      if (svc.rest) transports.add('REST');
      if (svc.mcp) transports.add('MCP');
      if (svc.a2a) transports.add('A2A');
      if (svc.embedded) transports.add('Embedded');
    }

    // Simple scoring
    let score = 50;
    const capabilities = profile.ucp.capabilities || [];
    if (capabilities.some((c) => c.name === 'dev.ucp.shopping.checkout')) score += 20;
    if (capabilities.some((c) => c.name === 'dev.ucp.shopping.cart')) score += 10;
    if (capabilities.some((c) => c.name === 'dev.ucp.shopping.order')) score += 10;
    if (profile.signing_keys && profile.signing_keys.length > 0) score += 10;

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    return {
      valid: true,
      score,
      grade,
      transports: Array.from(transports).join(','),
      ucpVersion: profile.ucp.version,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch profile';
    return { valid: false, error: message };
  }
}

/**
 * List merchants with pagination and filters
 */
export async function listMerchants(params: ListMerchantsParams): Promise<ListMerchantsResult> {
  const db = getDb();

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions: SQL[] = [eq(merchants.isPublic, true)];

  if (params.category) {
    conditions.push(eq(merchants.category, params.category));
  }

  if (params.country) {
    conditions.push(eq(merchants.countryCode, params.country.toUpperCase()));
  }

  if (params.search) {
    conditions.push(
      sql`(${merchants.domain} ILIKE ${`%${params.search}%`} OR ${merchants.displayName} ILIKE ${`%${params.search}%`})`
    );
  }

  const whereClause = and(...conditions);

  // Determine sort column and order
  const sortColumn =
    params.sort === 'domain'
      ? merchants.domain
      : params.sort === 'displayName'
        ? merchants.displayName
        : params.sort === 'createdAt'
          ? merchants.createdAt
          : merchants.ucpScore;

  const orderFn = params.order === 'asc' ? asc : desc;

  // Get total count
  const countResult = await db
    .select({ total: count() })
    .from(merchants)
    .where(whereClause);

  const total = countResult[0]?.total || 0;

  // Get merchants
  const merchantList = await db
    .select()
    .from(merchants)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  // Get category counts
  const categoryResult = await db
    .select({
      category: merchants.category,
      count: count(),
    })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.category} IS NOT NULL`))
    .groupBy(merchants.category)
    .orderBy(desc(count()));

  // Get country counts
  const countryResult = await db
    .select({
      countryCode: merchants.countryCode,
      count: count(),
    })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.countryCode} IS NOT NULL`))
    .groupBy(merchants.countryCode)
    .orderBy(desc(count()));

  return {
    merchants: merchantList,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    filters: {
      categories: categoryResult.map((r) => ({ name: r.category!, count: r.count })),
      countries: countryResult.map((r) => ({ code: r.countryCode!, count: r.count })),
    },
  };
}

/**
 * Get a single merchant by domain
 */
export async function getMerchantByDomain(domain: string): Promise<Merchant | null> {
  const db = getDb();
  const result = await db.select().from(merchants).where(eq(merchants.domain, domain.toLowerCase())).limit(1);
  return result[0] || null;
}

/**
 * Submit a new merchant to the directory
 */
export async function submitMerchant(
  params: SubmitMerchantParams
): Promise<{ success: boolean; merchant?: Merchant; error?: string; details?: string }> {
  const db = getDb();

  // Clean domain
  const cleanDomain = params.domain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .split('/')[0]
    .toLowerCase();

  // Check if domain already exists
  const existing = await getMerchantByDomain(cleanDomain);
  if (existing) {
    return {
      success: false,
      error: 'Domain already registered',
      details: `Merchant ID: ${existing.id}`,
    };
  }

  // Validate the domain has a valid UCP profile
  const validation = await validateDomain(cleanDomain);

  if (!validation.valid) {
    return {
      success: false,
      error: 'Invalid UCP profile',
      details: validation.error,
    };
  }

  // Insert merchant
  const newMerchant: NewMerchant = {
    domain: cleanDomain,
    displayName: params.displayName || cleanDomain,
    description: params.description || null,
    logoUrl: params.logoUrl || null,
    websiteUrl: params.websiteUrl || `https://${cleanDomain}`,
    category: params.category || null,
    countryCode: params.countryCode?.toUpperCase() || null,
    ucpScore: validation.score || null,
    ucpGrade: validation.grade || null,
    transports: validation.transports || null,
    isPublic: true,
    isVerified: false,
    lastValidatedAt: new Date(),
  };

  const result = await db.insert(merchants).values(newMerchant).returning();

  return {
    success: true,
    merchant: result[0],
  };
}

/**
 * Get directory statistics
 */
export async function getDirectoryStats(): Promise<DirectoryStats> {
  const db = getDb();

  // Overall stats
  const statsResult = await db
    .select({
      totalMerchants: count(),
      verifiedMerchants: sql<number>`COUNT(*) FILTER (WHERE ${merchants.isVerified} = true)`,
      avgScore: sql<number>`COALESCE(AVG(${merchants.ucpScore}), 0)`,
    })
    .from(merchants)
    .where(eq(merchants.isPublic, true));

  // Count distinct categories and countries
  const categoryCountResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${merchants.category})` })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.category} IS NOT NULL`));

  const countryCountResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${merchants.countryCode})` })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.countryCode} IS NOT NULL`));

  // Grade distribution
  const gradeResult = await db
    .select({
      grade: merchants.ucpGrade,
      count: count(),
    })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.ucpGrade} IS NOT NULL`))
    .groupBy(merchants.ucpGrade)
    .orderBy(merchants.ucpGrade);

  // Top categories
  const topCategoriesResult = await db
    .select({
      name: merchants.category,
      count: count(),
    })
    .from(merchants)
    .where(and(eq(merchants.isPublic, true), sql`${merchants.category} IS NOT NULL`))
    .groupBy(merchants.category)
    .orderBy(desc(count()))
    .limit(10);

  // Recent additions
  const recentResult = await db
    .select({
      domain: merchants.domain,
      displayName: merchants.displayName,
      grade: merchants.ucpGrade,
      addedAt: merchants.createdAt,
    })
    .from(merchants)
    .where(eq(merchants.isPublic, true))
    .orderBy(desc(merchants.createdAt))
    .limit(5);

  const stats = statsResult[0];

  return {
    totalMerchants: stats?.totalMerchants || 0,
    verifiedMerchants: stats?.verifiedMerchants || 0,
    avgScore: Math.round(stats?.avgScore || 0),
    totalCategories: categoryCountResult[0]?.count || 0,
    totalCountries: countryCountResult[0]?.count || 0,
    gradeDistribution: gradeResult.map((r) => ({ grade: r.grade!, count: r.count })),
    topCategories: topCategoriesResult.map((r) => ({ name: r.name!, count: r.count })),
    recentAdditions: recentResult.map((r) => ({
      domain: r.domain,
      displayName: r.displayName,
      grade: r.grade,
      addedAt: r.addedAt,
    })),
  };
}

/**
 * Re-validate a merchant's UCP profile and update their record
 */
export async function revalidateMerchant(domain: string): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  const merchant = await getMerchantByDomain(domain);
  if (!merchant) {
    return { success: false, error: 'Merchant not found' };
  }

  const validation = await validateDomain(domain);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  await db
    .update(merchants)
    .set({
      ucpScore: validation.score || null,
      ucpGrade: validation.grade || null,
      transports: validation.transports || null,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(merchants.domain, domain.toLowerCase()));

  return { success: true };
}
