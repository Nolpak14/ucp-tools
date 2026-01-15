/**
 * Vercel Serverless Function: Directory Statistics
 * GET /api/directory-stats
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDirectoryStats } from '../src/services/directory.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await getDirectoryStats();
    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('Directory stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
