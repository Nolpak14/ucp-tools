/**
 * Unit Tests for UCP Profile Validation Logic
 * Tests the core validation functionality
 */

import { describe, it, expect } from 'vitest';

// Validation helper functions (extracted from api/validate.js logic)
const VERSION_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateVersion(version: string): boolean {
  return VERSION_REGEX.test(version);
}

function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getReadinessLevel(score: number, hasUcp: boolean) {
  if (score >= 90 && hasUcp) {
    return { level: 'ready', label: 'AI Commerce Ready' };
  }
  if (score >= 70 && hasUcp) {
    return { level: 'partial', label: 'Partially Ready' };
  }
  if (hasUcp || score >= 50) {
    return { level: 'limited', label: 'Limited Readiness' };
  }
  return { level: 'not_ready', label: 'Not Ready' };
}

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object') return Object.keys(val).length > 0;
  return true;
}

describe('UCP Version Validation', () => {
  it('should accept valid date format YYYY-MM-DD', () => {
    expect(validateVersion('2024-01-15')).toBe(true);
    expect(validateVersion('2025-12-31')).toBe(true);
    expect(validateVersion('2023-06-01')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(validateVersion('2024-1-15')).toBe(false); // Single digit month
    expect(validateVersion('2024/01/15')).toBe(false); // Wrong separator
    expect(validateVersion('24-01-15')).toBe(false); // Short year
    expect(validateVersion('2024-01')).toBe(false); // Missing day
    expect(validateVersion('v1.0.0')).toBe(false); // Semver
    expect(validateVersion('1.0')).toBe(false); // Numeric
    expect(validateVersion('')).toBe(false); // Empty
  });
});

describe('Grade Calculation', () => {
  it('should return A for scores >= 90', () => {
    expect(calculateGrade(90)).toBe('A');
    expect(calculateGrade(95)).toBe('A');
    expect(calculateGrade(100)).toBe('A');
  });

  it('should return B for scores 80-89', () => {
    expect(calculateGrade(80)).toBe('B');
    expect(calculateGrade(85)).toBe('B');
    expect(calculateGrade(89)).toBe('B');
  });

  it('should return C for scores 70-79', () => {
    expect(calculateGrade(70)).toBe('C');
    expect(calculateGrade(75)).toBe('C');
    expect(calculateGrade(79)).toBe('C');
  });

  it('should return D for scores 60-69', () => {
    expect(calculateGrade(60)).toBe('D');
    expect(calculateGrade(65)).toBe('D');
    expect(calculateGrade(69)).toBe('D');
  });

  it('should return F for scores < 60', () => {
    expect(calculateGrade(59)).toBe('F');
    expect(calculateGrade(50)).toBe('F');
    expect(calculateGrade(0)).toBe('F');
  });
});

describe('Readiness Level Calculation', () => {
  it('should return ready for high score with UCP', () => {
    const result = getReadinessLevel(95, true);
    expect(result.level).toBe('ready');
    expect(result.label).toBe('AI Commerce Ready');
  });

  it('should return partial for medium score with UCP', () => {
    const result = getReadinessLevel(75, true);
    expect(result.level).toBe('partial');
    expect(result.label).toBe('Partially Ready');
  });

  it('should return limited for low score with UCP', () => {
    const result = getReadinessLevel(55, true);
    expect(result.level).toBe('limited');
    expect(result.label).toBe('Limited Readiness');
  });

  it('should return limited for medium score without UCP', () => {
    const result = getReadinessLevel(60, false);
    expect(result.level).toBe('limited');
  });

  it('should return not_ready for very low score without UCP', () => {
    const result = getReadinessLevel(30, false);
    expect(result.level).toBe('not_ready');
    expect(result.label).toBe('Not Ready');
  });
});

describe('hasValue Helper', () => {
  it('should return false for null and undefined', () => {
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
  });

  it('should return false for empty strings', () => {
    expect(hasValue('')).toBe(false);
    expect(hasValue('   ')).toBe(false);
  });

  it('should return true for non-empty strings', () => {
    expect(hasValue('hello')).toBe(true);
    expect(hasValue('  hello  ')).toBe(true);
  });

  it('should return false for empty arrays', () => {
    expect(hasValue([])).toBe(false);
  });

  it('should return true for non-empty arrays', () => {
    expect(hasValue([1, 2, 3])).toBe(true);
    expect(hasValue([''])).toBe(true);
  });

  it('should return false for empty objects', () => {
    expect(hasValue({})).toBe(false);
  });

  it('should return true for non-empty objects', () => {
    expect(hasValue({ key: 'value' })).toBe(true);
  });

  it('should return true for numbers', () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue(42)).toBe(true);
  });

  it('should return true for booleans', () => {
    expect(hasValue(true)).toBe(true);
    expect(hasValue(false)).toBe(true);
  });
});

describe('UCP Profile Structure Validation', () => {
  interface UcpService {
    version?: string;
    spec?: string;
    rest?: { endpoint?: string };
    mcp?: unknown;
    a2a?: unknown;
    embedded?: unknown;
  }

  interface UcpCapability {
    name?: string;
    version?: string;
    spec?: string;
    schema?: string;
    extends?: string;
  }

  interface UcpProfile {
    ucp?: {
      version?: string;
      services?: Record<string, UcpService>;
      capabilities?: UcpCapability[];
    };
    signing_keys?: unknown[];
  }

  function validateProfile(profile: UcpProfile) {
    const issues: { code: string; message: string; severity: string }[] = [];

    if (!profile || typeof profile !== 'object') {
      issues.push({ code: 'UCP_MISSING_ROOT', message: 'Profile must be a JSON object', severity: 'error' });
      return issues;
    }

    if (!profile.ucp || typeof profile.ucp !== 'object') {
      issues.push({ code: 'UCP_MISSING_ROOT', message: 'Missing required "ucp" object', severity: 'error' });
      return issues;
    }

    const ucp = profile.ucp;

    // Version validation
    if (!ucp.version) {
      issues.push({ code: 'UCP_MISSING_VERSION', message: 'Missing version field', severity: 'error' });
    } else if (!VERSION_REGEX.test(ucp.version)) {
      issues.push({ code: 'UCP_INVALID_VERSION', message: `Invalid version: ${ucp.version}`, severity: 'error' });
    }

    // Services validation
    if (!ucp.services || typeof ucp.services !== 'object') {
      issues.push({ code: 'UCP_MISSING_SERVICES', message: 'Missing services', severity: 'error' });
    } else {
      for (const [name, svc] of Object.entries(ucp.services)) {
        if (!svc.version) {
          issues.push({ code: 'UCP_INVALID_SERVICE', message: `Service "${name}" missing version`, severity: 'error' });
        }
        if (!svc.spec) {
          issues.push({ code: 'UCP_INVALID_SERVICE', message: `Service "${name}" missing spec`, severity: 'error' });
        }
        if (!svc.rest && !svc.mcp && !svc.a2a && !svc.embedded) {
          issues.push({ code: 'UCP_NO_TRANSPORT', message: `Service "${name}" has no transport bindings`, severity: 'warn' });
        }
        if (svc.rest?.endpoint && !svc.rest.endpoint.startsWith('https://')) {
          issues.push({ code: 'UCP_ENDPOINT_NOT_HTTPS', message: 'Endpoint must use HTTPS', severity: 'error' });
        }
      }
    }

    // Capabilities validation
    if (!ucp.capabilities || !Array.isArray(ucp.capabilities)) {
      issues.push({ code: 'UCP_MISSING_CAPABILITIES', message: 'Missing capabilities array', severity: 'error' });
    } else {
      const capNames = new Set(ucp.capabilities.map((c) => c.name));

      ucp.capabilities.forEach((cap, i) => {
        if (!cap.name) {
          issues.push({ code: 'UCP_INVALID_CAP', message: `Capability ${i} missing name`, severity: 'error' });
        }
        if (!cap.version) {
          issues.push({ code: 'UCP_INVALID_CAP', message: `Capability ${i} missing version`, severity: 'error' });
        }

        // Namespace binding check
        if (cap.name?.startsWith('dev.ucp.')) {
          if (cap.spec && !cap.spec.startsWith('https://ucp.dev/')) {
            issues.push({ code: 'UCP_NS_MISMATCH', message: 'dev.ucp.* spec must be on ucp.dev', severity: 'error' });
          }
        }

        // Extension check
        if (cap.extends && !capNames.has(cap.extends)) {
          issues.push({ code: 'UCP_ORPHAN_EXT', message: `Parent "${cap.extends}" not found`, severity: 'error' });
        }
      });

      // Signing keys check for order capability
      const hasOrder = ucp.capabilities.some((c) => c.name === 'dev.ucp.shopping.order');
      if (hasOrder && (!profile.signing_keys || profile.signing_keys.length === 0)) {
        issues.push({ code: 'UCP_MISSING_KEYS', message: 'Order requires signing_keys', severity: 'error' });
      }
    }

    return issues;
  }

  it('should reject profile without ucp object', () => {
    const issues = validateProfile({} as UcpProfile);
    expect(issues.some((i) => i.code === 'UCP_MISSING_ROOT')).toBe(true);
  });

  it('should reject profile without version', () => {
    const issues = validateProfile({ ucp: { services: {}, capabilities: [] } });
    expect(issues.some((i) => i.code === 'UCP_MISSING_VERSION')).toBe(true);
  });

  it('should reject invalid version format', () => {
    const issues = validateProfile({ ucp: { version: 'v1.0', services: {}, capabilities: [] } });
    expect(issues.some((i) => i.code === 'UCP_INVALID_VERSION')).toBe(true);
  });

  it('should reject service without version', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: { shopping: { spec: 'https://example.com/spec' } },
        capabilities: [],
      },
    });
    expect(issues.some((i) => i.code === 'UCP_INVALID_SERVICE')).toBe(true);
  });

  it('should warn about service without transport', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: { shopping: { version: '1.0', spec: 'https://example.com/spec' } },
        capabilities: [],
      },
    });
    expect(issues.some((i) => i.code === 'UCP_NO_TRANSPORT')).toBe(true);
  });

  it('should reject non-HTTPS endpoints', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: {
          shopping: {
            version: '1.0',
            spec: 'https://example.com/spec',
            rest: { endpoint: 'http://api.example.com' },
          },
        },
        capabilities: [],
      },
    });
    expect(issues.some((i) => i.code === 'UCP_ENDPOINT_NOT_HTTPS')).toBe(true);
  });

  it('should accept valid profile', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: {
          shopping: {
            version: '1.0',
            spec: 'https://ucp.dev/spec',
            rest: { endpoint: 'https://api.example.com' },
          },
        },
        capabilities: [
          { name: 'dev.ucp.shopping.checkout', version: '1.0', spec: 'https://ucp.dev/cap', schema: 'https://ucp.dev/schema' },
        ],
      },
    });

    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('should require signing_keys for order capability', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: { shopping: { version: '1.0', spec: 'https://ucp.dev/spec', rest: {} } },
        capabilities: [{ name: 'dev.ucp.shopping.order', version: '1.0', spec: 'https://ucp.dev/cap', schema: 'https://ucp.dev/schema' }],
      },
    });
    expect(issues.some((i) => i.code === 'UCP_MISSING_KEYS')).toBe(true);
  });

  it('should accept order capability with signing_keys', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: { shopping: { version: '1.0', spec: 'https://ucp.dev/spec', rest: {} } },
        capabilities: [{ name: 'dev.ucp.shopping.order', version: '1.0', spec: 'https://ucp.dev/cap', schema: 'https://ucp.dev/schema' }],
      },
      signing_keys: [{ kid: 'key1' }],
    });
    expect(issues.some((i) => i.code === 'UCP_MISSING_KEYS')).toBe(false);
  });

  it('should enforce namespace binding for dev.ucp.*', () => {
    const issues = validateProfile({
      ucp: {
        version: '2024-01-01',
        services: {},
        capabilities: [
          {
            name: 'dev.ucp.shopping.checkout',
            version: '1.0',
            spec: 'https://example.com/spec', // Wrong domain
            schema: 'https://ucp.dev/schema',
          },
        ],
      },
    });
    expect(issues.some((i) => i.code === 'UCP_NS_MISMATCH')).toBe(true);
  });
});
