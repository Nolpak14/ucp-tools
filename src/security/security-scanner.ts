/**
 * Security Posture Scanner for UCP Endpoints
 * Scans UCP endpoints for common security misconfigurations
 */

import type { SecurityCheck, SecurityScanResult, SecurityScanOptions } from './types.js';
import { SecurityCheckIds } from './types.js';

const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Run a full security scan on a UCP endpoint
 */
export async function scanEndpointSecurity(
  domain: string,
  options: SecurityScanOptions = {}
): Promise<SecurityScanResult> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const checks: SecurityCheck[] = [];

  // Normalize domain
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const endpoint = `https://${normalizedDomain}/.well-known/ucp`;

  // Run all security checks
  checks.push(await checkHttpsRequired(normalizedDomain));
  checks.push(await checkPrivateIp(normalizedDomain));

  // Fetch the endpoint to analyze response
  const response = await fetchEndpointSafely(endpoint, timeoutMs);

  if (response.success && response.response && response.headers && response.body !== undefined) {
    checks.push(await checkTlsVersion(endpoint, response.response));
    checks.push(await checkCorsConfiguration(response.response, response.headers));
    checks.push(await checkSecurityHeaders(response.headers));
    checks.push(await checkContentType(response.headers));
    checks.push(await checkRateLimiting(response.headers));
    checks.push(await checkCacheHeaders(response.headers));
    checks.push(await checkErrorDisclosure(response.body));
    checks.push(checkResponseTime(response.responseTimeMs));
  } else {
    // Endpoint not reachable - add skip results
    checks.push(createSkippedCheck(SecurityCheckIds.TLS_VERSION, 'TLS Version', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.CORS_CONFIG, 'CORS Configuration', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.SECURITY_HEADERS, 'Security Headers', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.CONTENT_TYPE, 'Content-Type', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.RATE_LIMITING, 'Rate Limiting', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.CACHE_HEADERS, 'Cache Headers', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.ERROR_DISCLOSURE, 'Error Disclosure', 'Endpoint not reachable'));
    checks.push(createSkippedCheck(SecurityCheckIds.RESPONSE_TIME, 'Response Time', 'Endpoint not reachable'));
  }

  // Calculate score and grade
  const summary = calculateSummary(checks);
  const score = calculateScore(checks);
  const grade = calculateGrade(score);

  return {
    domain: normalizedDomain,
    endpoint,
    scanned_at: new Date().toISOString(),
    score,
    grade,
    checks,
    summary,
  };
}

/**
 * Fetch endpoint safely with timeout
 */
async function fetchEndpointSafely(
  url: string,
  timeoutMs: number
): Promise<{
  success: boolean;
  response?: Response;
  headers?: Headers;
  body?: string;
  responseTimeMs?: number;
  error?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UCP-Security-Scanner/1.0',
        'Origin': 'https://ucptools.dev',
      },
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    const body = await response.text();

    return {
      success: true,
      response,
      headers: response.headers,
      body,
      responseTimeMs,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check 1: HTTPS Required
 */
async function checkHttpsRequired(domain: string): Promise<SecurityCheck> {
  // Try HTTP to see if it redirects or is accessible
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`http://${domain}/.well-known/ucp`, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'User-Agent': 'UCP-Security-Scanner/1.0' },
    });

    clearTimeout(timeoutId);

    // Check if HTTP redirects to HTTPS
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location?.startsWith('https://')) {
        return {
          id: SecurityCheckIds.HTTPS_REQUIRED,
          name: 'HTTPS Enforcement',
          description: 'HTTP requests should redirect to HTTPS',
          status: 'pass',
          severity: 'critical',
          details: 'HTTP correctly redirects to HTTPS',
        };
      }
    }

    // HTTP is accessible without redirect
    if (response.ok) {
      return {
        id: SecurityCheckIds.HTTPS_REQUIRED,
        name: 'HTTPS Enforcement',
        description: 'HTTP requests should redirect to HTTPS',
        status: 'fail',
        severity: 'critical',
        details: 'HTTP endpoint is accessible without redirect to HTTPS',
        recommendation: 'Configure your server to redirect all HTTP traffic to HTTPS',
      };
    }

    // HTTP returns error (good - means HTTPS only)
    return {
      id: SecurityCheckIds.HTTPS_REQUIRED,
      name: 'HTTPS Enforcement',
      description: 'HTTP requests should redirect to HTTPS',
      status: 'pass',
      severity: 'critical',
      details: 'HTTP endpoint not accessible (HTTPS only)',
    };
  } catch {
    // HTTP connection failed - HTTPS only
    return {
      id: SecurityCheckIds.HTTPS_REQUIRED,
      name: 'HTTPS Enforcement',
      description: 'HTTP requests should redirect to HTTPS',
      status: 'pass',
      severity: 'critical',
      details: 'HTTP endpoint not accessible (HTTPS only)',
    };
  }
}

/**
 * Check 2: Private IP Detection
 */
async function checkPrivateIp(domain: string): Promise<SecurityCheck> {
  // Check if domain looks like a private IP or localhost
  const privatePatterns = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^::1$/,
    /^fc00:/i,
    /^fd00:/i,
  ];

  const isPrivate = privatePatterns.some(pattern => pattern.test(domain));

  if (isPrivate) {
    return {
      id: SecurityCheckIds.PRIVATE_IP,
      name: 'Private IP Detection',
      description: 'Endpoint should not use private/internal IP addresses',
      status: 'fail',
      severity: 'high',
      details: `Domain "${domain}" appears to be a private or internal address`,
      recommendation: 'Use a public domain name for production UCP endpoints',
    };
  }

  return {
    id: SecurityCheckIds.PRIVATE_IP,
    name: 'Private IP Detection',
    description: 'Endpoint should not use private/internal IP addresses',
    status: 'pass',
    severity: 'high',
    details: 'Domain is publicly routable',
  };
}

/**
 * Check 3: TLS Version
 */
async function checkTlsVersion(_url: string, _response: Response): Promise<SecurityCheck> {
  // Note: Browser fetch doesn't expose TLS version directly
  // We can only verify HTTPS is working
  return {
    id: SecurityCheckIds.TLS_VERSION,
    name: 'TLS Configuration',
    description: 'Endpoint should use TLS 1.2 or higher',
    status: 'pass',
    severity: 'high',
    details: 'HTTPS connection successful (TLS version not directly verifiable from browser)',
  };
}

/**
 * Check 4: CORS Configuration
 */
async function checkCorsConfiguration(_response: Response, headers: Headers): Promise<SecurityCheck> {
  const acao = headers.get('access-control-allow-origin');
  const acam = headers.get('access-control-allow-methods');
  const acah = headers.get('access-control-allow-headers');

  if (!acao) {
    return {
      id: SecurityCheckIds.CORS_CONFIG,
      name: 'CORS Configuration',
      description: 'CORS should be properly configured for AI agent access',
      status: 'warn',
      severity: 'medium',
      details: 'No Access-Control-Allow-Origin header found',
      recommendation: 'Configure CORS headers to allow AI agents to access your UCP endpoint',
    };
  }

  // Check if CORS is too permissive
  if (acao === '*') {
    return {
      id: SecurityCheckIds.CORS_CONFIG,
      name: 'CORS Configuration',
      description: 'CORS should be properly configured for AI agent access',
      status: 'warn',
      severity: 'low',
      details: 'CORS allows all origins (*). Consider restricting to known AI agent domains.',
      recommendation: 'For production, consider restricting CORS to specific trusted origins',
    };
  }

  const hasGoodConfig = acao && (acam || acah);

  return {
    id: SecurityCheckIds.CORS_CONFIG,
    name: 'CORS Configuration',
    description: 'CORS should be properly configured for AI agent access',
    status: hasGoodConfig ? 'pass' : 'warn',
    severity: 'medium',
    details: `CORS configured: Origin=${acao}${acam ? `, Methods=${acam}` : ''}`,
  };
}

/**
 * Check 5: Security Headers
 */
async function checkSecurityHeaders(headers: Headers): Promise<SecurityCheck> {
  const securityHeaders = {
    'x-content-type-options': headers.get('x-content-type-options'),
    'x-frame-options': headers.get('x-frame-options'),
    'x-xss-protection': headers.get('x-xss-protection'),
    'strict-transport-security': headers.get('strict-transport-security'),
    'content-security-policy': headers.get('content-security-policy'),
  };

  const presentHeaders: string[] = [];
  const missingHeaders: string[] = [];

  // Check important headers
  if (securityHeaders['strict-transport-security']) {
    presentHeaders.push('HSTS');
  } else {
    missingHeaders.push('HSTS');
  }

  if (securityHeaders['x-content-type-options']) {
    presentHeaders.push('X-Content-Type-Options');
  } else {
    missingHeaders.push('X-Content-Type-Options');
  }

  if (securityHeaders['x-frame-options']) {
    presentHeaders.push('X-Frame-Options');
  }

  // Calculate status based on critical headers
  const hasHsts = !!securityHeaders['strict-transport-security'];
  const hasXcto = !!securityHeaders['x-content-type-options'];

  let status: SecurityCheck['status'] = 'pass';
  let severity: SecurityCheck['severity'] = 'medium';

  if (!hasHsts && !hasXcto) {
    status = 'fail';
    severity = 'medium';
  } else if (!hasHsts || !hasXcto) {
    status = 'warn';
    severity = 'low';
  }

  return {
    id: SecurityCheckIds.SECURITY_HEADERS,
    name: 'Security Headers',
    description: 'Response should include security headers (HSTS, X-Content-Type-Options)',
    status,
    severity,
    details: presentHeaders.length > 0
      ? `Present: ${presentHeaders.join(', ')}${missingHeaders.length > 0 ? `. Missing: ${missingHeaders.join(', ')}` : ''}`
      : 'No security headers found',
    recommendation: missingHeaders.length > 0
      ? `Add missing security headers: ${missingHeaders.join(', ')}`
      : undefined,
  };
}

/**
 * Check 6: Content-Type
 */
async function checkContentType(headers: Headers): Promise<SecurityCheck> {
  const contentType = headers.get('content-type');

  if (!contentType) {
    return {
      id: SecurityCheckIds.CONTENT_TYPE,
      name: 'Content-Type Header',
      description: 'Response should have correct Content-Type for JSON',
      status: 'warn',
      severity: 'low',
      details: 'No Content-Type header found',
      recommendation: 'Set Content-Type: application/json for UCP endpoints',
    };
  }

  const isJson = contentType.includes('application/json');

  return {
    id: SecurityCheckIds.CONTENT_TYPE,
    name: 'Content-Type Header',
    description: 'Response should have correct Content-Type for JSON',
    status: isJson ? 'pass' : 'warn',
    severity: 'low',
    details: `Content-Type: ${contentType}`,
    recommendation: isJson ? undefined : 'Set Content-Type: application/json for UCP endpoints',
  };
}

/**
 * Check 7: Rate Limiting
 */
async function checkRateLimiting(headers: Headers): Promise<SecurityCheck> {
  // Look for common rate limiting headers
  const rateLimitHeaders = {
    'x-ratelimit-limit': headers.get('x-ratelimit-limit'),
    'x-ratelimit-remaining': headers.get('x-ratelimit-remaining'),
    'x-rate-limit-limit': headers.get('x-rate-limit-limit'),
    'ratelimit-limit': headers.get('ratelimit-limit'),
    'retry-after': headers.get('retry-after'),
  };

  const hasRateLimiting = Object.values(rateLimitHeaders).some(v => v !== null);

  if (hasRateLimiting) {
    const limitValue = rateLimitHeaders['x-ratelimit-limit'] ||
                       rateLimitHeaders['x-rate-limit-limit'] ||
                       rateLimitHeaders['ratelimit-limit'];
    return {
      id: SecurityCheckIds.RATE_LIMITING,
      name: 'Rate Limiting',
      description: 'Endpoint should have rate limiting to prevent abuse',
      status: 'pass',
      severity: 'high',
      details: `Rate limiting detected${limitValue ? `: ${limitValue} requests` : ''}`,
    };
  }

  return {
    id: SecurityCheckIds.RATE_LIMITING,
    name: 'Rate Limiting',
    description: 'Endpoint should have rate limiting to prevent abuse',
    status: 'warn',
    severity: 'high',
    details: 'No rate limiting headers detected (may still be present server-side)',
    recommendation: 'Implement rate limiting to protect against abuse and DoS attacks',
  };
}

/**
 * Check 8: Cache Headers
 */
async function checkCacheHeaders(headers: Headers): Promise<SecurityCheck> {
  const cacheControl = headers.get('cache-control');
  const etag = headers.get('etag');
  const lastModified = headers.get('last-modified');

  const hasCaching = cacheControl || etag || lastModified;

  if (!hasCaching) {
    return {
      id: SecurityCheckIds.CACHE_HEADERS,
      name: 'Cache Headers',
      description: 'Response should have appropriate caching headers',
      status: 'pass',
      severity: 'info',
      details: 'No caching headers found (optional)',
      recommendation: 'Consider adding Cache-Control headers for better performance',
    };
  }

  const details: string[] = [];
  if (cacheControl) details.push(`Cache-Control: ${cacheControl}`);
  if (etag) details.push('ETag present');
  if (lastModified) details.push('Last-Modified present');

  return {
    id: SecurityCheckIds.CACHE_HEADERS,
    name: 'Cache Headers',
    description: 'Response should have appropriate caching headers',
    status: 'pass',
    severity: 'info',
    details: details.join(', '),
  };
}

/**
 * Check 9: Error Disclosure
 */
async function checkErrorDisclosure(body: string): Promise<SecurityCheck> {
  // Look for signs of stack traces or internal error details
  const sensitivePatterns = [
    /stack\s*trace/i,
    /at\s+\w+\s+\([^)]+:\d+:\d+\)/,  // Stack trace lines
    /exception|error.*at\s+line/i,
    /mysql|postgresql|mongodb|redis/i,  // Database names in errors
    /\/home\/|\/var\/|\/usr\/|C:\\|D:\\/i,  // File paths
    /password|secret|api[_-]?key/i,
  ];

  const foundPatterns: string[] = [];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(body)) {
      const match = body.match(pattern);
      if (match) {
        foundPatterns.push(match[0].substring(0, 30));
      }
    }
  }

  if (foundPatterns.length > 0) {
    return {
      id: SecurityCheckIds.ERROR_DISCLOSURE,
      name: 'Error Information Disclosure',
      description: 'Response should not expose internal error details or stack traces',
      status: 'warn',
      severity: 'medium',
      details: `Potentially sensitive information found: ${foundPatterns.join(', ')}`,
      recommendation: 'Ensure production responses do not expose stack traces or internal paths',
    };
  }

  return {
    id: SecurityCheckIds.ERROR_DISCLOSURE,
    name: 'Error Information Disclosure',
    description: 'Response should not expose internal error details or stack traces',
    status: 'pass',
    severity: 'medium',
    details: 'No sensitive error information detected',
  };
}

/**
 * Check 10: Response Time
 */
function checkResponseTime(responseTimeMs?: number): SecurityCheck {
  if (!responseTimeMs) {
    return createSkippedCheck(SecurityCheckIds.RESPONSE_TIME, 'Response Time', 'Could not measure response time');
  }

  let status: SecurityCheck['status'] = 'pass';
  let severity: SecurityCheck['severity'] = 'low';
  let recommendation: string | undefined;

  if (responseTimeMs > 5000) {
    status = 'fail';
    severity = 'medium';
    recommendation = 'Response time is very slow. Consider optimizing your endpoint or using a CDN.';
  } else if (responseTimeMs > 2000) {
    status = 'warn';
    severity = 'low';
    recommendation = 'Response time is slow. Consider optimizing or using caching.';
  }

  return {
    id: SecurityCheckIds.RESPONSE_TIME,
    name: 'Response Time',
    description: 'Endpoint should respond quickly to prevent timeouts',
    status,
    severity,
    details: `Response time: ${responseTimeMs}ms`,
    recommendation,
  };
}

/**
 * Create a skipped check result
 */
function createSkippedCheck(id: string, name: string, reason: string): SecurityCheck {
  return {
    id,
    name,
    description: reason,
    status: 'skip',
    severity: 'info',
    details: `Skipped: ${reason}`,
  };
}

/**
 * Calculate summary from checks
 */
function calculateSummary(checks: SecurityCheck[]): SecurityScanResult['summary'] {
  return {
    passed: checks.filter(c => c.status === 'pass').length,
    failed: checks.filter(c => c.status === 'fail').length,
    warnings: checks.filter(c => c.status === 'warn').length,
    skipped: checks.filter(c => c.status === 'skip').length,
  };
}

/**
 * Calculate security score (0-100)
 */
function calculateScore(checks: SecurityCheck[]): number {
  const weights: Record<SecurityCheck['severity'], number> = {
    critical: 25,
    high: 20,
    medium: 15,
    low: 10,
    info: 5,
  };

  let totalWeight = 0;
  let earnedPoints = 0;

  for (const check of checks) {
    if (check.status === 'skip') continue;

    const weight = weights[check.severity];
    totalWeight += weight;

    if (check.status === 'pass') {
      earnedPoints += weight;
    } else if (check.status === 'warn') {
      earnedPoints += weight * 0.5;
    }
    // 'fail' gets 0 points
  }

  if (totalWeight === 0) return 0;

  return Math.round((earnedPoints / totalWeight) * 100);
}

/**
 * Calculate grade from score
 */
function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
