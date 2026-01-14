/**
 * Vercel Serverless Function: Generate UCP Profile
 * POST /api/generate
 */

function generateProfile({ domain, endpoint, capabilities }) {
  const today = new Date().toISOString().split('T')[0];

  const profile = {
    ucp: {
      version: today,
      services: {
        shopping: {
          version: "1.0",
          spec: "https://ucp.dev/specs/shopping/1.0",
          rest: {
            endpoint: endpoint,
            auth: {
              type: "oauth2",
              flows: ["client_credentials"],
              token_url: `${endpoint}/oauth/token`
            }
          }
        }
      },
      capabilities: []
    }
  };

  // Always add checkout (required)
  profile.ucp.capabilities.push({
    name: "dev.ucp.shopping.checkout",
    version: "1.0",
    spec: "https://ucp.dev/specs/shopping/checkout/1.0",
    schema: "https://ucp.dev/schemas/shopping/checkout/1.0.json"
  });

  // Add optional capabilities
  if (capabilities?.order) {
    profile.ucp.capabilities.push({
      name: "dev.ucp.shopping.order",
      version: "1.0",
      spec: "https://ucp.dev/specs/shopping/order/1.0",
      schema: "https://ucp.dev/schemas/shopping/order/1.0.json"
    });

    // Add signing_keys for order capability
    profile.signing_keys = [
      {
        kid: `${domain.replace(/\./g, '-')}-key-1`,
        alg: "ES256",
        use: "sig",
        kty: "EC",
        crv: "P-256",
        x: "PLACEHOLDER_X_COORDINATE",
        y: "PLACEHOLDER_Y_COORDINATE"
      }
    ];
  }

  if (capabilities?.fulfillment) {
    profile.ucp.capabilities.push({
      name: "dev.ucp.shopping.fulfillment",
      version: "1.0",
      spec: "https://ucp.dev/specs/shopping/fulfillment/1.0",
      schema: "https://ucp.dev/schemas/shopping/fulfillment/1.0.json"
    });
  }

  if (capabilities?.discount) {
    profile.ucp.capabilities.push({
      name: "dev.ucp.shopping.discount",
      version: "1.0",
      spec: "https://ucp.dev/specs/shopping/discount/1.0",
      schema: "https://ucp.dev/schemas/shopping/discount/1.0.json"
    });
  }

  return profile;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, endpoint, capabilities } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Missing required field: domain' });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing required field: endpoint' });
  }

  if (!endpoint.startsWith('https://')) {
    return res.status(400).json({ error: 'Endpoint must use HTTPS' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const cleanEndpoint = endpoint.replace(/\/$/, '');

  const profile = generateProfile({
    domain: cleanDomain,
    endpoint: cleanEndpoint,
    capabilities: capabilities || { checkout: true }
  });

  return res.status(200).json({
    ok: true,
    domain: cleanDomain,
    profile,
    deploy_to: `https://${cleanDomain}/.well-known/ucp`,
    instructions: [
      'Save this JSON as "ucp" (no extension) or "ucp.json"',
      `Upload to your server at /.well-known/ucp`,
      'Set Content-Type: application/json',
      'Add CORS header: Access-Control-Allow-Origin: *',
      profile.signing_keys ? 'Replace PLACEHOLDER values in signing_keys with your actual EC key' : null
    ].filter(Boolean)
  });
}
