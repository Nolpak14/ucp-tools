/**
 * Reset database script - drops existing tables and prepares for Drizzle migrations
 * Run with: npx tsx scripts/reset-db.ts
 */

import pg from 'pg';

const { Pool } = pg;

async function resetDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 Inspecting current database schema...\n');

    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('Current tables:');
    if (tablesResult.rows.length === 0) {
      console.log('  (no tables found)');
    } else {
      for (const row of tablesResult.rows) {
        // Get column info for each table
        const columnsResult = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [row.table_name]);

        console.log(`\n  📋 ${row.table_name}:`);
        for (const col of columnsResult.rows) {
          console.log(`     - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
        }

        // Get row count
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
        console.log(`     (${countResult.rows[0].count} rows)`);
      }
    }

    console.log('\n\n🗑️  Dropping all existing tables...\n');

    // Drop tables in correct order (handle dependencies)
    const dropStatements = [
      'DROP TABLE IF EXISTS merchants CASCADE',
      'DROP TABLE IF EXISTS benchmark_stats CASCADE',
      'DROP TABLE IF EXISTS benchmark_summary CASCADE',
      'DROP TABLE IF EXISTS drizzle_migrations CASCADE', // Drizzle migration tracking table
    ];

    for (const stmt of dropStatements) {
      console.log(`  Executing: ${stmt}`);
      await pool.query(stmt);
    }

    console.log('\n✅ Database reset complete. Ready for Drizzle migrations.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetDatabase();
