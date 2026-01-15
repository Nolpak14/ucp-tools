/**
 * Seed database with initial data
 * Run with: npx tsx scripts/seed-db.ts
 */

import pg from 'pg';

const { Pool } = pg;

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🌱 Seeding database...\n');

    // Verify tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('✅ Tables created:');
    for (const row of tablesResult.rows) {
      console.log(`   - ${row.table_name}`);
    }

    // Initialize score buckets (0-10, 10-20, ..., 90-100)
    console.log('\n📊 Initializing benchmark score buckets...');
    for (let bucket = 0; bucket <= 100; bucket += 10) {
      await pool.query(`
        INSERT INTO benchmark_stats (score_bucket, count)
        VALUES ($1, 0)
        ON CONFLICT (score_bucket) DO NOTHING;
      `, [bucket]);
    }
    console.log('   Score buckets 0-100 initialized');

    // Initialize summary row
    console.log('\n📈 Initializing benchmark summary...');
    await pool.query(`
      INSERT INTO benchmark_summary (id, total_validations, avg_score)
      VALUES (1, 0, 0)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('   Summary row initialized');

    // Verify data
    const statsCount = await pool.query('SELECT COUNT(*) as count FROM benchmark_stats');
    const summaryCount = await pool.query('SELECT COUNT(*) as count FROM benchmark_summary');
    const merchantsCount = await pool.query('SELECT COUNT(*) as count FROM merchants');

    console.log('\n✅ Database seeded successfully:');
    console.log(`   - benchmark_stats: ${statsCount.rows[0].count} rows`);
    console.log(`   - benchmark_summary: ${summaryCount.rows[0].count} rows`);
    console.log(`   - merchants: ${merchantsCount.rows[0].count} rows`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
