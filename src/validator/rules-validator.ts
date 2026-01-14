/**
 * UCP Rules Validator
 * Validates UCP-specific business rules (no network calls)
 */

import type { UcpProfile, UcpCapability } from '../types/ucp-profile.js';
import type { ValidationIssue } from '../types/validation.js';
import { ValidationErrorCodes } from '../types/validation.js';
import { CAPABILITY_NAMESPACES, KNOWN_CAPABILITIES } from '../types/ucp-profile.js';

/**
 * Validate UCP business rules
 */
export function validateRules(profile: UcpProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Validate namespace/origin binding for capabilities
  issues.push(...validateNamespaceOrigins(profile));

  // Validate extension chains (no orphaned extends)
  issues.push(...validateExtensions(profile));

  // Validate endpoint rules
  issues.push(...validateEndpoints(profile));

  // Validate signing keys if Order capability is present
  issues.push(...validateSigningKeysRequirement(profile));

  return issues;
}

/**
 * Validate namespace and URL origin binding
 * - dev.ucp.* capabilities must have spec/schema from ucp.dev
 * - com.vendor.* capabilities must have spec/schema from vendor's domain
 */
function validateNamespaceOrigins(profile: UcpProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const capabilities = profile.ucp.capabilities || [];

  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    const path = `$.ucp.capabilities[${i}]`;

    // Check dev.ucp.* namespace
    if (cap.name.startsWith(CAPABILITY_NAMESPACES.UCP_OFFICIAL)) {
      // Spec must be from ucp.dev
      if (cap.spec && !isUcpDevOrigin(cap.spec)) {
        issues.push({
          severity: 'error',
          code: ValidationErrorCodes.NS_ORIGIN_MISMATCH,
          path: `${path}.spec`,
          message: `dev.ucp.* capability spec must be hosted on ucp.dev`,
          hint: `Use https://ucp.dev/specification/... instead of "${cap.spec}"`,
        });
      }

      // Schema must be from ucp.dev
      if (cap.schema && !isUcpDevOrigin(cap.schema)) {
        issues.push({
          severity: 'error',
          code: ValidationErrorCodes.NS_ORIGIN_MISMATCH,
          path: `${path}.schema`,
          message: `dev.ucp.* capability schema must be hosted on ucp.dev`,
          hint: `Use https://ucp.dev/schemas/... instead of "${cap.schema}"`,
        });
      }
    }

    // Check vendor namespace (com.vendor.*)
    if (cap.name.startsWith(CAPABILITY_NAMESPACES.VENDOR_PREFIX)) {
      const vendorDomain = extractVendorDomain(cap.name);
      if (vendorDomain) {
        // Spec origin should match vendor domain
        if (cap.spec && !isOriginFromDomain(cap.spec, vendorDomain)) {
          issues.push({
            severity: 'warn',
            code: ValidationErrorCodes.NS_ORIGIN_MISMATCH,
            path: `${path}.spec`,
            message: `Vendor capability spec should be hosted on vendor's domain (${vendorDomain})`,
            hint: `Consider hosting spec at https://${vendorDomain}/...`,
          });
        }

        // Schema origin should match vendor domain
        if (cap.schema && !isOriginFromDomain(cap.schema, vendorDomain)) {
          issues.push({
            severity: 'warn',
            code: ValidationErrorCodes.NS_ORIGIN_MISMATCH,
            path: `${path}.schema`,
            message: `Vendor capability schema should be hosted on vendor's domain (${vendorDomain})`,
            hint: `Consider hosting schema at https://${vendorDomain}/...`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate extension chains - ensure parent capabilities exist
 */
function validateExtensions(profile: UcpProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const capabilities = profile.ucp.capabilities || [];

  // Build set of capability names
  const capabilityNames = new Set(capabilities.map(c => c.name));

  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];

    if (cap.extends) {
      // Check if parent capability exists in this profile
      if (!capabilityNames.has(cap.extends)) {
        issues.push({
          severity: 'error',
          code: ValidationErrorCodes.ORPHANED_EXTENSION,
          path: `$.ucp.capabilities[${i}].extends`,
          message: `Extension "${cap.name}" references non-existent parent capability "${cap.extends}"`,
          hint: `Add "${cap.extends}" to capabilities or remove the extends field`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validate endpoint rules (https, no trailing slash)
 */
function validateEndpoints(profile: UcpProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const services = profile.ucp.services || {};

  for (const [serviceName, service] of Object.entries(services)) {
    const basePath = `$.ucp.services["${serviceName}"]`;

    // Validate REST endpoint
    if (service.rest?.endpoint) {
      issues.push(...validateEndpoint(service.rest.endpoint, `${basePath}.rest.endpoint`));
    }

    // Validate MCP endpoint
    if (service.mcp?.endpoint) {
      issues.push(...validateEndpoint(service.mcp.endpoint, `${basePath}.mcp.endpoint`));
    }

    // Validate A2A agent card URL
    if (service.a2a?.agentCard) {
      issues.push(...validateEndpoint(service.a2a.agentCard, `${basePath}.a2a.agentCard`));
    }
  }

  return issues;
}

/**
 * Validate a single endpoint URL
 */
function validateEndpoint(endpoint: string, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Must be HTTPS
  if (!endpoint.startsWith('https://')) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.ENDPOINT_NOT_HTTPS,
      path,
      message: `Endpoint must use HTTPS`,
      hint: `Change "${endpoint}" to use https://`,
    });
  }

  // Should not have trailing slash
  if (endpoint.endsWith('/')) {
    issues.push({
      severity: 'warn',
      code: ValidationErrorCodes.ENDPOINT_TRAILING_SLASH,
      path,
      message: `Endpoint should not have a trailing slash`,
      hint: `Remove trailing slash from "${endpoint}"`,
    });
  }

  // Check for private IP ranges (basic check)
  if (isPrivateIpEndpoint(endpoint)) {
    issues.push({
      severity: 'warn',
      code: ValidationErrorCodes.PRIVATE_IP_ENDPOINT,
      path,
      message: `Endpoint appears to use a private IP address`,
      hint: `Use a public domain name for production profiles`,
    });
  }

  return issues;
}

/**
 * Validate signing keys requirement for Order capability
 */
function validateSigningKeysRequirement(profile: UcpProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const capabilities = profile.ucp.capabilities || [];

  // Check if Order capability is present
  const hasOrderCapability = capabilities.some(
    c => c.name === KNOWN_CAPABILITIES.ORDER
  );

  if (hasOrderCapability) {
    // Signing keys should be present for webhook signing
    if (!profile.signing_keys || profile.signing_keys.length === 0) {
      issues.push({
        severity: 'error',
        code: ValidationErrorCodes.MISSING_SIGNING_KEYS,
        path: '$.signing_keys',
        message: `Order capability requires signing_keys for webhook verification`,
        hint: `Add signing_keys array with at least one JWK public key`,
      });
    }
  }

  return issues;
}

/**
 * Check if URL is from ucp.dev origin
 */
function isUcpDevOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'ucp.dev' || parsed.hostname.endsWith('.ucp.dev');
  } catch {
    return false;
  }
}

/**
 * Extract vendor domain from capability name
 * e.g., "com.example.feature" -> "example.com"
 */
function extractVendorDomain(name: string): string | null {
  if (!name.startsWith('com.')) {
    return null;
  }

  const parts = name.split('.');
  if (parts.length < 3) {
    return null;
  }

  // "com.example.feature" -> "example.com"
  return `${parts[1]}.com`;
}

/**
 * Check if URL origin matches expected domain
 */
function isOriginFromDomain(url: string, domain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/**
 * Check if endpoint uses private IP address
 */
function isPrivateIpEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    const hostname = parsed.hostname;

    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Check for private IP ranges (simplified)
    if (hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
