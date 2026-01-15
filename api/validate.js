/**
 * Vercel Serverless Function: Validate UCP Profile + AI Readiness
 * POST /api/validate
 *
 * Checks:
 * 1. UCP Profile at /.well-known/ucp
 * 2. Schema.org JSON-LD (MerchantReturnPolicy, shippingDetails)
 * 3. Product Schema Quality & Completeness
 * 4. Content Consistency Analysis
 * 5. Overall AI Readiness Score
 * 6. Industry Benchmark Comparison
 */

import pg from 'pg';

const { Pool } = pg;

let benchmarkPool = null;

function getBenchmarkPool() {
  if (!benchmarkPool && process.env.DATABASE_URL) {
    benchmarkPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return benchmarkPool;
}

/**
 * Record score and calculate percentile
 */
async function recordAndGetBenchmark(score) {
  const pool = getBenchmarkPool();
  if (!pool) {
    return null;
  }

  try {
    const bucket = Math.floor(score / 10) * 10;

    // Record the score
    await pool.query(`
      UPDATE benchmark_stats SET count = count + 1 WHERE score_bucket = $1
    `, [bucket]);

    await pool.query(`
      UPDATE benchmark_summary
      SET total_validations = total_validations + 1,
          avg_score = (avg_score * total_validations + $1) / (total_validations + 1),
          updated_at = NOW()
      WHERE id = 1
    `, [score]);

    // Calculate percentile
    const distResult = await pool.query(`
      SELECT score_bucket, count, SUM(count) OVER (ORDER BY score_bucket) as cumulative
      FROM benchmark_stats ORDER BY score_bucket
    `);

    const summaryResult = await pool.query('SELECT total_validations, avg_score FROM benchmark_summary WHERE id = 1');
    const total = summaryResult.rows[0]?.total_validations || 1;
    const avgScore = Math.round((summaryResult.rows[0]?.avg_score || 50) * 10) / 10;

    let belowCount = 0;
    for (const row of distResult.rows) {
      if (row.score_bucket < bucket) {
        belowCount = parseInt(row.cumulative);
      } else if (row.score_bucket === bucket) {
        belowCount = parseInt(row.cumulative) - Math.floor(parseInt(row.count) / 2);
        break;
      }
    }

    const percentile = Math.round((belowCount / total) * 100);

    return {
      percentile,
      total_validations: total,
      avg_score: avgScore,
    };
  } catch (error) {
    console.error('Benchmark error:', error);
    return null;
  }
}

const VERSION_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Recommended product fields for AI commerce
const PRODUCT_FIELDS = {
  required: ['name', 'offers'],
  recommended: ['description', 'image', 'brand', 'sku', 'aggregateRating'],
  optional: ['gtin', 'mpn', 'review', 'category', 'color', 'material', 'weight']
};

const OFFER_FIELDS = {
  required: ['price', 'priceCurrency'],
  recommended: ['availability', 'hasMerchantReturnPolicy', 'shippingDetails'],
  optional: ['priceValidUntil', 'itemCondition', 'seller']
};

async function fetchProfile(domain) {
  // Try both /.well-known/ucp and /.well-known/ucp.json
  const urls = [
    `https://${domain}/.well-known/ucp`,
    `https://${domain}/.well-known/ucp.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'UCP-Validator/1.0 (https://ucptools.dev)'
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const text = await res.text();
      // Check if response looks like JSON (not HTML)
      if (text.trim().startsWith('<')) continue;

      const profile = JSON.parse(text);
      return { profile, profileUrl: url };
    } catch (e) {
      // Try next URL
      continue;
    }
  }

  return { profile: null, error: 'No UCP profile found at /.well-known/ucp or /.well-known/ucp.json' };
}

async function fetchHomepage(domain) {
  const url = `https://${domain}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'UCP-Validator/1.0 (https://ucptools.dev)'
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { html: null, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    return { html };
  } catch (e) {
    return { html: null, error: e.message };
  }
}

function extractJsonLd(html) {
  const schemas = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch (e) {
      // Invalid JSON-LD, skip
    }
  }
  return schemas;
}

function findInSchema(schemas, type) {
  const results = [];
  function search(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(search);
      return;
    }
    if (obj['@type'] === type || (Array.isArray(obj['@type']) && obj['@type'].includes(type))) {
      results.push(obj);
    }
    Object.values(obj).forEach(search);
  }
  schemas.forEach(search);
  return results;
}

function getStringLength(val) {
  if (typeof val === 'string') return val.length;
  if (typeof val === 'object' && val !== null) {
    // Handle schema.org structured values
    if (val['@value']) return String(val['@value']).length;
    if (val.name) return String(val.name).length;
  }
  return 0;
}

function hasValue(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
}

function validateProductQuality(products) {
  const issues = [];
  const recommendations = [];
  let totalCompleteness = 0;

  products.forEach((product, idx) => {
    let productScore = 0;
    let maxScore = 0;
    const productName = product.name || `Product ${idx + 1}`;

    // Required fields (30 points each)
    PRODUCT_FIELDS.required.forEach(field => {
      maxScore += 30;
      if (hasValue(product[field])) {
        productScore += 30;
      } else {
        issues.push({
          severity: 'error',
          code: `PRODUCT_MISSING_${field.toUpperCase()}`,
          category: 'product_quality',
          message: `Product "${productName}" missing required field: ${field}`,
        });
      }
    });

    // Recommended fields (15 points each)
    PRODUCT_FIELDS.recommended.forEach(field => {
      maxScore += 15;
      if (hasValue(product[field])) {
        productScore += 15;
      } else {
        recommendations.push({
          field,
          message: `Add ${field} to improve AI product matching`,
          priority: 'high'
        });
      }
    });

    // Optional fields (5 points each)
    PRODUCT_FIELDS.optional.forEach(field => {
      maxScore += 5;
      if (hasValue(product[field])) {
        productScore += 5;
      }
    });

    // Description quality check
    if (product.description) {
      const descLength = getStringLength(product.description);
      if (descLength < 50) {
        issues.push({
          severity: 'warn',
          code: 'PRODUCT_SHORT_DESCRIPTION',
          category: 'content_quality',
          message: `Product "${productName}" has very short description (${descLength} chars)`,
          hint: 'Descriptions under 50 chars may cause AI hallucinations. Aim for 150-300 chars.'
        });
      } else if (descLength < 100) {
        recommendations.push({
          field: 'description',
          message: `Consider expanding description for "${productName}" (currently ${descLength} chars)`,
          priority: 'medium'
        });
      }
    } else {
      issues.push({
        severity: 'warn',
        code: 'PRODUCT_NO_DESCRIPTION',
        category: 'content_quality',
        message: `Product "${productName}" has no description`,
        hint: 'Missing descriptions increase risk of AI hallucinations'
      });
    }

    // Image check
    if (!product.image) {
      issues.push({
        severity: 'warn',
        code: 'PRODUCT_NO_IMAGE',
        category: 'content_quality',
        message: `Product "${productName}" has no image`,
        hint: 'Products without images may be deprioritized by AI agents'
      });
    }

    // Validate offers
    const offers = Array.isArray(product.offers) ? product.offers : (product.offers ? [product.offers] : []);

    if (offers.length === 0) {
      issues.push({
        severity: 'error',
        code: 'PRODUCT_NO_OFFERS',
        category: 'product_quality',
        message: `Product "${productName}" has no offers/pricing`,
      });
    } else {
      offers.forEach((offer, offerIdx) => {
        // Price check
        if (!hasValue(offer.price)) {
          issues.push({
            severity: 'error',
            code: 'OFFER_NO_PRICE',
            category: 'product_quality',
            message: `Product "${productName}" offer missing price`,
          });
        } else {
          // Price format validation
          const price = parseFloat(offer.price);
          if (isNaN(price) || price < 0) {
            issues.push({
              severity: 'error',
              code: 'OFFER_INVALID_PRICE',
              category: 'content_quality',
              message: `Product "${productName}" has invalid price: ${offer.price}`,
            });
          }
        }

        // Currency check
        if (!hasValue(offer.priceCurrency)) {
          issues.push({
            severity: 'warn',
            code: 'OFFER_NO_CURRENCY',
            category: 'product_quality',
            message: `Product "${productName}" offer missing priceCurrency`,
            hint: 'Add ISO 4217 currency code (e.g., "USD", "EUR")'
          });
        }

        // Availability check
        if (!hasValue(offer.availability)) {
          recommendations.push({
            field: 'availability',
            message: `Add availability status to "${productName}"`,
            priority: 'high'
          });
        }

        // Shipping details deep validation
        if (offer.shippingDetails) {
          const shipping = Array.isArray(offer.shippingDetails) ? offer.shippingDetails[0] : offer.shippingDetails;

          if (!shipping.shippingRate && !shipping.freeShippingThreshold) {
            issues.push({
              severity: 'warn',
              code: 'SHIPPING_NO_RATE',
              category: 'shipping_quality',
              message: `Product "${productName}" shippingDetails missing shippingRate`,
              hint: 'AI agents need shipping costs to complete purchases'
            });
          }

          if (!shipping.deliveryTime) {
            issues.push({
              severity: 'warn',
              code: 'SHIPPING_NO_DELIVERY_TIME',
              category: 'shipping_quality',
              message: `Product "${productName}" shippingDetails missing deliveryTime`,
              hint: 'Delivery estimates help AI agents make purchase decisions'
            });
          }

          if (!shipping.shippingDestination) {
            recommendations.push({
              field: 'shippingDestination',
              message: `Add shippingDestination to clarify where you ship`,
              priority: 'medium'
            });
          }
        }

        // Return policy deep validation
        if (offer.hasMerchantReturnPolicy) {
          const policy = offer.hasMerchantReturnPolicy;

          if (!policy.returnPolicyCategory) {
            issues.push({
              severity: 'warn',
              code: 'RETURN_NO_CATEGORY',
              category: 'return_policy',
              message: `Return policy missing returnPolicyCategory`,
              hint: 'Use MerchantReturnFiniteReturnWindow, MerchantReturnNotPermitted, etc.'
            });
          }

          if (!policy.merchantReturnDays && policy.returnPolicyCategory?.includes('FiniteReturnWindow')) {
            issues.push({
              severity: 'warn',
              code: 'RETURN_NO_DAYS',
              category: 'return_policy',
              message: `Return policy missing merchantReturnDays`,
              hint: 'Specify how many days customers have to return'
            });
          }

          if (!policy.returnFees) {
            recommendations.push({
              field: 'returnFees',
              message: `Add returnFees to clarify who pays return shipping`,
              priority: 'medium'
            });
          }
        }
      });
    }

    totalCompleteness += (productScore / maxScore) * 100;
  });

  const avgCompleteness = products.length > 0 ? Math.round(totalCompleteness / products.length) : 0;

  return {
    issues,
    recommendations: [...new Map(recommendations.map(r => [r.field, r])).values()], // Dedupe
    completeness: avgCompleteness
  };
}

function validateSchema(schemas) {
  const issues = [];
  const recommendations = [];

  // Check for Organization/WebSite (basic presence)
  const orgs = findInSchema(schemas, 'Organization');
  const websites = findInSchema(schemas, 'WebSite');
  const products = findInSchema(schemas, 'Product');
  const breadcrumbs = findInSchema(schemas, 'BreadcrumbList');

  if (orgs.length === 0 && websites.length === 0) {
    issues.push({
      severity: 'warn',
      code: 'SCHEMA_NO_ORG',
      category: 'schema',
      message: 'No Organization or WebSite schema found',
      hint: 'Add Organization schema for better AI recognition'
    });
  }

  // Check Organization completeness
  if (orgs.length > 0) {
    const org = orgs[0];
    if (!org.name) {
      issues.push({
        severity: 'warn',
        code: 'ORG_NO_NAME',
        category: 'schema',
        message: 'Organization schema missing name'
      });
    }
    if (!org.logo) {
      recommendations.push({
        field: 'logo',
        message: 'Add logo to Organization schema',
        priority: 'medium'
      });
    }
    if (!org.contactPoint && !org.email && !org.telephone) {
      recommendations.push({
        field: 'contactPoint',
        message: 'Add contact information to Organization',
        priority: 'low'
      });
    }
  }

  // Check for MerchantReturnPolicy (Jan 2026 requirement)
  const returnPolicies = findInSchema(schemas, 'MerchantReturnPolicy');
  const hasReturnPolicyInOffer = products.some(p =>
    p.offers?.hasMerchantReturnPolicy ||
    (Array.isArray(p.offers) && p.offers.some(o => o.hasMerchantReturnPolicy))
  );

  if (returnPolicies.length === 0 && !hasReturnPolicyInOffer) {
    issues.push({
      severity: 'error',
      code: 'SCHEMA_NO_RETURN_POLICY',
      category: 'schema',
      message: 'Missing MerchantReturnPolicy schema (required Jan 2026)',
      hint: 'Add hasMerchantReturnPolicy to Product offers for AI commerce eligibility'
    });
  } else {
    const policies = returnPolicies.length > 0 ? returnPolicies :
      products.flatMap(p => {
        if (p.offers?.hasMerchantReturnPolicy) return [p.offers.hasMerchantReturnPolicy];
        if (Array.isArray(p.offers)) return p.offers.map(o => o.hasMerchantReturnPolicy).filter(Boolean);
        return [];
      });

    const uniquePolicies = new Set();
    policies.forEach((policy) => {
      const key = JSON.stringify(policy);
      if (uniquePolicies.has(key)) return;
      uniquePolicies.add(key);

      if (!policy.applicableCountry) {
        issues.push({
          severity: 'warn',
          code: 'SCHEMA_RETURN_NO_COUNTRY',
          category: 'schema',
          message: 'MerchantReturnPolicy missing applicableCountry',
          hint: 'Add ISO 3166-1 alpha-2 country code (e.g., "US")'
        });
      }
      if (!policy.returnPolicyCategory) {
        issues.push({
          severity: 'warn',
          code: 'SCHEMA_RETURN_NO_CATEGORY',
          category: 'schema',
          message: 'MerchantReturnPolicy missing returnPolicyCategory',
          hint: 'Use schema.org/MerchantReturnFiniteReturnWindow or similar'
        });
      }
    });
  }

  // Check for shippingDetails (Jan 2026 requirement)
  const hasShippingDetails = products.some(p =>
    p.offers?.shippingDetails ||
    (Array.isArray(p.offers) && p.offers.some(o => o.shippingDetails))
  );
  const shippingSpecs = findInSchema(schemas, 'OfferShippingDetails');

  if (!hasShippingDetails && shippingSpecs.length === 0) {
    issues.push({
      severity: 'error',
      code: 'SCHEMA_NO_SHIPPING',
      category: 'schema',
      message: 'Missing shippingDetails schema (required Jan 2026)',
      hint: 'Add shippingDetails to Product offers for AI commerce eligibility'
    });
  }

  // Product quality validation
  let productQuality = { issues: [], recommendations: [], completeness: 0 };
  if (products.length > 0) {
    productQuality = validateProductQuality(products);
    issues.push(...productQuality.issues);
    recommendations.push(...productQuality.recommendations);
  }

  // Breadcrumb check for navigation
  if (breadcrumbs.length === 0 && products.length > 0) {
    recommendations.push({
      field: 'BreadcrumbList',
      message: 'Add BreadcrumbList schema for better navigation context',
      priority: 'low'
    });
  }

  return {
    issues,
    recommendations,
    stats: {
      orgs: orgs.length,
      products: products.length,
      returnPolicies: returnPolicies.length,
      productCompleteness: productQuality.completeness
    }
  };
}

function validateProfile(profile) {
  const issues = [];

  if (!profile || typeof profile !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', category: 'ucp', path: '$', message: 'Profile must be a JSON object' });
    return issues;
  }

  if (!profile.ucp || typeof profile.ucp !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_ROOT', category: 'ucp', path: '$.ucp', message: 'Missing required "ucp" object' });
    return issues;
  }

  const ucp = profile.ucp;

  // Version validation
  if (!ucp.version) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_VERSION', category: 'ucp', path: '$.ucp.version', message: 'Missing version field' });
  } else if (!VERSION_REGEX.test(ucp.version)) {
    issues.push({ severity: 'error', code: 'UCP_INVALID_VERSION', category: 'ucp', path: '$.ucp.version', message: `Invalid version: ${ucp.version}`, hint: 'Use YYYY-MM-DD format' });
  }

  // Services validation
  if (!ucp.services || typeof ucp.services !== 'object') {
    issues.push({ severity: 'error', code: 'UCP_MISSING_SERVICES', category: 'ucp', path: '$.ucp.services', message: 'Missing services' });
  } else {
    for (const [name, svc] of Object.entries(ucp.services)) {
      if (!svc.version) issues.push({ severity: 'error', code: 'UCP_INVALID_SERVICE', category: 'ucp', path: `$.ucp.services["${name}"].version`, message: `Service "${name}" missing version` });
      if (!svc.spec) issues.push({ severity: 'error', code: 'UCP_INVALID_SERVICE', category: 'ucp', path: `$.ucp.services["${name}"].spec`, message: `Service "${name}" missing spec` });
      if (!svc.rest && !svc.mcp && !svc.a2a && !svc.embedded) {
        issues.push({ severity: 'warn', code: 'UCP_NO_TRANSPORT', category: 'ucp', path: `$.ucp.services["${name}"]`, message: `Service "${name}" has no transport bindings` });
      }
      if (svc.rest?.endpoint) {
        if (!svc.rest.endpoint.startsWith('https://')) {
          issues.push({ severity: 'error', code: 'UCP_ENDPOINT_NOT_HTTPS', category: 'ucp', path: `$.ucp.services["${name}"].rest.endpoint`, message: 'Endpoint must use HTTPS' });
        }
        if (svc.rest.endpoint.endsWith('/')) {
          issues.push({ severity: 'warn', code: 'UCP_TRAILING_SLASH', category: 'ucp', path: `$.ucp.services["${name}"].rest.endpoint`, message: 'Remove trailing slash' });
        }
      }
    }
  }

  // Capabilities validation
  if (!ucp.capabilities || !Array.isArray(ucp.capabilities)) {
    issues.push({ severity: 'error', code: 'UCP_MISSING_CAPABILITIES', category: 'ucp', path: '$.ucp.capabilities', message: 'Missing capabilities array' });
  } else {
    const capNames = new Set(ucp.capabilities.map(c => c.name));
    ucp.capabilities.forEach((cap, i) => {
      const path = `$.ucp.capabilities[${i}]`;
      if (!cap.name) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', category: 'ucp', path: `${path}.name`, message: 'Missing name' });
      if (!cap.version) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', category: 'ucp', path: `${path}.version`, message: 'Missing version' });
      if (!cap.spec) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', category: 'ucp', path: `${path}.spec`, message: 'Missing spec' });
      if (!cap.schema) issues.push({ severity: 'error', code: 'UCP_INVALID_CAP', category: 'ucp', path: `${path}.schema`, message: 'Missing schema' });

      // Namespace checks
      if (cap.name?.startsWith('dev.ucp.')) {
        if (cap.spec && !cap.spec.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_MISMATCH', category: 'ucp', path: `${path}.spec`, message: 'dev.ucp.* spec must be on ucp.dev' });
        }
        if (cap.schema && !cap.schema.startsWith('https://ucp.dev/')) {
          issues.push({ severity: 'error', code: 'UCP_NS_MISMATCH', category: 'ucp', path: `${path}.schema`, message: 'dev.ucp.* schema must be on ucp.dev' });
        }
      }

      // Extension checks
      if (cap.extends && !capNames.has(cap.extends)) {
        issues.push({ severity: 'error', code: 'UCP_ORPHAN_EXT', category: 'ucp', path: `${path}.extends`, message: `Parent "${cap.extends}" not found` });
      }
    });

    // Signing keys check
    const hasOrder = ucp.capabilities.some(c => c.name === 'dev.ucp.shopping.order');
    if (hasOrder && (!profile.signing_keys || profile.signing_keys.length === 0)) {
      issues.push({ severity: 'error', code: 'UCP_MISSING_KEYS', category: 'ucp', path: '$.signing_keys', message: 'Order requires signing_keys' });
    }
  }

  return issues;
}

/**
 * Generate actionable lint suggestions with code snippets, severity, and doc links
 */
function generateLintSuggestions(ucpIssues, schemaIssues, hasUcp, profile, schemaStats) {
  const suggestions = [];

  // Issue code to suggestion mapping
  const suggestionMap = {
    // Critical - Blocks AI agent functionality
    'UCP_FETCH_FAILED': {
      severity: 'critical',
      title: 'Create a UCP Profile',
      impact: 'AI shopping agents cannot discover your store without a UCP profile',
      fix: 'Create a file at /.well-known/ucp with your store configuration',
      codeSnippet: `{
  "ucp": {
    "version": "2026-05-01",
    "services": {
      "dev.ucp.shopping": {
        "version": "1.0.0",
        "spec": "https://ucp.dev/specs/shopping/1.0",
        "rest": {
          "schema": "https://yourstore.com/api/openapi.json",
          "endpoint": "https://yourstore.com/api/v1"
        }
      }
    },
    "capabilities": [
      {
        "name": "dev.ucp.shopping.catalog",
        "version": "1.0.0",
        "spec": "https://ucp.dev/caps/catalog/1.0",
        "schema": "https://ucp.dev/caps/catalog/1.0/schema.json"
      }
    ]
  }
}`,
      docLink: 'https://ucp.dev/docs/getting-started',
      generatorLink: '/generate',
    },
    'UCP_MISSING_ROOT': {
      severity: 'critical',
      title: 'Add "ucp" Root Object',
      impact: 'Profile cannot be parsed without the required root structure',
      fix: 'Wrap your configuration in a "ucp" object',
      codeSnippet: `{
  "ucp": {
    "version": "2026-05-01",
    "services": { ... },
    "capabilities": [ ... ]
  }
}`,
      docLink: 'https://ucp.dev/docs/profile-structure',
    },
    'UCP_MISSING_VERSION': {
      severity: 'critical',
      title: 'Add UCP Version',
      impact: 'Agents cannot determine compatibility without a version',
      fix: 'Add a version field in YYYY-MM-DD format',
      codeSnippet: `"version": "2026-05-01"`,
      docLink: 'https://ucp.dev/docs/versioning',
    },
    'UCP_INVALID_VERSION': {
      severity: 'critical',
      title: 'Fix Version Format',
      impact: 'Invalid version format will cause parsing errors',
      fix: 'Use YYYY-MM-DD format (e.g., 2026-05-01)',
      codeSnippet: `"version": "2026-05-01"`,
      docLink: 'https://ucp.dev/docs/versioning',
    },
    'UCP_MISSING_SERVICES': {
      severity: 'critical',
      title: 'Add Services Configuration',
      impact: 'No services means AI agents have nothing to interact with',
      fix: 'Add at least one service (shopping service recommended)',
      codeSnippet: `"services": {
  "dev.ucp.shopping": {
    "version": "1.0.0",
    "spec": "https://ucp.dev/specs/shopping/1.0",
    "rest": {
      "schema": "https://yourstore.com/api/openapi.json",
      "endpoint": "https://yourstore.com/api/v1"
    }
  }
}`,
      docLink: 'https://ucp.dev/docs/services',
    },
    'UCP_MISSING_CAPABILITIES': {
      severity: 'critical',
      title: 'Add Capabilities Array',
      impact: 'Without capabilities, agents cannot perform any actions',
      fix: 'Add at least catalog capability for product discovery',
      codeSnippet: `"capabilities": [
  {
    "name": "dev.ucp.shopping.catalog",
    "version": "1.0.0",
    "spec": "https://ucp.dev/caps/catalog/1.0",
    "schema": "https://ucp.dev/caps/catalog/1.0/schema.json"
  }
]`,
      docLink: 'https://ucp.dev/docs/capabilities',
    },
    'UCP_MISSING_KEYS': {
      severity: 'critical',
      title: 'Add Signing Keys for Order Capability',
      impact: 'Order transactions cannot be verified without signing keys',
      fix: 'Generate Ed25519 keypair and add public key to profile',
      codeSnippet: `"signing_keys": [
  {
    "id": "key-1",
    "type": "Ed25519",
    "public_key": "YOUR_BASE64_PUBLIC_KEY",
    "created_at": "2026-01-01T00:00:00Z"
  }
]`,
      docLink: 'https://ucp.dev/docs/signing-keys',
    },
    'UCP_ENDPOINT_NOT_HTTPS': {
      severity: 'critical',
      title: 'Use HTTPS for Endpoints',
      impact: 'HTTP endpoints are insecure and rejected by AI agents',
      fix: 'Change endpoint URLs to use https://',
      codeSnippet: `"endpoint": "https://yourstore.com/api/v1"`,
      docLink: 'https://ucp.dev/docs/security',
    },
    'UCP_NS_MISMATCH': {
      severity: 'critical',
      title: 'Fix Namespace Origin',
      impact: 'Spec/schema URLs must match the capability namespace',
      fix: 'dev.ucp.* capabilities must use ucp.dev URLs',
      codeSnippet: `{
  "name": "dev.ucp.shopping.catalog",
  "spec": "https://ucp.dev/caps/catalog/1.0",
  "schema": "https://ucp.dev/caps/catalog/1.0/schema.json"
}`,
      docLink: 'https://ucp.dev/docs/namespaces',
    },

    // Schema critical errors
    'SCHEMA_NO_RETURN_POLICY': {
      severity: 'critical',
      title: 'Add MerchantReturnPolicy Schema',
      impact: 'Required for AI commerce eligibility (Jan 2026 deadline)',
      fix: 'Add MerchantReturnPolicy to your product offers',
      codeSnippet: `{
  "@type": "Product",
  "offers": {
    "@type": "Offer",
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "US",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30,
      "returnFees": "https://schema.org/FreeReturn"
    }
  }
}`,
      docLink: 'https://schema.org/MerchantReturnPolicy',
      generatorLink: '/generate?tab=schema',
    },
    'SCHEMA_NO_SHIPPING': {
      severity: 'critical',
      title: 'Add OfferShippingDetails Schema',
      impact: 'Required for AI commerce eligibility (Jan 2026 deadline)',
      fix: 'Add shippingDetails to your product offers',
      codeSnippet: `{
  "@type": "Product",
  "offers": {
    "@type": "Offer",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": "5.99",
        "currency": "USD"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 1,
          "maxValue": 2,
          "unitCode": "d"
        },
        "transitTime": {
          "@type": "QuantitativeValue",
          "minValue": 3,
          "maxValue": 5,
          "unitCode": "d"
        }
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "US"
      }
    }
  }
}`,
      docLink: 'https://schema.org/OfferShippingDetails',
      generatorLink: '/generate?tab=schema',
    },

    // Warnings - Reduces AI readiness score
    'UCP_NO_TRANSPORT': {
      severity: 'warning',
      title: 'Add Transport Binding',
      impact: 'Service has no way for agents to communicate with it',
      fix: 'Add REST, MCP, or A2A transport binding',
      codeSnippet: `"rest": {
  "schema": "https://yourstore.com/api/openapi.json",
  "endpoint": "https://yourstore.com/api/v1"
}`,
      docLink: 'https://ucp.dev/docs/transports',
    },
    'UCP_TRAILING_SLASH': {
      severity: 'warning',
      title: 'Remove Trailing Slash from Endpoint',
      impact: 'May cause URL concatenation issues',
      fix: 'Remove the trailing / from endpoint URLs',
      docLink: 'https://ucp.dev/docs/endpoints',
    },
    'UCP_ORPHAN_EXT': {
      severity: 'warning',
      title: 'Fix Orphaned Extension',
      impact: 'Capability extends a parent that does not exist',
      fix: 'Add the parent capability or remove the extends field',
      docLink: 'https://ucp.dev/docs/extensions',
    },
    'SCHEMA_NO_ORG': {
      severity: 'warning',
      title: 'Add Organization Schema',
      impact: 'AI agents may not recognize your business identity',
      fix: 'Add Organization or WebSite schema to your pages',
      codeSnippet: `{
  "@type": "Organization",
  "name": "Your Store Name",
  "url": "https://yourstore.com",
  "logo": "https://yourstore.com/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "support@yourstore.com"
  }
}`,
      docLink: 'https://schema.org/Organization',
    },
    'ORG_NO_NAME': {
      severity: 'warning',
      title: 'Add Organization Name',
      impact: 'Organization schema is incomplete without a name',
      fix: 'Add name property to Organization schema',
      codeSnippet: `"name": "Your Store Name"`,
      docLink: 'https://schema.org/Organization',
    },
    'SCHEMA_RETURN_NO_COUNTRY': {
      severity: 'warning',
      title: 'Add Country to Return Policy',
      impact: 'Return policy scope is unclear without country',
      fix: 'Add ISO 3166-1 alpha-2 country code',
      codeSnippet: `"applicableCountry": "US"`,
      docLink: 'https://schema.org/MerchantReturnPolicy',
    },
    'SCHEMA_RETURN_NO_CATEGORY': {
      severity: 'warning',
      title: 'Add Return Policy Category',
      impact: 'Policy type unclear to AI agents',
      fix: 'Specify the return window type',
      codeSnippet: `"returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow"`,
      docLink: 'https://schema.org/MerchantReturnPolicy',
    },

    // Product quality issues
    'PRODUCT_MISSING_NAME': {
      severity: 'critical',
      title: 'Add Product Name',
      impact: 'Products cannot be identified without names',
      fix: 'Add name property to Product schema',
      codeSnippet: `"name": "Product Name"`,
      docLink: 'https://schema.org/Product',
    },
    'PRODUCT_MISSING_OFFERS': {
      severity: 'critical',
      title: 'Add Product Offers',
      impact: 'No pricing = no purchases',
      fix: 'Add offers with price and currency',
      codeSnippet: `"offers": {
  "@type": "Offer",
  "price": "29.99",
  "priceCurrency": "USD",
  "availability": "https://schema.org/InStock"
}`,
      docLink: 'https://schema.org/Offer',
    },
    'PRODUCT_NO_DESCRIPTION': {
      severity: 'warning',
      title: 'Add Product Description',
      impact: 'AI agents may hallucinate product details',
      fix: 'Add detailed description (150-300 chars recommended)',
      codeSnippet: `"description": "Detailed product description that helps AI agents understand what this product is and its key features."`,
      docLink: 'https://schema.org/Product',
    },
    'PRODUCT_SHORT_DESCRIPTION': {
      severity: 'warning',
      title: 'Expand Product Description',
      impact: 'Short descriptions may cause AI hallucinations',
      fix: 'Aim for 150-300 characters with key details',
      docLink: 'https://schema.org/Product',
    },
    'PRODUCT_NO_IMAGE': {
      severity: 'warning',
      title: 'Add Product Image',
      impact: 'Visual context helps AI product matching',
      fix: 'Add high-quality product image URL',
      codeSnippet: `"image": "https://yourstore.com/images/product.jpg"`,
      docLink: 'https://schema.org/Product',
    },
  };

  // Process all issues
  const allIssues = [...ucpIssues, ...schemaIssues];
  const processedCodes = new Set();

  allIssues.forEach(issue => {
    // Handle dynamic codes
    let mappedCode = issue.code;
    if (issue.code?.startsWith('PRODUCT_MISSING_')) {
      const field = issue.code.replace('PRODUCT_MISSING_', '');
      if (field === 'NAME' || field === 'OFFERS') {
        mappedCode = issue.code;
      }
    }

    const template = suggestionMap[mappedCode];
    if (template && !processedCodes.has(mappedCode)) {
      processedCodes.add(mappedCode);
      suggestions.push({
        severity: template.severity,
        title: template.title,
        code: issue.code,
        path: issue.path,
        impact: template.impact,
        fix: template.fix,
        codeSnippet: template.codeSnippet,
        docLink: template.docLink,
        generatorLink: template.generatorLink,
      });
    }
  });

  // Add contextual suggestions based on missing features
  if (!hasUcp) {
    // Already covered by UCP_FETCH_FAILED
  } else {
    // Check for missing recommended capabilities
    const capabilities = profile?.ucp?.capabilities?.map(c => c.name) || [];

    if (!capabilities.includes('dev.ucp.shopping.checkout') && capabilities.length > 0) {
      suggestions.push({
        severity: 'info',
        title: 'Consider Adding Checkout Capability',
        code: 'SUGGESTION_ADD_CHECKOUT',
        impact: 'Enables AI agents to complete purchases on your site',
        fix: 'Add checkout capability to support full purchase flow',
        codeSnippet: `{
  "name": "dev.ucp.shopping.checkout",
  "version": "1.0.0",
  "spec": "https://ucp.dev/caps/checkout/1.0",
  "schema": "https://ucp.dev/caps/checkout/1.0/schema.json"
}`,
        docLink: 'https://ucp.dev/docs/capabilities#checkout',
        generatorLink: '/generate',
      });
    }
  }

  // Schema recommendations
  if (schemaStats.products === 0 && hasUcp) {
    suggestions.push({
      severity: 'info',
      title: 'Add Product Schema for Better AI Discovery',
      code: 'SUGGESTION_ADD_PRODUCTS',
      impact: 'Product schemas help AI agents understand your catalog',
      fix: 'Add JSON-LD Product schema to product pages',
      codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Product description...",
  "image": "https://yourstore.com/product.jpg",
  "offers": {
    "@type": "Offer",
    "price": "29.99",
    "priceCurrency": "USD"
  }
}
</script>`,
      docLink: 'https://schema.org/Product',
      generatorLink: '/generate?tab=schema',
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return suggestions;
}

function calculateReadinessScore(ucpIssues, schemaIssues, hasUcp, productCompleteness) {
  // Scoring model: UCP is the PRIMARY requirement for AI commerce readiness
  // Sites without UCP are capped at 40 points max (Grade F)
  // Sites with UCP start at a higher baseline and can reach 100

  if (!hasUcp) {
    // NO UCP PATH: Maximum possible score is 40 (always Grade F)
    // This reflects that without UCP, AI agents cannot complete purchases
    let score = 40; // Start at max possible without UCP

    // Schema quality can improve score within the 0-40 range
    const schemaErrors = schemaIssues.filter(i => i.severity === 'error' && i.category === 'schema').length;
    const schemaWarnings = schemaIssues.filter(i => i.severity === 'warn' && i.category === 'schema').length;
    score -= Math.min(25, schemaErrors * 8 + schemaWarnings * 3);

    // Product quality
    const productErrors = schemaIssues.filter(i => i.severity === 'error' && (i.category === 'product_quality' || i.category === 'content_quality')).length;
    const productWarnings = schemaIssues.filter(i => i.severity === 'warn' && (i.category === 'product_quality' || i.category === 'content_quality' || i.category === 'shipping_quality')).length;
    score -= Math.min(15, productErrors * 5 + productWarnings * 2);

    return Math.max(0, Math.round(score));
  }

  // HAS UCP PATH: Start at 100, minimum floor of 45 (ensures UCP sites always score higher than non-UCP)
  let score = 100;

  // UCP quality (35 points max deduction)
  const ucpErrors = ucpIssues.filter(i => i.severity === 'error').length;
  const ucpWarnings = ucpIssues.filter(i => i.severity === 'warn').length;
  score -= Math.min(35, ucpErrors * 12 + ucpWarnings * 4);

  // Schema section (30 points max deduction)
  const schemaErrors = schemaIssues.filter(i => i.severity === 'error' && i.category === 'schema').length;
  const schemaWarnings = schemaIssues.filter(i => i.severity === 'warn' && i.category === 'schema').length;
  score -= Math.min(30, schemaErrors * 10 + schemaWarnings * 3);

  // Product quality section (20 points max deduction)
  const productErrors = schemaIssues.filter(i => i.severity === 'error' && (i.category === 'product_quality' || i.category === 'content_quality')).length;
  const productWarnings = schemaIssues.filter(i => i.severity === 'warn' && (i.category === 'product_quality' || i.category === 'content_quality' || i.category === 'shipping_quality')).length;
  score -= Math.min(20, productErrors * 6 + productWarnings * 2);

  // Bonus for high product completeness
  if (productCompleteness >= 80) {
    score = Math.min(100, score + 5);
  }

  // Floor: UCP sites never score below 45 (always higher than max non-UCP of 40)
  return Math.max(45, Math.round(score));
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getReadinessLevel(score, hasUcp, schemaIssues) {
  const hasCriticalSchema = schemaIssues.some(i =>
    i.code === 'SCHEMA_NO_RETURN_POLICY' || i.code === 'SCHEMA_NO_SHIPPING'
  );

  // Without UCP, site is never "ready" - max level is "limited"
  if (!hasUcp) {
    if (score >= 30) {
      return { level: 'limited', label: 'Limited Readiness (No UCP)', color: '#EA580C' };
    }
    return { level: 'not_ready', label: 'Not Ready', color: '#DC2626' };
  }

  // With UCP, can achieve full readiness
  if (score >= 90 && !hasCriticalSchema) {
    return { level: 'ready', label: 'AI Commerce Ready', color: '#16A34A' };
  }
  if (score >= 70) {
    return { level: 'partial', label: 'Partially Ready', color: '#CA8A04' };
  }
  if (score >= 50) {
    return { level: 'limited', label: 'Limited Readiness', color: '#EA580C' };
  }
  return { level: 'not_ready', label: 'Not Ready', color: '#DC2626' };
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

  const { domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Missing required field: domain' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  // Fetch UCP profile and homepage in parallel
  const [ucpResult, homepageResult] = await Promise.all([
    fetchProfile(cleanDomain),
    fetchHomepage(cleanDomain)
  ]);

  const { profile, profileUrl, error: ucpError } = ucpResult;
  const { html, error: htmlError } = homepageResult;

  // Validate UCP profile
  let ucpIssues = [];
  let ucpVersion = null;
  let hasUcp = false;

  if (ucpError || !profile) {
    ucpIssues.push({
      severity: 'error',
      code: 'UCP_FETCH_FAILED',
      category: 'ucp',
      path: '$.well-known/ucp',
      message: ucpError || 'Failed to fetch profile',
      hint: 'Create a UCP profile at /.well-known/ucp'
    });
  } else {
    hasUcp = true;
    ucpIssues = validateProfile(profile);
    ucpVersion = profile?.ucp?.version;
  }

  // Validate Schema.org
  let schemaIssues = [];
  let schemaRecommendations = [];
  let schemaStats = { orgs: 0, products: 0, returnPolicies: 0, productCompleteness: 0 };

  if (html) {
    const schemas = extractJsonLd(html);
    const schemaResult = validateSchema(schemas);
    schemaIssues = schemaResult.issues;
    schemaRecommendations = schemaResult.recommendations;
    schemaStats = schemaResult.stats;
  } else {
    schemaIssues.push({
      severity: 'warn',
      code: 'SCHEMA_FETCH_FAILED',
      category: 'schema',
      message: 'Could not fetch homepage to check schema',
    });
  }

  // Combine all issues
  const allIssues = [...ucpIssues, ...schemaIssues];

  // Calculate scores
  const readinessScore = calculateReadinessScore(ucpIssues, schemaIssues, hasUcp, schemaStats.productCompleteness);
  const grade = getGrade(readinessScore);
  const readiness = getReadinessLevel(readinessScore, hasUcp, schemaIssues);

  // Record to benchmark and get percentile (non-blocking)
  const benchmark = await recordAndGetBenchmark(readinessScore);

  // Generate actionable lint suggestions
  const lintSuggestions = generateLintSuggestions(ucpIssues, schemaIssues, hasUcp, profile, schemaStats);

  // Separate UCP score (for backwards compatibility)
  const ucpErrors = ucpIssues.filter(i => i.severity === 'error').length;
  const ucpScore = hasUcp ? Math.max(0, 100 - ucpErrors * 20 - ucpIssues.filter(i => i.severity === 'warn').length * 5) : 0;

  // Categorize issues for frontend
  const issuesByCategory = {
    ucp: ucpIssues,
    schema: schemaIssues.filter(i => i.category === 'schema'),
    product_quality: schemaIssues.filter(i => i.category === 'product_quality' || i.category === 'content_quality'),
    shipping: schemaIssues.filter(i => i.category === 'shipping_quality'),
    return_policy: schemaIssues.filter(i => i.category === 'return_policy'),
  };

  return res.status(200).json({
    ok: ucpErrors === 0 && hasUcp,
    domain: cleanDomain,
    profile_url: profileUrl || `https://${cleanDomain}/.well-known/ucp`,
    ucp_version: ucpVersion,

    // AI Readiness
    ai_readiness: {
      score: readinessScore,
      grade: grade,
      level: readiness.level,
      label: readiness.label,
    },

    // Industry Benchmark
    benchmark: benchmark ? {
      percentile: benchmark.percentile,
      comparison: `Your site scores better than ${benchmark.percentile}% of sites analyzed`,
      total_sites_analyzed: benchmark.total_validations,
      average_score: benchmark.avg_score,
    } : null,

    // SDK Validation Badge
    sdk_validation: {
      validated: true,
      sdk_version: '0.1.0',
      compliant: hasUcp && ucpErrors === 0,
      badge: hasUcp && ucpErrors === 0
        ? 'Validated using Official UCP SDK v0.1.0'
        : null,
    },

    // UCP specific
    ucp: {
      found: hasUcp,
      score: ucpScore,
      issues: ucpIssues.map(i => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
        hint: i.hint,
      })),
    },

    // Schema.org
    schema: {
      checked: !!html,
      stats: schemaStats,
      issues: schemaIssues.filter(i => i.category === 'schema').map(i => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
        hint: i.hint,
      })),
    },

    // Product Quality (NEW)
    product_quality: {
      completeness: schemaStats.productCompleteness,
      issues: schemaIssues.filter(i => i.category === 'product_quality' || i.category === 'content_quality').map(i => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
        hint: i.hint,
      })),
      recommendations: schemaRecommendations.slice(0, 10).map(r => ({
        field: r.field,
        message: r.message,
        priority: r.priority,
      })),
    },

    // Shipping Quality (NEW)
    shipping: {
      issues: schemaIssues.filter(i => i.category === 'shipping_quality').map(i => ({
        severity: i.severity,
        code: i.code,
        message: i.message,
        hint: i.hint,
      })),
    },

    // All issues combined (backwards compatible)
    issues: allIssues.map(i => ({
      severity: i.severity,
      code: i.code,
      message: i.message,
      hint: i.hint,
      category: i.category,
    })),

    // Lint Suggestions (NEW - Issue #9)
    lint_suggestions: lintSuggestions.map(s => ({
      severity: s.severity,
      title: s.title,
      code: s.code,
      path: s.path,
      impact: s.impact,
      fix: s.fix,
      code_snippet: s.codeSnippet,
      doc_link: s.docLink,
      generator_link: s.generatorLink,
    })),
  });
}
