/**
 * Structural Validator
 * Validates UCP Profile JSON structure (no network calls)
 */

import type { UcpProfile, UcpService, UcpCapability } from '../types/ucp-profile.js';
import type { ValidationIssue } from '../types/validation.js';
import { ValidationErrorCodes } from '../types/validation.js';

/**
 * Version format regex (YYYY-MM-DD)
 */
const VERSION_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the structural integrity of a UCP profile
 * Returns an array of validation issues
 */
export function validateStructure(profile: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check if it's an object
  if (!profile || typeof profile !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.MISSING_UCP_OBJECT,
      path: '$',
      message: 'Profile must be a JSON object',
      hint: 'Ensure your profile is valid JSON and contains a root object',
    });
    return issues;
  }

  const profileObj = profile as Record<string, unknown>;

  // Check for ucp root object
  if (!profileObj.ucp || typeof profileObj.ucp !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.MISSING_UCP_OBJECT,
      path: '$.ucp',
      message: 'Missing required "ucp" object at root level',
      hint: 'Add a "ucp" object containing version, services, and capabilities',
    });
    return issues;
  }

  const ucp = profileObj.ucp as Record<string, unknown>;

  // Validate version
  issues.push(...validateVersion(ucp));

  // Validate services
  issues.push(...validateServices(ucp));

  // Validate capabilities
  issues.push(...validateCapabilities(ucp));

  // Validate signing_keys if present
  if (profileObj.signing_keys !== undefined) {
    issues.push(...validateSigningKeys(profileObj.signing_keys));
  }

  return issues;
}

/**
 * Validate UCP version field
 */
function validateVersion(ucp: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!ucp.version) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.MISSING_VERSION,
      path: '$.ucp.version',
      message: 'Missing required "version" field in ucp object',
      hint: 'Add version field with format "YYYY-MM-DD" (e.g., "2026-01-11")',
    });
  } else if (typeof ucp.version !== 'string') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_VERSION_FORMAT,
      path: '$.ucp.version',
      message: 'Version must be a string',
      hint: 'Use format "YYYY-MM-DD" (e.g., "2026-01-11")',
    });
  } else if (!VERSION_REGEX.test(ucp.version)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_VERSION_FORMAT,
      path: '$.ucp.version',
      message: `Invalid version format: "${ucp.version}"`,
      hint: 'Use format "YYYY-MM-DD" (e.g., "2026-01-11")',
    });
  }

  return issues;
}

/**
 * Validate services object
 */
function validateServices(ucp: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!ucp.services) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.MISSING_SERVICES,
      path: '$.ucp.services',
      message: 'Missing required "services" field in ucp object',
      hint: 'Add a services object with at least one service definition',
    });
    return issues;
  }

  if (typeof ucp.services !== 'object' || Array.isArray(ucp.services)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: '$.ucp.services',
      message: 'Services must be an object (not an array)',
      hint: 'Use format: { "dev.ucp.shopping": { ... } }',
    });
    return issues;
  }

  const services = ucp.services as Record<string, unknown>;

  // Check for at least one service
  if (Object.keys(services).length === 0) {
    issues.push({
      severity: 'warn',
      code: ValidationErrorCodes.MISSING_SERVICES,
      path: '$.ucp.services',
      message: 'Services object is empty',
      hint: 'Add at least one service (e.g., "dev.ucp.shopping")',
    });
  }

  // Validate each service
  for (const [serviceName, service] of Object.entries(services)) {
    issues.push(...validateService(serviceName, service));
  }

  return issues;
}

/**
 * Validate individual service definition
 */
function validateService(name: string, service: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = `$.ucp.services["${name}"]`;

  if (!service || typeof service !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path,
      message: `Service "${name}" must be an object`,
    });
    return issues;
  }

  const svc = service as Record<string, unknown>;

  // Check required version
  if (!svc.version) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.version`,
      message: `Service "${name}" missing required "version" field`,
    });
  } else if (typeof svc.version === 'string' && !VERSION_REGEX.test(svc.version)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_VERSION_FORMAT,
      path: `${path}.version`,
      message: `Invalid version format in service "${name}"`,
      hint: 'Use format "YYYY-MM-DD"',
    });
  }

  // Check required spec
  if (!svc.spec) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.spec`,
      message: `Service "${name}" missing required "spec" field`,
    });
  }

  // Check for at least one transport
  const hasTransport = svc.rest || svc.mcp || svc.a2a || svc.embedded;
  if (!hasTransport) {
    issues.push({
      severity: 'warn',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path,
      message: `Service "${name}" has no transport bindings`,
      hint: 'Add at least one transport: rest, mcp, a2a, or embedded',
    });
  }

  // Validate REST transport if present
  if (svc.rest) {
    issues.push(...validateRestTransport(svc.rest, `${path}.rest`));
  }

  // Validate MCP transport if present
  if (svc.mcp) {
    issues.push(...validateMcpTransport(svc.mcp, `${path}.mcp`));
  }

  return issues;
}

/**
 * Validate REST transport binding
 */
function validateRestTransport(transport: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!transport || typeof transport !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path,
      message: 'REST transport must be an object',
    });
    return issues;
  }

  const rest = transport as Record<string, unknown>;

  if (!rest.schema) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.schema`,
      message: 'REST transport missing required "schema" field',
    });
  }

  if (!rest.endpoint) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.endpoint`,
      message: 'REST transport missing required "endpoint" field',
    });
  }

  return issues;
}

/**
 * Validate MCP transport binding
 */
function validateMcpTransport(transport: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!transport || typeof transport !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path,
      message: 'MCP transport must be an object',
    });
    return issues;
  }

  const mcp = transport as Record<string, unknown>;

  if (!mcp.schema) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.schema`,
      message: 'MCP transport missing required "schema" field',
    });
  }

  if (!mcp.endpoint) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SERVICE_STRUCTURE,
      path: `${path}.endpoint`,
      message: 'MCP transport missing required "endpoint" field',
    });
  }

  return issues;
}

/**
 * Validate capabilities array
 */
function validateCapabilities(ucp: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!ucp.capabilities) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.MISSING_CAPABILITIES,
      path: '$.ucp.capabilities',
      message: 'Missing required "capabilities" field in ucp object',
      hint: 'Add a capabilities array with at least one capability',
    });
    return issues;
  }

  if (!Array.isArray(ucp.capabilities)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path: '$.ucp.capabilities',
      message: 'Capabilities must be an array',
    });
    return issues;
  }

  if (ucp.capabilities.length === 0) {
    issues.push({
      severity: 'warn',
      code: ValidationErrorCodes.MISSING_CAPABILITIES,
      path: '$.ucp.capabilities',
      message: 'Capabilities array is empty',
      hint: 'Add at least one capability (e.g., dev.ucp.shopping.checkout)',
    });
  }

  // Validate each capability
  for (let i = 0; i < ucp.capabilities.length; i++) {
    issues.push(...validateCapability(ucp.capabilities[i], i));
  }

  return issues;
}

/**
 * Validate individual capability
 */
function validateCapability(capability: unknown, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = `$.ucp.capabilities[${index}]`;

  if (!capability || typeof capability !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path,
      message: `Capability at index ${index} must be an object`,
    });
    return issues;
  }

  const cap = capability as Record<string, unknown>;

  // Check required fields
  if (!cap.name) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path: `${path}.name`,
      message: 'Capability missing required "name" field',
    });
  }

  if (!cap.version) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path: `${path}.version`,
      message: 'Capability missing required "version" field',
    });
  } else if (typeof cap.version === 'string' && !VERSION_REGEX.test(cap.version)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_VERSION_FORMAT,
      path: `${path}.version`,
      message: `Invalid version format: "${cap.version}"`,
      hint: 'Use format "YYYY-MM-DD"',
    });
  }

  if (!cap.spec) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path: `${path}.spec`,
      message: 'Capability missing required "spec" field',
    });
  }

  if (!cap.schema) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE,
      path: `${path}.schema`,
      message: 'Capability missing required "schema" field',
    });
  }

  return issues;
}

/**
 * Validate signing_keys structure
 */
function validateSigningKeys(signingKeys: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = '$.signing_keys';

  if (typeof signingKeys !== 'object' || signingKeys === null) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SIGNING_KEY,
      path,
      message: 'signing_keys must be an object',
    });
    return issues;
  }

  const keys = signingKeys as Record<string, unknown>;

  if (!Array.isArray(keys.keys)) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SIGNING_KEY,
      path: `${path}.keys`,
      message: 'signing_keys.keys must be an array',
    });
    return issues;
  }

  for (let i = 0; i < keys.keys.length; i++) {
    issues.push(...validateJwk(keys.keys[i], `${path}.keys[${i}]`));
  }

  return issues;
}

/**
 * Validate JWK structure
 */
function validateJwk(jwk: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!jwk || typeof jwk !== 'object') {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SIGNING_KEY,
      path,
      message: 'JWK must be an object',
    });
    return issues;
  }

  const key = jwk as Record<string, unknown>;

  if (!key.kty) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SIGNING_KEY,
      path: `${path}.kty`,
      message: 'JWK missing required "kty" field',
    });
  }

  if (!key.kid) {
    issues.push({
      severity: 'error',
      code: ValidationErrorCodes.INVALID_SIGNING_KEY,
      path: `${path}.kid`,
      message: 'JWK missing required "kid" field',
    });
  }

  return issues;
}
