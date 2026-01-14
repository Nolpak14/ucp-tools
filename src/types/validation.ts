/**
 * Validation Types for UCP Profile Validator
 */

// Validation severity levels
export type ValidationSeverity = 'error' | 'warn' | 'info';

// Validation error codes
export const ValidationErrorCodes = {
  // Structural errors
  MISSING_UCP_OBJECT: 'UCP_MISSING_ROOT',
  MISSING_VERSION: 'UCP_MISSING_VERSION',
  INVALID_VERSION_FORMAT: 'UCP_INVALID_VERSION_FORMAT',
  MISSING_SERVICES: 'UCP_MISSING_SERVICES',
  MISSING_CAPABILITIES: 'UCP_MISSING_CAPABILITIES',
  INVALID_SERVICE_STRUCTURE: 'UCP_INVALID_SERVICE',
  INVALID_CAPABILITY_STRUCTURE: 'UCP_INVALID_CAPABILITY',

  // UCP rules errors
  NS_ORIGIN_MISMATCH: 'UCP_NS_ORIGIN_MISMATCH',
  ORPHANED_EXTENSION: 'UCP_ORPHANED_EXTENSION',
  ENDPOINT_NOT_HTTPS: 'UCP_ENDPOINT_NOT_HTTPS',
  ENDPOINT_TRAILING_SLASH: 'UCP_ENDPOINT_TRAILING_SLASH',
  MISSING_SIGNING_KEYS: 'UCP_MISSING_SIGNING_KEYS',
  INVALID_SIGNING_KEY: 'UCP_INVALID_SIGNING_KEY',

  // Network validation errors
  PROFILE_FETCH_FAILED: 'UCP_PROFILE_FETCH_FAILED',
  SCHEMA_FETCH_FAILED: 'UCP_SCHEMA_FETCH_FAILED',
  SCHEMA_NOT_SELF_DESCRIBING: 'UCP_SCHEMA_NOT_SELF_DESCRIBING',
  SCHEMA_NAME_MISMATCH: 'UCP_SCHEMA_NAME_MISMATCH',
  SCHEMA_VERSION_MISMATCH: 'UCP_SCHEMA_VERSION_MISMATCH',
  PRIVATE_IP_ENDPOINT: 'UCP_PRIVATE_IP_ENDPOINT',
} as const;

export type ValidationErrorCode = typeof ValidationErrorCodes[keyof typeof ValidationErrorCodes];

// Single validation issue
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: ValidationErrorCode;
  path: string;          // JSON path (e.g., "$.ucp.capabilities[0].schema")
  message: string;       // Human-readable message
  hint?: string;         // Suggestion for fixing
}

// Validation report
export interface ValidationReport {
  ok: boolean;
  profile_url?: string;   // For remote validation
  ucp_version?: string;
  issues: ValidationIssue[];
  validated_at: string;   // ISO timestamp
  validation_mode: ValidationMode;
}

// Validation modes
export type ValidationMode = 'structural' | 'rules' | 'network' | 'full';

// Validation options
export interface ValidationOptions {
  mode?: ValidationMode;
  skipNetworkChecks?: boolean;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

// Schema cache entry
export interface SchemaCacheEntry {
  url: string;
  etag?: string;
  fetchedAt: string;
  body: Record<string, unknown>;
  expiresAt: string;
}

// Remote fetch result
export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  etag?: string;
}
