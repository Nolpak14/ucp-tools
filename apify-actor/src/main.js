/**
 * UCP Profile Validator - Apify Actor
 * Validates any domain's UCP Business Profile at /.well-known/ucp
 */

import { Actor } from 'apify';

const VERSION_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function fetchProfile(domain) {
  const url = `https://${domain}/.well-known/ucp`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'UCP-Validator-Apify/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { profile: null, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const profile = await res.json();
    return { profile };
  } catch (e) {
    return { profile: null, error: e.message || 'Failed to fetch profile' };
  }
}

function validateProfile(profile) {
  const issues = [];

  if (!profile || typeof profile !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', path: '$', message: 'Profile must be a JSON object' });
    return issues;
  }

  if (!profile.ucp || typeof profile.ucp !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', path: '$.ucp', message: 'Missing required "ucp" object' });
    return issues;
  }

  const ucp = profile.ucp;

  // Version validation
  if (!ucp.version) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_VERSION', path: '$.ucp.version', message: 'Missing version field' });
  } else if (!VERSION_REGEX.test(ucp.version)) {
    issues.push({ severity: 'error', code: 'UCP_INVALID_VERSION', path: '$.ucp.version', message: `Invalid version: ${ucp.version}`, hint: 'Use YYYY-MM-DD format' });
  }

  // Services validation
  if (!ucp.services || typeof ucp.services !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_SERVICES', path: '$.ucp.services', message: 'Missing services' });
  } else {
    for (const [name, svc] of Object.entries(ucp.services)) {
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
          issues.push({ severity: 'warn', code: 'UCP_TRAILING_SLASH', path: `$.ucp.services["${name}"].rest.endpoint`, message: 'Remove trailing slash' });
        }
      }
    }
  }

  // Capabilities validation
  if (!ucp.capabilities || !Array.isArray(ucp.capabilities)) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_CAPABILITIES', path: '$.ucp.capabilities', message: 'Missing capabilities array' });
  } else {
    const capNames = new Set(ucp.capabilities.map(c => c.name));
    ucp.capabilities.forEach((cap, i) => {
      const path = `$.ucp.capabilities[${i}]`;
      if (!cap.name) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', path: `${path}.name`, message: 'Missing name' });
      if (!cap.version) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', path: `${path}.version`, message: 'Missing version' });
      if (!cap.spec) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', path: `${path}.spec`, message: 'Missing spec' });
      if (!cap.schema) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', path: `${path}.schema`, message: 'Missing schema' });

      // Namespace checks
      if (cap.name?.startsWith('dev.ucp.')) {
        if (cap.spec && !cap.spec.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_MISMATCH', path: `${path}.spec`, message: 'dev.ucp.* spec must be on ucp.dev' });
        }
        if (cap.schema && !cap.schema.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_MISMATCH', path: `${path}.schema`, message: 'dev.ucp.* schema must be on ucp.dev' });
        }
      }

      // Extension checks
      if (cap.extends && !capNames.has(cap.extends)) {
        issues.push({ severity: 'error', code: 'UCP_ORPHAN_EXT', path: `${path}.extends`, message: `Parent "${cap.extends}" not found` });
      }
    });

    // Signing keys check
    const hasOrder = ucp.capabilities.some(c => c.name === 'dev.ucp.shopping.order');
    if (hasOrder && (!profile.signing_keys || profile.signing_keys.length === 0)) {
      issues.push({ severity: 'error', code: 'UCP_MISSING_KEYS', path: '$.signing_keys', message: 'Order requires signing_keys' });
    }
  }

  return issues;
}

await Actor.init();

const input = await Actor.getInput();

if (!input?.domain) {
  throw new Error('Missing required input: domain');
}

const domain = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
const profileUrl = `https://${domain}/.well-known/ucp`;

console.log(`🔍 Validating UCP profile for: ${domain}`);

const { profile, error } = await fetchProfile(domain);

let issues = [];
let ucpVersion = null;

if (error || !profile) {
  issues.push({
    severity: 'error',
    code: 'UCP_FETCH_FAILED',
    path: '$.well-known/ucp',
    message: error || 'Failed to fetch profile',
  });
} else {
  issues = validateProfile(profile);
  ucpVersion = profile?.ucp?.version;
}

// Calculate score
const errors = issues.filter(i => i.severity === 'error').length;
const warnings = issues.filter(i => i.severity === 'warn').length;
const score = Math.max(0, 100 - (errors * 20) - (warnings * 5));
const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

// Recommendations
const recommendations = [];
if (errors > 0) recommendations.push('Fix all errors before deploying');
if (!ucpVersion) recommendations.push('Ensure profile is accessible at /.well-known/ucp');
if (issues.some(i => i.code === 'UCP_MISSING_KEYS')) recommendations.push('Add signing_keys for Order capability');
if (score === 100) recommendations.push('Profile is fully compliant!');

const output = {
  domain,
  profileUrl,
  valid: errors === 0,
  score,
  grade,
  ucpVersion,
  errors,
  warnings,
  issues: issues.map(i => ({
    severity: i.severity,
    code: i.code,
    message: i.message,
    hint: i.hint,
  })),
  recommendations: input.includeRecommendations !== false ? recommendations : undefined,
  checkedAt: new Date().toISOString(),
  generatorUrl: 'https://ucptools.dev/generate',
};

console.log(`\n📊 Result: ${grade} (${score}/100)`);
console.log(`   Errors: ${errors}, Warnings: ${warnings}`);
if (errors === 0) {
  console.log('✅ Profile is valid!');
} else {
  console.log('❌ Profile has issues that need to be fixed');
}

// Push result to dataset
// Note: Using PPE with synthetic 'apify-default-dataset-item' event
// This automatically charges users per result - no manual Actor.charge() needed
await Actor.pushData(output);
await Actor.setValue('OUTPUT', output);

await Actor.exit();
