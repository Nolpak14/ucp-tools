/**
 * Vercel Serverless Function: Benchmark Statistics
 *
 * POST /api/benchmark - Record a new validation score
 * GET /api/benchmark - Get benchmark statistics and percentile
 *
 * Privacy: Only stores aggregate statistics, not individual domains
 */

import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/**
 * Get the score bucket for a given score (0, 10, 20, ..., 100)
 */
function getScoreBucket(score) {
  return Math.floor(score / 10) * 10;
}

/**
 * Calculate percentile for a given score based on distribution
 */
async function calculatePercentile(pool, score) {
  const result = await pool.query(`
    SELECT
      score_bucket,
      count,
      SUM(count) OVER (ORDER BY score_bucket) as cumulative
    FROM benchmark_stats
    ORDER BY score_bucket
  `);

  const summary = await pool.query('SELECT total_validations FROM benchmark_summary WHERE id = 1');
  const total = summary.rows[0]?.total_validations || 0;

  if (total === 0) {
    return 50; // Default to 50th percentile if no data
  }

  const scoreBucket = getScoreBucket(score);
  let belowCount = 0;

  for (const row of result.rows) {
    if (row.score_bucket < scoreBucket) {
      belowCount = row.cumulative;
    } else if (row.score_bucket === scoreBucket) {
      // For the current bucket, count half of it (assume uniform distribution within bucket)
      belowCount = (row.cumulative - row.count) + Math.floor(row.count / 2);
      break;
    }
  }

  return Math.round((belowCount / total) * 100);
}

/**
 * Record a new validation score
 */
async function recordScore(pool, score) {
  const bucket = getScoreBucket(score);

  // Increment the bucket count
  await pool.query(`
    UPDATE benchmark_stats
    SET count = count + 1
    WHERE score_bucket = $1
  `, [bucket]);

  // Update summary statistics
  await pool.query(`
    UPDATE benchmark_summary
    SET
      total_validations = total_validations + 1,
      avg_score = (avg_score * total_validations + $1) / (total_validations + 1),
      updated_at = NOW()
    WHERE id = 1
  `, [score]);
}

/**
 * Get benchmark statistics
 */
async function getStats(pool) {
  const summary = await pool.query('SELECT * FROM benchmark_summary WHERE id = 1');
  const distribution = await pool.query('SELECT score_bucket, count FROM benchmark_stats ORDER BY score_bucket');

  const stats = summary.rows[0] || { total_validations: 0, avg_score: 0 };

  return {
    total_validations: stats.total_validations,
    avg_score: Math.round(stats.avg_score * 10) / 10,
    distribution: distribution.rows.reduce((acc, row) => {
      acc[row.score_bucket] = row.count;
      return acc;
    }, {}),
    updated_at: stats.updated_at,
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const pool = getPool();

  try {
    if (req.method === 'POST') {
      // Record a new score
      const { score } = req.body;

      if (typeof score !== 'number' || score < 0 || score > 100) {
        return res.status(400).json({ error: 'Invalid score. Must be a number between 0 and 100.' });
      }

      await recordScore(pool, score);
      const percentile = await calculatePercentile(pool, score);
      const stats = await getStats(pool);

      return res.status(200).json({
        recorded: true,
        percentile,
        stats: {
          total_validations: stats.total_validations,
          avg_score: stats.avg_score,
        }
      });

    } else if (req.method === 'GET') {
      // Get benchmark statistics
      const score = req.query.score ? parseInt(req.query.score, 10) : null;
      const stats = await getStats(pool);

      const response = {
        stats,
      };

      // If score provided, calculate percentile
      if (score !== null && !isNaN(score) && score >= 0 && score <= 100) {
        response.percentile = await calculatePercentile(pool, score);
      }

      return res.status(200).json(response);

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Benchmark API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
