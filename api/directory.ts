/**
 * Vercel Serverless Function: UCP Merchant Directory
 *
 * GET /api/directory - List merchants with pagination and filters
 * POST /api/directory - Submit a new merchant to the directory
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listMerchants, submitMerchant } from '../src/services/directory.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handled by vercel.json, but keep for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const result = await listMerchants({
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        category: req.query.category as string,
        country: req.query.country as string,
        search: req.query.search as string,
        sort: req.query.sort as 'score' | 'domain' | 'displayName' | 'createdAt',
        order: req.query.order as 'asc' | 'desc',
      });

      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const { domain, displayName, description, logoUrl, websiteUrl, category, countryCode } = req.body;

      if (!domain) {
        return res.status(400).json({ error: 'Missing required field: domain' });
      }

      const result = await submitMerchant({
        domain,
        displayName,
        description,
        logoUrl,
        websiteUrl,
        category,
        countryCode,
      });

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          details: result.details,
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Merchant added to directory',
        merchant: result.merchant,
        directoryUrl: `https://ucptools.dev/directory#${result.merchant?.domain}`,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Directory API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
