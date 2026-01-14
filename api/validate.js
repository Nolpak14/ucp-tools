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
 */

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
  const url = `https://${domain}/.well-known/ucp`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UCP-Validator/1.0 (https://ucptools.dev)'
      },
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

function calculateReadinessScore(ucpIssues, schemaIssues, hasUcp, productCompleteness) {
  // Base score
  let score = 100;

  // UCP section (40 points max)
  if (!hasUcp) {
    score -= 35; // No UCP profile is major deduction
  } else {
    const ucpErrors = ucpIssues.filter(i => i.severity === 'error').length;
    const ucpWarnings = ucpIssues.filter(i => i.severity === 'warn').length;
    score -= Math.min(35, ucpErrors * 10 + ucpWarnings * 3);
  }

  // Schema section (35 points max)
  const schemaErrors = schemaIssues.filter(i => i.severity === 'error' && i.category === 'schema').length;
  const schemaWarnings = schemaIssues.filter(i => i.severity === 'warn' && i.category === 'schema').length;
  score -= Math.min(35, schemaErrors * 12 + schemaWarnings * 4);

  // Product quality section (25 points max)
  const productErrors = schemaIssues.filter(i => i.severity === 'error' && (i.category === 'product_quality' || i.category === 'content_quality')).length;
  const productWarnings = schemaIssues.filter(i => i.severity === 'warn' && (i.category === 'product_quality' || i.category === 'content_quality' || i.category === 'shipping_quality')).length;
  score -= Math.min(25, productErrors * 8 + productWarnings * 3);

  // Bonus for high product completeness
  if (productCompleteness >= 80) {
    score = Math.min(100, score + 5);
  }

  return Math.max(0, Math.round(score));
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

  if (score >= 90 && hasUcp && !hasCriticalSchema) {
    return { level: 'ready', label: 'AI Commerce Ready', color: '#16A34A' };
  }
  if (score >= 70 && hasUcp) {
    return { level: 'partial', label: 'Partially Ready', color: '#CA8A04' };
  }
  if (hasUcp || score >= 50) {
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
  const profileUrl = `https://${cleanDomain}/.well-known/ucp`;

  // Fetch UCP profile and homepage in parallel
  const [ucpResult, homepageResult] = await Promise.all([
    fetchProfile(cleanDomain),
    fetchHomepage(cleanDomain)
  ]);

  const { profile, error: ucpError } = ucpResult;
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
    profile_url: profileUrl,
    ucp_version: ucpVersion,

    // AI Readiness
    ai_readiness: {
      score: readinessScore,
      grade: grade,
      level: readiness.level,
      label: readiness.label,
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
  });
}
