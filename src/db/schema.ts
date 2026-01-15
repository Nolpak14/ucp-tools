import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  index,
  decimal,
} from 'drizzle-orm/pg-core';

/**
 * Merchants table - stores UCP-enabled merchant directory entries
 */
export const merchants = pgTable(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The merchant's primary domain (e.g., "example.com")
    domain: varchar('domain', { length: 255 }).notNull().unique(),
    // Display name for the merchant
    displayName: varchar('display_name', { length: 255 }).notNull(),
    // Optional description
    description: text('description'),
    // Logo URL
    logoUrl: varchar('logo_url', { length: 512 }),
    // Website URL (full URL including protocol)
    websiteUrl: varchar('website_url', { length: 512 }),
    // Category (e-commerce, saas, marketplace, etc.)
    category: varchar('category', { length: 100 }),
    // Country code (ISO 3166-1 alpha-2)
    countryCode: varchar('country_code', { length: 2 }),
    // UCP readiness score (0-100)
    ucpScore: integer('ucp_score'),
    // UCP grade (A, B, C, D, F)
    ucpGrade: varchar('ucp_grade', { length: 2 }),
    // Supported transports (comma-separated: REST, MCP, A2A, Embedded)
    transports: varchar('transports', { length: 255 }),
    // Whether the merchant has opted into the directory
    isPublic: boolean('is_public').default(true).notNull(),
    // Whether the merchant has been verified
    isVerified: boolean('is_verified').default(false).notNull(),
    // Last validation timestamp
    lastValidatedAt: timestamp('last_validated_at'),
    // Record timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_merchants_domain').on(table.domain),
    index('idx_merchants_category').on(table.category),
    index('idx_merchants_country').on(table.countryCode),
    index('idx_merchants_score').on(table.ucpScore),
    index('idx_merchants_public').on(table.isPublic),
  ]
);

/**
 * Benchmark stats table - stores aggregate validation statistics
 * (migrated from setup script)
 */
export const benchmarkStats = pgTable('benchmark_stats', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  scoreBucket: integer('score_bucket').notNull().unique(),
  count: integer('count').default(0).notNull(),
});

/**
 * Benchmark summary table - quick aggregate stats
 * (migrated from setup script)
 */
export const benchmarkSummary = pgTable('benchmark_summary', {
  id: integer('id').primaryKey().default(1),
  totalValidations: integer('total_validations').default(0).notNull(),
  avgScore: decimal('avg_score', { precision: 5, scale: 2 }).default('0'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports for use in application code
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type BenchmarkStat = typeof benchmarkStats.$inferSelect;
export type BenchmarkSummary = typeof benchmarkSummary.$inferSelect;
