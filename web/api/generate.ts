/**
 * Vercel Serverless Function: Generate UCP Profile
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CURRENT_UCP_VERSION = '2026-01-11';

interface Capabilities {
  checkout?: boolean;
  order?: boolean;
  fulfillment?: boolean;
  discount?: boolean;
}

function generateProfile(domain: string, endpoint: string, capabilities: Capabilities) {
  const ucpVersion = CURRENT_UCP_VERSION;

  // Normalize endpoint
  let normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint.startsWith('https://')) {
    normalizedEndpoint = normalizedEndpoint.startsWith('http://')
      ? normalizedEndpoint.replace('http://', 'https://')
      : `https://${normalizedEndpoint}`;
  }
  if (normalizedEndpoint.endsWith('/')) {
    normalizedEndpoint = normalizedEndpoint.slice(0, -1);
  }

  // Build capabilities array
  const caps: any[] = [];

  // Checkout (always included)
  caps.push({
    name: 'dev.ucp.shopping.checkout',
    version: ucpVersion,
    spec: 'https://ucp.dev/specification/checkout/',
    schema: 'https://ucp.dev/schemas/shopping/checkout.json',
  });

  // Order
  if (capabilities.order) {
    caps.push({
      name: 'dev.ucp.shopping.order',
      version: ucpVersion,
      spec: 'https://ucp.dev/specification/order/',
      schema: 'https://ucp.dev/schemas/shopping/order.json',
    });
  }

  // Fulfillment (extends Order)
  if (capabilities.fulfillment) {
    caps.push({
      name: 'dev.ucp.shopping.fulfillment',
      version: ucpVersion,
      spec: 'https://ucp.dev/specification/fulfillment/',
      schema: 'https://ucp.dev/schemas/shopping/fulfillment.json',
      extends: 'dev.ucp.shopping.order',
    });
  }

  // Discount
  if (capabilities.discount) {
    caps.push({
      name: 'dev.ucp.shopping.discount',
      version: ucpVersion,
      spec: 'https://ucp.dev/specification/discount/',
      schema: 'https://ucp.dev/schemas/shopping/discount.json',
    });
  }

  const profile: any = {
    ucp: {
      version: ucpVersion,
      services: {
        'dev.ucp.shopping': {
          version: ucpVersion,
          spec: 'https://ucp.dev/specification/overview/',
          rest: {
            schema: 'https://ucp.dev/services/shopping/rest.openapi.json',
            endpoint: normalizedEndpoint,
          },
        },
      },
      capabilities: caps,
    },
  };

  // Add placeholder signing keys if Order is enabled
  if (capabilities.order) {
    profile.signing_keys = [
      {
        kty: 'EC',
        kid: 'ucp-key-1',
        use: 'sig',
        alg: 'ES256',
        crv: 'P-256',
        x: 'REPLACE_WITH_YOUR_PUBLIC_KEY_X',
        y: 'REPLACE_WITH_YOUR_PUBLIC_KEY_Y',
      },
    ];
  }

  return profile;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, endpoint, capabilities = {} } = req.body || {};

  if (!domain) {
    return res.status(400).json({ error: 'Missing required field: domain' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing required field: endpoint' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const profile = generateProfile(cleanDomain, endpoint, capabilities);

  return res.status(200).json({
    profile,
    instructions: `Deploy this file to https://${cleanDomain}/.well-known/ucp`,
    generated_at: new Date().toISOString(),
  });
}
