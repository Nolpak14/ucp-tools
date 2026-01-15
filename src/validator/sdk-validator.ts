/**
 * SDK-based Validator
 * Validates UCP profiles using the official @ucp-js/sdk Zod schemas
 * 
 * This provides spec-compliant validation using the official UCP SDK,
 * ensuring alignment with the latest UCP specification.
 */

import {
  UcpDiscoveryProfileSchema,
  UcpClassSchema,
  UcpServiceSchema,
  CapabilityDiscoverySchema,
  SigningKeySchema,
  type UcpDiscoveryProfile,
  type UcpClass,
  type UcpService,
  type CapabilityDiscovery,
  type SigningKey,
} from '@ucp-js/sdk';
import { z, ZodError, ZodIssue } from 'zod';
import type { ValidationIssue } from '../types/validation.js';
import { ValidationErrorCodes } from '../types/validation.js';

/**
 * SDK validation result
 */
export interface SdkValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  sdkVersion: string;
  parsedProfile?: UcpDiscoveryProfile;
}

/**
 * Get the current SDK version
 */
export function getSdkVersion(): string {
  // Note: In production, this would be read from package.json
  return '0.1.0';
}

/**
 * Map Zod error path to JSON path string
 */
function zodPathToJsonPath(path: (string | number)[]): string {
  if (path.length === 0) return '$';
  
  return '$.' + path.map((segment) => {
    if (typeof segment === 'number') {
      return `[${segment}]`;
    }
    // Handle keys with special characters
    if (/[.\[\]"]/.test(segment)) {
      return `["${segment}"]`;
    }
    return segment;
  }).join('.').replace(/\.\[/g, '[');
}

/**
 * Convert Zod issue to ValidationIssue
 */
function zodIssueToValidationIssue(issue: ZodIssue): ValidationIssue {
  const path = zodPathToJsonPath(issue.path);
  
  // Map Zod error codes to our validation codes
  let code: string = ValidationErrorCodes.INVALID_SERVICE_STRUCTURE;
  let hint: string | undefined;
  
  switch (issue.code) {
    case 'invalid_type':
      if (issue.path.includes('version')) {
        code = ValidationErrorCodes.INVALID_VERSION_FORMAT;
        hint = 'Use YYYY-MM-DD format (e.g., "2026-01-11")';
      } else if (issue.path.includes('services')) {
        code = ValidationErrorCodes.INVALID_SERVICE_STRUCTURE;
      } else if (issue.path.includes('capabilities')) {
        code = ValidationErrorCodes.INVALID_CAPABILITY_STRUCTURE;
      } else if (issue.path.includes('signing_keys')) {
        code = ValidationErrorCodes.INVALID_SIGNING_KEY;
      }
      break;
    case 'invalid_string':
    case 'invalid_enum_value':
      if (issue.path.includes('version')) {
        code = ValidationErrorCodes.INVALID_VERSION_FORMAT;
      }
      break;
    case 'unrecognized_keys':
      // SDK allows extra keys, just warn
      return {
        severity: 'warn',
        code: code as any,
        path,
        message: `Unrecognized field(s): ${(issue as any).keys?.join(', ')}`,
        hint: 'Extra fields are allowed but may not be used by UCP clients',
      };
    default:
      break;
  }
  
  return {
    severity: 'error',
    code: code as any,
    path,
    message: issue.message,
    hint,
  };
}

/**
 * Validate a UCP profile using the official SDK schema
 * 
 * This uses the UcpDiscoveryProfileSchema from @ucp-js/sdk to validate
 * the entire profile structure against the official UCP specification.
 */
export function validateWithSdk(profile: unknown): SdkValidationResult {
  const issues: ValidationIssue[] = [];
  
  try {
    // Parse with the official SDK schema (strict mode)
    const parsed = UcpDiscoveryProfileSchema.parse(profile);
    
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
      parsedProfile: parsed,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      // Convert Zod errors to our validation issues
      for (const issue of error.issues) {
        issues.push(zodIssueToValidationIssue(issue));
      }
    } else {
      // Unexpected error
      issues.push({
        severity: 'error',
        code: ValidationErrorCodes.MISSING_UCP_OBJECT,
        path: '$',
        message: error instanceof Error ? error.message : 'Unknown validation error',
      });
    }
    
    return {
      valid: false,
      issues,
      sdkVersion: getSdkVersion(),
    };
  }
}

/**
 * Safe parse - doesn't throw, returns result with errors
 */
export function safeValidateWithSdk(profile: unknown): SdkValidationResult {
  const result = UcpDiscoveryProfileSchema.safeParse(profile);
  
  if (result.success) {
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
      parsedProfile: result.data,
    };
  }
  
  const issues = result.error.issues.map(zodIssueToValidationIssue);
  
  return {
    valid: false,
    issues,
    sdkVersion: getSdkVersion(),
  };
}

/**
 * Validate only the UCP object (version, services, capabilities)
 */
export function validateUcpObject(ucp: unknown): SdkValidationResult {
  const issues: ValidationIssue[] = [];
  
  const result = UcpClassSchema.safeParse(ucp);
  
  if (result.success) {
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
    };
  }
  
  for (const issue of result.error.issues) {
    const validationIssue = zodIssueToValidationIssue(issue);
    // Prefix path with $.ucp
    validationIssue.path = validationIssue.path === '$' 
      ? '$.ucp' 
      : validationIssue.path.replace('$', '$.ucp');
    issues.push(validationIssue);
  }
  
  return {
    valid: false,
    issues,
    sdkVersion: getSdkVersion(),
  };
}

/**
 * Validate a single service definition
 */
export function validateServiceWithSdk(
  serviceName: string, 
  service: unknown
): SdkValidationResult {
  const result = UcpServiceSchema.safeParse(service);
  
  if (result.success) {
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
    };
  }
  
  const issues = result.error.issues.map(issue => {
    const validationIssue = zodIssueToValidationIssue(issue);
    validationIssue.path = validationIssue.path === '$'
      ? `$.ucp.services["${serviceName}"]`
      : validationIssue.path.replace('$', `$.ucp.services["${serviceName}"]`);
    return validationIssue;
  });
  
  return {
    valid: false,
    issues,
    sdkVersion: getSdkVersion(),
  };
}

/**
 * Validate a single capability definition
 */
export function validateCapabilityWithSdk(
  index: number,
  capability: unknown
): SdkValidationResult {
  const result = CapabilityDiscoverySchema.safeParse(capability);
  
  if (result.success) {
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
    };
  }
  
  const issues = result.error.issues.map(issue => {
    const validationIssue = zodIssueToValidationIssue(issue);
    validationIssue.path = validationIssue.path === '$'
      ? `$.ucp.capabilities[${index}]`
      : validationIssue.path.replace('$', `$.ucp.capabilities[${index}]`);
    return validationIssue;
  });
  
  return {
    valid: false,
    issues,
    sdkVersion: getSdkVersion(),
  };
}

/**
 * Validate signing keys array
 */
export function validateSigningKeysWithSdk(
  signingKeys: unknown
): SdkValidationResult {
  // SDK expects signing_keys as an array of SigningKey objects
  const SigningKeysArraySchema = z.array(SigningKeySchema);
  const result = SigningKeysArraySchema.safeParse(signingKeys);
  
  if (result.success) {
    return {
      valid: true,
      issues: [],
      sdkVersion: getSdkVersion(),
    };
  }
  
  const issues = result.error.issues.map(issue => {
    const validationIssue = zodIssueToValidationIssue(issue);
    validationIssue.path = validationIssue.path === '$'
      ? '$.signing_keys'
      : validationIssue.path.replace('$', '$.signing_keys');
    return validationIssue;
  });
  
  return {
    valid: false,
    issues,
    sdkVersion: getSdkVersion(),
  };
}

/**
 * Check if a profile passes SDK validation (quick boolean check)
 */
export function isSdkCompliant(profile: unknown): boolean {
  const result = UcpDiscoveryProfileSchema.safeParse(profile);
  return result.success;
}

/**
 * Export SDK schemas for direct use
 */
export {
  UcpDiscoveryProfileSchema,
  UcpClassSchema,
  UcpServiceSchema,
  CapabilityDiscoverySchema,
  SigningKeySchema,
  type UcpDiscoveryProfile,
  type UcpClass,
  type UcpService,
  type CapabilityDiscovery,
  type SigningKey,
};
