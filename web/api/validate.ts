/**
 * Vercel Serverless Function: Validate UCP Profile
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline the validation logic to avoid bundling issues
const VERSION_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface ValidationIssue {
  severity: 'error' | 'warn' | 'info';
  code: string;
  path: string;
  message: string;
  hint?: string;
}

interface ValidationReport {
  ok: boolean;
  profile_url?: string;
  ucp_version?: string;
  issues: ValidationIssue[];
  validated_at: string;
}

async function fetchProfile(domain: string): Promise<{ profile: any; error?: string }> {
  const url = `https://${domain}/.well-known/ucp`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'UCP-Validator/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return { profile: null, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const profile = await res.json();
    return { profile };
  } catch (e: any) {
    return { profile: null, error: e.message || 'Failed to fetch profile' };
  }
}

function validateStructure(profile: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!profile || typeof profile !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', path: '$', message: 'Profile must be a JSON object' });
    return issues;
  }

  if (!profile.ucp || typeof profile.ucp !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', path: '$.ucp', message: 'Missing required "ucp" object' });
    return issues;
  }

  const ucp = profile.ucp;

  if (!ucp.version) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_VERSION', path: '$.ucp.version', message: 'Missing required "version" field' });
  } else if (!VERSION_REGEX.test(ucp.version)) {
    issues.push({ severity: 'error', code: 'UCP_INVALID_VERSION', path: '$.ucp.version', message: `Invalid version format: "${ucp.version}"`, hint: 'Use YYYY-MM-DD format' });
  }

  if (!ucp.services || typeof ucp.services !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_SERVICES', path: '$.ucp.services', message: 'Missing required "services" field' });
  } else {
    for (const [name, svc] of Object.entries(ucp.services as Record<string, any>)) {
      if (!svc.version) issues.push({ severity: 'error', code: 'UCP_INVALID_SERVICE', path: `$.ucp.services["${name}"].version`, message: `Service "${name}" missing version` });
      if (!svc.spec) issues.push({ severity: 'error', code: 'UCP_INVALID_SERVICE', path: `$.ucp.services["${name}"].spec`, message: `Service "${name}" missing spec` });
      if (!svc.rest && !svc.mcp && !svc.a2a && !svc.embedded) {
        issues.push({ severity: 'warn', code: 'UCP_NO_TRANSPORT', path: `$.ucp.services["${name}"]`, message: `Service "${name}" has no transport bindings` });
      }
      if (svc.rest?.endpoint) {
        if (!svc.rest.endpoint.startsWith('https://')) {
          issues.push({ severity: 'error', code: 'UCP_ENDPOINT_NOT_HTTPS', path: `$.ucp.services["${name}"].rest.endpoint`, message: 'Endpoint must use HTTPS' });
        }
        if (svc.rest.endpoint.endsWith('/')) {
          issues.push({ severity: 'warn', code: 'UCP_ENDPOINT_TRAILING_SLASH', path: `$.ucp.services["${name}"].rest.endpoint`, message: 'Endpoint should not have trailing slash' });
        }
      }
    }
  }

  if (!ucp.capabilities || !Array.isArray(ucp.capabilities)) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_CAPABILITIES', path: '$.ucp.capabilities', message: 'Missing required "capabilities" array' });
  } else {
    const capNames = new Set(ucp.capabilities.map((c: any) => c.name));
    ucp.capabilities.forEach((cap: any, i: number) => {
      const path = `$.ucp.capabilities[${i}]`;
      if (!cap.name) issues.push({ severity: 'error', code: 'UCP_INVALID_CAPABILITY', path: `${path}.name`, message: 'Capability missing name' });
      if (!cap.version) issues.push({ severity: 'error', code: 'UCP_INVALID_CAPABILITY', path: `${path}.version`, message: 'Capability missing version' });
      if (!cap.spec) issues.push({ severity: 'error', code: 'UCP_INVALID_CAPABILITY', path: `${path}.spec`, message: 'Capability missing spec' });
      if (!cap.schema) issues.push({ severity: 'error', code: 'UCP_INVALID_CAPABILITY', path: `${path}.schema`, message: 'Capability missing schema' });

      // Namespace validation
      if (cap.name?.startsWith('dev.ucp.')) {
        if (cap.spec && !cap.spec.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_ORIGIN_MISMATCH', path: `${path}.spec`, message: 'dev.ucp.* spec must be on ucp.dev', hint: 'Use https://ucp.dev/specification/...' });
        }
        if (cap.schema && !cap.schema.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_ORIGIN_MISMATCH', path: `${path}.schema`, message: 'dev.ucp.* schema must be on ucp.dev', hint: 'Use https://ucp.dev/schemas/...' });
        }
      }

      // Extension validation
      if (cap.extends && !capNames.has(cap.extends)) {
        issues.push({ severity: 'error', code: 'UCP_ORPHANED_EXTENSION', path: `${path}.extends`, message: `Parent capability "${cap.extends}" not found`, hint: 'Add the parent capability or remove extends' });
      }
    });

    // Check signing keys if Order is present
    const hasOrder = ucp.capabilities.some((c: any) => c.name === 'dev.ucp.shopping.order');
    if (hasOrder && (!profile.signing_keys || profile.signing_keys.length === 0)) {
      issues.push({ severity: 'error', code: 'UCP_MISSING_SIGNING_KEYS', path: '$.signing_keys', message: 'Order capability requires signing_keys for webhooks', hint: 'Add signing_keys array with JWK public keys' });
    }
  }

  return issues;
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

  const { domain } = req.body || {};
  if (!domain) {
    return res.status(400).json({ error: 'Missing required field: domain' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const profileUrl = `https://${cleanDomain}/.well-known/ucp`;

  // Fetch profile
  const { profile, error } = await fetchProfile(cleanDomain);

  if (error || !profile) {
    const report: ValidationReport = {
      ok: false,
      profile_url: profileUrl,
      issues: [{
        severity: 'error',
        code: 'UCP_FETCH_FAILED',
        path: '$.well-known/ucp',
        message: error || 'Failed to fetch profile',
        hint: 'Ensure profile is accessible at /.well-known/ucp',
      }],
      validated_at: new Date().toISOString(),
    };
    return res.status(200).json(report);
  }

  // Validate
  const issues = validateStructure(profile);
  const hasErrors = issues.some(i => i.severity === 'error');

  const report: ValidationReport = {
    ok: !hasErrors,
    profile_url: profileUrl,
    ucp_version: profile?.ucp?.version,
    issues,
    validated_at: new Date().toISOString(),
  };

  return res.status(200).json(report);
}
