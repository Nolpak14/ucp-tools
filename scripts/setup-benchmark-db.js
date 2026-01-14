/**
 * Setup script for benchmark database tables
 * Run with: node scripts/setup-benchmark-db.js
 */

import pg from 'pg';

const { Pool } = pg;

async function setup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Creating benchmark tables...');

    // Create benchmark_stats table for aggregate statistics
    await pool.query(`
      CREATE TABLE IF NOT EXISTS benchmark_stats (
        id SERIAL PRIMARY KEY,
        score_bucket INT NOT NULL CHECK (score_bucket >= 0 AND score_bucket <= 100),
        count INT DEFAULT 0,
        UNIQUE(score_bucket)
      );
    `);

    // Initialize score buckets (0-10, 10-20, ..., 90-100)
    for (let bucket = 0; bucket <= 100; bucket += 10) {
      await pool.query(`
        INSERT INTO benchmark_stats (score_bucket, count)
        VALUES ($1, 0)
        ON CONFLICT (score_bucket) DO NOTHING;
      `, [bucket]);
    }

    // Create summary table for quick stats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS benchmark_summary (
        id INT PRIMARY KEY DEFAULT 1,
        total_validations INT DEFAULT 0,
        avg_score DECIMAL(5,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (id = 1)
      );
    `);

    // Initialize summary row
    await pool.query(`
      INSERT INTO benchmark_summary (id, total_validations, avg_score)
      VALUES (1, 0, 0)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✓ Benchmark tables created successfully');

    // Verify setup
    const result = await pool.query('SELECT * FROM benchmark_stats ORDER BY score_bucket');
    console.log('Score buckets:', result.rows.length);

  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
