/**
 * Tests for UCP Profile Validation against Official Samples
 * Based on: https://github.com/Universal-Commerce-Protocol/samples
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import validators
import { validateStructure } from '../../src/validator/structural-validator.js';
import { validateRules } from '../../src/validator/rules-validator.js';

// Load test fixtures
const fixturesDir = join(__dirname, '../fixtures');
const officialSampleProfile = JSON.parse(
  readFileSync(join(fixturesDir, 'official-sample-profile.json'), 'utf-8')
);
const nonCompliantProfile = JSON.parse(
  readFileSync(join(fixturesDir, 'non-compliant-profile.json'), 'utf-8')
);

describe('Official UCP Sample Profile Validation', () => {
  describe('Structural Validation', () => {
    it('should pass structural validation for official sample', () => {
      const issues = validateStructure(officialSampleProfile);
      const errors = issues.filter(i => i.severity === 'error');

      expect(errors).toHaveLength(0);
    });

    it('should identify structural issues in non-compliant profile', () => {
      const issues = validateStructure(nonCompliantProfile);
      const errors = issues.filter(i => i.severity === 'error');

      // Non-compliant profile should have errors
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Rules Validation', () => {
    it('should pass rules validation for official sample', () => {
      const issues = validateRules(officialSampleProfile);
      const errors = issues.filter(i => i.severity === 'error');

      expect(errors).toHaveLength(0);
    });
  });

  describe('Version Format', () => {
    it('should accept YYYY-MM-DD version format', () => {
      const issues = validateStructure(officialSampleProfile);
      const versionIssues = issues.filter(i => i.code === 'UCP_INVALID_VERSION' || i.code === 'UCP_INVALID_VERSION_FORMAT');

      expect(versionIssues).toHaveLength(0);
    });

    it('should reject semver-style version format', () => {
      const issues = validateStructure(nonCompliantProfile);
      const versionIssues = issues.filter(i => i.code === 'UCP_INVALID_VERSION' || i.code === 'UCP_INVALID_VERSION_FORMAT');

      expect(versionIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Services Structure', () => {
    it('should accept properly structured services', () => {
      const issues = validateStructure(officialSampleProfile);
      const serviceIssues = issues.filter(i =>
        i.code === 'UCP_INVALID_SERVICE' || i.code === 'UCP_NO_TRANSPORT'
      );

      expect(serviceIssues).toHaveLength(0);
    });

    it('should reject string-only service definitions', () => {
      const issues = validateStructure(nonCompliantProfile);
      const serviceIssues = issues.filter(i =>
        i.code === 'UCP_INVALID_SERVICE' || i.code === 'UCP_NO_TRANSPORT'
      );

      expect(serviceIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Capabilities Structure', () => {
    it('should accept properly structured capabilities', () => {
      const issues = validateStructure(officialSampleProfile);
      const capIssues = issues.filter(i => i.code === 'UCP_INVALID_CAP' || i.code === 'UCP_INVALID_CAPABILITY');

      expect(capIssues).toHaveLength(0);
    });

    it('should reject string-only capability definitions', () => {
      const issues = validateStructure(nonCompliantProfile);
      const capIssues = issues.filter(i =>
        i.code === 'UCP_INVALID_CAP' || i.code === 'UCP_INVALID_CAPABILITY' || i.code === 'UCP_MISSING_CAPABILITIES'
      );

      expect(capIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Capability Extensions', () => {
    it('should validate extends references in official sample', () => {
      const issues = validateRules(officialSampleProfile);
      const extIssues = issues.filter(i => i.code === 'UCP_ORPHAN_EXT');

      // Official sample has valid extension chain:
      // order extends checkout, fulfillment extends order
      expect(extIssues).toHaveLength(0);
    });
  });

  describe('Signing Keys', () => {
    it('should accept signing_keys when order capability is present', () => {
      const issues = validateRules(officialSampleProfile);
      const keyIssues = issues.filter(i => i.code === 'UCP_MISSING_KEYS' || i.code === 'UCP_MISSING_SIGNING_KEYS');

      expect(keyIssues).toHaveLength(0);
    });

    it('should require signing_keys when order capability is present', () => {
      // Create a profile with order but no signing_keys
      const profileWithOrder = {
        ucp: {
          version: '2026-01-11',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping',
              rest: { endpoint: 'https://example.com/api' }
            }
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.order',
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping/order',
              schema: 'https://ucp.dev/schemas/shopping/order.json'
            }
          ]
        }
      };

      const issues = validateRules(profileWithOrder);
      const keyIssues = issues.filter(i => i.code === 'UCP_MISSING_KEYS' || i.code === 'UCP_MISSING_SIGNING_KEYS');

      expect(keyIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Namespace Binding', () => {
    it('should enforce dev.ucp.* spec URL domain', () => {
      const profileWithWrongSpec = {
        ucp: {
          version: '2026-01-11',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping',
              rest: { endpoint: 'https://example.com/api' }
            }
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-11',
              spec: 'https://wrong-domain.com/spec', // Wrong domain
              schema: 'https://ucp.dev/schemas/shopping/checkout.json'
            }
          ]
        }
      };

      const issues = validateRules(profileWithWrongSpec);
      const nsIssues = issues.filter(i => i.code === 'UCP_NS_ORIGIN_MISMATCH');

      expect(nsIssues.length).toBeGreaterThan(0);
    });
  });
});

describe('Profile Compliance Summary', () => {
  it('official sample should be fully compliant', () => {
    const structuralIssues = validateStructure(officialSampleProfile);
    const rulesIssues = validateRules(officialSampleProfile);
    const allIssues = [...structuralIssues, ...rulesIssues];

    const errors = allIssues.filter(i => i.severity === 'error');
    const warnings = allIssues.filter(i => i.severity === 'warn');

    expect(errors).toHaveLength(0);
    // May have some warnings, that's okay
    console.log(`Official sample: ${errors.length} errors, ${warnings.length} warnings`);
  });

  it('non-compliant sample should have multiple errors', () => {
    const structuralIssues = validateStructure(nonCompliantProfile);
    const allIssues = [...structuralIssues];

    const errors = allIssues.filter(i => i.severity === 'error');

    // Non-compliant profile should have errors for:
    // - Invalid version format
    // - Services as strings instead of objects
    // - Capabilities as strings instead of objects
    expect(errors.length).toBeGreaterThanOrEqual(3);
    console.log(`Non-compliant sample: ${errors.length} errors`);
  });
});
