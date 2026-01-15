/**
 * Network Validator
 * Validates UCP profile with network checks (fetches remote schemas)
 */

import type { UcpProfile } from '../types/ucp-profile.js';
import type { ValidationIssue, FetchResult, SchemaCacheEntry } from '../types/validation.js';
import { ValidationErrorCodes } from '../types/validation.js';

// Simple in-memory cache for schema fetches
const schemaCache = new Map<string, SchemaCacheEntry>();
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds

export interface NetworkValidationOptions {
  timeoutMs?: number;
  cacheTtlMs?: number;
  skipSchemaFetch?: boolean;
}

/**
 * Validate UCP profile with network checks
 */
export async function validateNetwork(
  profile: UcpProfile,
  options: NetworkValidationOptions = {}
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;

  if (options.skipSchemaFetch) {
    return issues;
  }

  const capabilities = profile.ucp.capabilities || [];

  // Validate each capability's schema
  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    const path = `$.ucp.capabilities[${i}]`;

    if (cap.schema) {
      const schemaIssues = await validateCapabilitySchema(
        cap.schema,
        cap.name,
        cap.version,
        path,
        timeoutMs,
        cacheTtlMs
      );
      issues.push(...schemaIssues);
    }
  }

  return issues;
}

/**
 * Validate remote profile fetch
 */
export async function validateRemoteProfile(
  domain: string,
  options: NetworkValidationOptions = {}
): Promise<{ profile: UcpProfile | null; profileUrl?: string; issues: ValidationIssue[] }> {
  const issues: ValidationIssue[] = [];
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  // Try both /.well-known/ucp and /.well-known/ucp.json
  const urls = [
    `https://${domain}/.well-known/ucp`,
    `https://${domain}/.well-known/ucp.json`,
  ];

  for (const profileUrl of urls) {
    const result = await fetchProfileWithTimeout(profileUrl, timeoutMs);

    if (!result.success) {
      // Try next URL
      continue;
    }

    // Verify it's an object with ucp field
    if (!result.data || typeof result.data !== 'object') {
      continue;
    }

    const profileData = result.data as Record<string, unknown>;
    if (!profileData.ucp) {
      continue;
    }

    return { profile: result.data as UcpProfile, profileUrl, issues };
  }

  // All URLs failed
  issues.push({
    severity: 'error',
    code: ValidationErrorCodes.PROFILE_FETCH_FAILED,
    path: '$.well-known/ucp',
    message: 'No UCP profile found at /.well-known/ucp or /.well-known/ucp.json',
    hint: 'Check that the profile is accessible and returns valid JSON',
  });
  return { profile: null, issues };
}

/**
 * Validate a capability's schema (fetch and check self-describing)
 */
async function validateCapabilitySchema(
  schemaUrl: string,
  expectedName: string,
  expectedVersion: string,
  basePath: string,
  timeoutMs: number,
  cacheTtlMs: number
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Check cache first
  const cached = getCachedSchema(schemaUrl, cacheTtlMs);
  let schemaData: Record<string, unknown>;

  if (cached) {
    schemaData = cached;
  } else {
    // Fetch schema
    const result = await fetchWithTimeout<Record<string, unknown>>(schemaUrl, timeoutMs);

    if (!result.success) {
      issues.push({
        severity: 'warn',
        code: ValidationErrorCodes.SCHEMA_FETCH_FAILED,
        path: `${basePath}.schema`,
        message: `Failed to fetch schema from ${schemaUrl}`,
        hint: result.error || 'Schema URL may be incorrect or temporarily unavailable',
      });
      return issues;
    }

    if (!result.data) {
      issues.push({
        severity: 'warn',
        code: ValidationErrorCodes.SCHEMA_FETCH_FAILED,
        path: `${basePath}.schema`,
        message: `Schema response is empty`,
      });
      return issues;
    }

    schemaData = result.data;

    // Cache the schema
    cacheSchema(schemaUrl, schemaData, result.etag, cacheTtlMs);
  }

  // Check if schema is self-describing
  const selfDescribingIssues = validateSelfDescribingSchema(
    schemaData,
    expectedName,
    expectedVersion,
    basePath
  );
  issues.push(...selfDescribingIssues);

  return issues;
}

/**
 * Validate schema is self-describing (contains name and version matching capability)
 */
function validateSelfDescribingSchema(
  schema: Record<string, unknown>,
  expectedName: string,
  expectedVersion: string,
  basePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for $id or name field
  const schemaName = (schema.$id as string) || (schema.name as string);
  const schemaVersion = schema.version as string;

  if (!schemaName && !schema.$id) {
    issues.push({
      severity: 'info',
      code: ValidationErrorCodes.SCHEMA_NOT_SELF_DESCRIBING,
      path: `${basePath}.schema`,
      message: 'Schema does not contain self-describing $id or name field',
      hint: 'Consider adding $id field to schema for better discoverability',
    });
  }

  // If schema has a name, check it contains the capability name
  if (schemaName) {
    // Extract capability name from schema $id if it's a URL
    const nameFromId = extractNameFromSchemaId(schemaName);
    if (nameFromId && !expectedName.includes(nameFromId) && !nameFromId.includes(expectedName.split('.').pop() || '')) {
      issues.push({
        severity: 'warn',
        code: ValidationErrorCodes.SCHEMA_NAME_MISMATCH,
        path: `${basePath}.schema`,
        message: `Schema name "${nameFromId}" may not match capability "${expectedName}"`,
      });
    }
  }

  // Check version if present
  if (schemaVersion && schemaVersion !== expectedVersion) {
    issues.push({
      severity: 'info',
      code: ValidationErrorCodes.SCHEMA_VERSION_MISMATCH,
      path: `${basePath}.schema`,
      message: `Schema version "${schemaVersion}" differs from capability version "${expectedVersion}"`,
      hint: 'Ensure schema and capability versions are aligned',
    });
  }

  return issues;
}

/**
 * Extract capability name from schema $id URL
 */
function extractNameFromSchemaId(schemaId: string): string | null {
  try {
    const url = new URL(schemaId);
    // Extract last path segment without .json extension
    const pathParts = url.pathname.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || '';
    return lastPart.replace('.json', '');
  } catch {
    // Not a URL, return as-is
    return schemaId;
  }
}

/**
 * Fetch profile URL with timeout, checking for HTML responses
 */
async function fetchProfileWithTimeout(
  url: string,
  timeoutMs: number
): Promise<FetchResult<unknown>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UCP-Profile-Validator/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }

    const text = await response.text();

    // Check if response looks like JSON (not HTML)
    if (text.trim().startsWith('<')) {
      return {
        success: false,
        error: 'Response is HTML, not JSON',
      };
    }

    const data = JSON.parse(text);
    const etag = response.headers.get('etag') || undefined;

    return {
      success: true,
      data,
      statusCode: response.status,
      etag,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timed out after ${timeoutMs}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
}

/**
 * Fetch URL with timeout
 */
async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number
): Promise<FetchResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'UCP-Profile-Validator/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }

    const data = await response.json() as T;
    const etag = response.headers.get('etag') || undefined;

    return {
      success: true,
      data,
      statusCode: response.status,
      etag,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timed out after ${timeoutMs}ms`,
        };
      }
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }
}

/**
 * Get cached schema if valid
 */
function getCachedSchema(
  url: string,
  cacheTtlMs: number
): Record<string, unknown> | null {
  const cached = schemaCache.get(url);
  if (!cached) {
    return null;
  }

  const now = new Date().toISOString();
  if (cached.expiresAt < now) {
    schemaCache.delete(url);
    return null;
  }

  return cached.body;
}

/**
 * Cache a schema
 */
function cacheSchema(
  url: string,
  body: Record<string, unknown>,
  etag: string | undefined,
  cacheTtlMs: number
): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + cacheTtlMs);

  schemaCache.set(url, {
    url,
    etag,
    fetchedAt: now.toISOString(),
    body,
    expiresAt: expiresAt.toISOString(),
  });
}

/**
 * Clear the schema cache
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
}
