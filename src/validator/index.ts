/**
 * UCP Profile Validator
 * Main entry point combining structural, rules, and network validation
 */

import type { UcpProfile } from '../types/ucp-profile.js';
import type {
  ValidationReport,
  ValidationIssue,
  ValidationMode,
  ValidationOptions,
} from '../types/validation.js';
import { validateStructure } from './structural-validator.js';
import { validateRules } from './rules-validator.js';
import { validateNetwork, validateRemoteProfile, clearSchemaCache } from './network-validator.js';
import type { NetworkValidationOptions } from './network-validator.js';

export { validateStructure } from './structural-validator.js';
export { validateRules } from './rules-validator.js';
export { validateNetwork, validateRemoteProfile, clearSchemaCache } from './network-validator.js';

/**
 * Validate a UCP profile (local JSON)
 */
export async function validateProfile(
  profile: unknown,
  options: ValidationOptions = {}
): Promise<ValidationReport> {
  const mode = options.mode || 'full';
  const issues: ValidationIssue[] = [];

  // Phase 1: Structural validation (always run)
  if (mode === 'structural' || mode === 'rules' || mode === 'full') {
    const structuralIssues = validateStructure(profile);
    issues.push(...structuralIssues);

    // If structural validation has errors, don't proceed with rules/network
    const hasStructuralErrors = structuralIssues.some(i => i.severity === 'error');
    if (hasStructuralErrors && mode !== 'structural') {
      return buildReport(issues, mode, undefined, profile);
    }
  }

  // At this point, profile structure is valid
  const ucpProfile = profile as UcpProfile;

  // Phase 2: UCP rules validation
  if (mode === 'rules' || mode === 'full') {
    const rulesIssues = validateRules(ucpProfile);
    issues.push(...rulesIssues);
  }

  // Phase 3: Network validation (optional)
  if (mode === 'network' || mode === 'full') {
    if (!options.skipNetworkChecks) {
      const networkOptions: NetworkValidationOptions = {
        timeoutMs: options.timeoutMs,
        cacheTtlMs: options.cacheTtlMs,
      };
      const networkIssues = await validateNetwork(ucpProfile, networkOptions);
      issues.push(...networkIssues);
    }
  }

  return buildReport(issues, mode, undefined, ucpProfile);
}

/**
 * Validate a remote UCP profile (fetches from domain)
 */
export async function validateRemote(
  domain: string,
  options: ValidationOptions = {}
): Promise<ValidationReport> {
  const profileUrl = `https://${domain}/.well-known/ucp`;
  const issues: ValidationIssue[] = [];

  // Fetch remote profile
  const { profile, issues: fetchIssues } = await validateRemoteProfile(domain, {
    timeoutMs: options.timeoutMs,
    cacheTtlMs: options.cacheTtlMs,
  });
  issues.push(...fetchIssues);

  if (!profile) {
    return buildReport(issues, 'network', profileUrl, undefined);
  }

  // Run full validation on fetched profile
  const validationResult = await validateProfile(profile, options);
  issues.push(...validationResult.issues);

  return buildReport(issues, options.mode || 'full', profileUrl, profile);
}

/**
 * Build validation report
 */
function buildReport(
  issues: ValidationIssue[],
  mode: ValidationMode,
  profileUrl?: string,
  profile?: unknown
): ValidationReport {
  // Determine if validation passed (no errors)
  const hasErrors = issues.some(i => i.severity === 'error');

  // Extract UCP version if available
  let ucpVersion: string | undefined;
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    if (p.ucp && typeof p.ucp === 'object') {
      const ucp = p.ucp as Record<string, unknown>;
      if (typeof ucp.version === 'string') {
        ucpVersion = ucp.version;
      }
    }
  }

  return {
    ok: !hasErrors,
    profile_url: profileUrl,
    ucp_version: ucpVersion,
    issues,
    validated_at: new Date().toISOString(),
    validation_mode: mode,
  };
}

/**
 * Quick validation (structural + rules only, no network)
 */
export function validateQuick(profile: unknown): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Structural validation
  const structuralIssues = validateStructure(profile);
  issues.push(...structuralIssues);

  // If structural is OK, run rules validation
  const hasStructuralErrors = structuralIssues.some(i => i.severity === 'error');
  if (!hasStructuralErrors) {
    const rulesIssues = validateRules(profile as UcpProfile);
    issues.push(...rulesIssues);
  }

  return buildReport(issues, 'rules', undefined, profile);
}

/**
 * Parse and validate JSON string
 */
export async function validateJsonString(
  json: string,
  options: ValidationOptions = {}
): Promise<ValidationReport> {
  try {
    const profile = JSON.parse(json);
    return validateProfile(profile, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    return {
      ok: false,
      issues: [{
        severity: 'error',
        code: 'UCP_MISSING_ROOT' as const,
        path: '$',
        message: `Failed to parse JSON: ${message}`,
        hint: 'Ensure the input is valid JSON',
      }],
      validated_at: new Date().toISOString(),
      validation_mode: options.mode || 'full',
    };
  }
}
