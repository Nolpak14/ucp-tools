/**
 * Tests for SDK-based Validator
 * Tests validation using the official @ucp-js/sdk Zod schemas
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  validateWithSdk,
  safeValidateWithSdk,
  validateUcpObject,
  validateServiceWithSdk,
  validateCapabilityWithSdk,
  validateSigningKeysWithSdk,
  isSdkCompliant,
  getSdkVersion,
} from '../../src/validator/sdk-validator.js';

// Load test fixtures
const fixturesDir = join(process.cwd(), 'tests', 'fixtures');
const officialSampleProfile = JSON.parse(
  readFileSync(join(fixturesDir, 'official-sample-profile.json'), 'utf-8')
);
const nonCompliantProfile = JSON.parse(
  readFileSync(join(fixturesDir, 'non-compliant-profile.json'), 'utf-8')
);

describe('SDK Validator', () => {
  describe('getSdkVersion', () => {
    it('should return the SDK version', () => {
      const version = getSdkVersion();
      expect(version).toBe('0.1.0');
    });
  });

  describe('isSdkCompliant', () => {
    it('should return true for official sample profile', () => {
      expect(isSdkCompliant(officialSampleProfile)).toBe(true);
    });

    it('should return false for non-compliant profile', () => {
      expect(isSdkCompliant(nonCompliantProfile)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isSdkCompliant({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isSdkCompliant(null)).toBe(false);
    });
  });

  describe('validateWithSdk', () => {
    it('should validate official sample profile successfully', () => {
      const result = validateWithSdk(officialSampleProfile);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.sdkVersion).toBe('0.1.0');
      expect(result.parsedProfile).toBeDefined();
    });

    it('should return issues for non-compliant profile', () => {
      const result = validateWithSdk(nonCompliantProfile);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.sdkVersion).toBe('0.1.0');
    });

    it('should validate profile with all optional fields', () => {
      const fullProfile = {
        ucp: {
          version: '2026-01-15',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                endpoint: 'https://example.com/api',
                schema: 'https://ucp.dev/schemas/shopping.json',
              },
            },
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/shopping/checkout',
              schema: 'https://ucp.dev/schemas/shopping/checkout.json',
            },
          ],
        },
        signing_keys: [
          {
            kty: 'EC',
            kid: 'key-1',
            crv: 'P-256',
            x: 'test-x',
            y: 'test-y',
            use: 'sig',
          },
        ],
      };

      const result = validateWithSdk(fullProfile);
      expect(result.valid).toBe(true);
    });
  });

  describe('safeValidateWithSdk', () => {
    it('should not throw for invalid input', () => {
      expect(() => safeValidateWithSdk(null)).not.toThrow();
      expect(() => safeValidateWithSdk(undefined)).not.toThrow();
      expect(() => safeValidateWithSdk('string')).not.toThrow();
      expect(() => safeValidateWithSdk(123)).not.toThrow();
    });

    it('should return valid: false for invalid profiles', () => {
      const result = safeValidateWithSdk({ invalid: true });
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('validateUcpObject', () => {
    it('should validate ucp object from official sample', () => {
      const result = validateUcpObject(officialSampleProfile.ucp);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail for ucp object from non-compliant profile', () => {
      const result = validateUcpObject(nonCompliantProfile.ucp);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should validate minimal ucp object', () => {
      const minimalUcp = {
        version: '2026-01-15',
        services: {
          'dev.ucp.shopping': {
            version: '2026-01-15',
            spec: 'https://ucp.dev/specs/shopping',
            rest: {
              endpoint: 'https://example.com/api',
              schema: 'https://ucp.dev/schemas/shopping.json',
            },
          },
        },
        capabilities: [
          {
            name: 'dev.ucp.shopping.checkout',
            version: '2026-01-15',
            spec: 'https://ucp.dev/specs/checkout',
            schema: 'https://ucp.dev/schemas/checkout.json',
          },
        ],
      };

      const result = validateUcpObject(minimalUcp);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateServiceWithSdk', () => {
    it('should validate a properly structured service', () => {
      const service = {
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/shopping',
        rest: {
          endpoint: 'https://example.com/api',
          schema: 'https://ucp.dev/schemas/shopping.json',
        },
      };

      const result = validateServiceWithSdk('dev.ucp.shopping', service);
      expect(result.valid).toBe(true);
    });

    it('should fail for service missing version', () => {
      const service = {
        spec: 'https://ucp.dev/specs/shopping',
        rest: {
          endpoint: 'https://example.com/api',
          schema: 'https://ucp.dev/schemas/shopping.json',
        },
      };

      const result = validateServiceWithSdk('dev.ucp.shopping', service);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.path.includes('version'))).toBe(true);
    });

    it('should fail for service missing spec', () => {
      const service = {
        version: '2026-01-15',
        rest: {
          endpoint: 'https://example.com/api',
          schema: 'https://ucp.dev/schemas/shopping.json',
        },
      };

      const result = validateServiceWithSdk('dev.ucp.shopping', service);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.path.includes('spec'))).toBe(true);
    });

    it('should validate service with MCP transport', () => {
      const service = {
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/shopping',
        mcp: {
          endpoint: 'https://example.com/mcp',
          schema: 'https://ucp.dev/schemas/shopping.json',
        },
      };

      const result = validateServiceWithSdk('dev.ucp.shopping', service);
      expect(result.valid).toBe(true);
    });

    it('should validate service with A2A transport', () => {
      const service = {
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/shopping',
        a2a: {
          endpoint: 'https://example.com/a2a',
        },
      };

      const result = validateServiceWithSdk('dev.ucp.shopping', service);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCapabilityWithSdk', () => {
    it('should validate a properly structured capability', () => {
      const capability = {
        name: 'dev.ucp.shopping.checkout',
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/checkout',
        schema: 'https://ucp.dev/schemas/checkout.json',
      };

      const result = validateCapabilityWithSdk(0, capability);
      expect(result.valid).toBe(true);
    });

    it('should fail for capability missing name', () => {
      const capability = {
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/checkout',
        schema: 'https://ucp.dev/schemas/checkout.json',
      };

      const result = validateCapabilityWithSdk(0, capability);
      expect(result.valid).toBe(false);
    });

    it('should validate capability with extends field', () => {
      const capability = {
        name: 'dev.ucp.shopping.fulfillment',
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/fulfillment',
        schema: 'https://ucp.dev/schemas/fulfillment.json',
        extends: 'dev.ucp.shopping.order',
      };

      const result = validateCapabilityWithSdk(0, capability);
      expect(result.valid).toBe(true);
    });

    it('should validate capability with config field', () => {
      const capability = {
        name: 'dev.ucp.shopping.checkout',
        version: '2026-01-15',
        spec: 'https://ucp.dev/specs/checkout',
        schema: 'https://ucp.dev/schemas/checkout.json',
        config: {
          supported_currencies: ['USD', 'EUR'],
          max_items: 100,
        },
      };

      const result = validateCapabilityWithSdk(0, capability);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateSigningKeysWithSdk', () => {
    it('should validate properly structured signing keys', () => {
      const signingKeys = [
        {
          kty: 'EC',
          kid: 'key-1',
          crv: 'P-256',
          x: 'test-x-coordinate',
          y: 'test-y-coordinate',
          use: 'sig',
        },
      ];

      const result = validateSigningKeysWithSdk(signingKeys);
      expect(result.valid).toBe(true);
    });

    it('should validate RSA signing keys', () => {
      const signingKeys = [
        {
          kty: 'RSA',
          kid: 'rsa-key-1',
          n: 'test-modulus',
          e: 'AQAB',
          use: 'sig',
        },
      ];

      const result = validateSigningKeysWithSdk(signingKeys);
      expect(result.valid).toBe(true);
    });

    it('should fail for signing keys missing kty', () => {
      const signingKeys = [
        {
          kid: 'key-1',
          crv: 'P-256',
          x: 'test-x',
          y: 'test-y',
        },
      ];

      const result = validateSigningKeysWithSdk(signingKeys);
      expect(result.valid).toBe(false);
    });

    it('should fail for signing keys missing kid', () => {
      const signingKeys = [
        {
          kty: 'EC',
          crv: 'P-256',
          x: 'test-x',
          y: 'test-y',
        },
      ];

      const result = validateSigningKeysWithSdk(signingKeys);
      expect(result.valid).toBe(false);
    });

    it('should validate empty signing keys array', () => {
      const result = validateSigningKeysWithSdk([]);
      expect(result.valid).toBe(true);
    });

    it('should fail for non-array signing keys', () => {
      const result = validateSigningKeysWithSdk({ keys: [] });
      expect(result.valid).toBe(false);
    });
  });

  describe('Error Path Mapping', () => {
    it('should correctly map nested paths', () => {
      const invalidProfile = {
        ucp: {
          version: '2026-01-15',
          services: {
            'dev.ucp.shopping': {
              version: 123, // Should be string
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                endpoint: 'https://example.com/api',
                schema: 'https://ucp.dev/schemas/shopping.json',
              },
            },
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/checkout',
              schema: 'https://ucp.dev/schemas/checkout.json',
            },
          ],
        },
      };

      const result = safeValidateWithSdk(invalidProfile);
      expect(result.valid).toBe(false);
      // Should have path like $.ucp.services.dev.ucp.shopping.version
      const versionIssue = result.issues.find(i => i.path.includes('version'));
      expect(versionIssue).toBeDefined();
    });

    it('should map array paths correctly', () => {
      const invalidProfile = {
        ucp: {
          version: '2026-01-15',
          services: {},
          capabilities: [
            null, // Invalid capability
          ],
        },
      };

      const result = safeValidateWithSdk(invalidProfile);
      expect(result.valid).toBe(false);
      // Should have path like $.ucp.capabilities[0]
      const capIssue = result.issues.find(i => i.path.includes('capabilities'));
      expect(capIssue).toBeDefined();
    });
  });

  describe('SDK Compliant Profile Variations', () => {
    it('should validate profile with multiple services', () => {
      const profile = {
        ucp: {
          version: '2026-01-15',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                endpoint: 'https://example.com/api/shopping',
                schema: 'https://ucp.dev/schemas/shopping.json',
              },
            },
            'com.example.custom': {
              version: '2026-01-15',
              spec: 'https://example.com/specs/custom',
              rest: {
                endpoint: 'https://example.com/api/custom',
                schema: 'https://example.com/schemas/custom.json',
              },
            },
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/checkout',
              schema: 'https://ucp.dev/schemas/checkout.json',
            },
          ],
        },
      };

      const result = validateWithSdk(profile);
      expect(result.valid).toBe(true);
    });

    it('should validate profile with multiple transports on same service', () => {
      const profile = {
        ucp: {
          version: '2026-01-15',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                endpoint: 'https://example.com/api',
                schema: 'https://ucp.dev/schemas/shopping.json',
              },
              mcp: {
                endpoint: 'https://example.com/mcp',
                schema: 'https://ucp.dev/schemas/shopping-mcp.json',
              },
            },
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/checkout',
              schema: 'https://ucp.dev/schemas/checkout.json',
            },
          ],
        },
      };

      const result = validateWithSdk(profile);
      expect(result.valid).toBe(true);
    });

    it('should validate profile with capability extension chain', () => {
      const profile = {
        ucp: {
          version: '2026-01-15',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                endpoint: 'https://example.com/api',
                schema: 'https://ucp.dev/schemas/shopping.json',
              },
            },
          },
          capabilities: [
            {
              name: 'dev.ucp.shopping.checkout',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/checkout',
              schema: 'https://ucp.dev/schemas/checkout.json',
            },
            {
              name: 'dev.ucp.shopping.order',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/order',
              schema: 'https://ucp.dev/schemas/order.json',
              extends: 'dev.ucp.shopping.checkout',
            },
            {
              name: 'dev.ucp.shopping.fulfillment',
              version: '2026-01-15',
              spec: 'https://ucp.dev/specs/fulfillment',
              schema: 'https://ucp.dev/schemas/fulfillment.json',
              extends: 'dev.ucp.shopping.order',
            },
          ],
        },
      };

      const result = validateWithSdk(profile);
      expect(result.valid).toBe(true);
    });
  });
});
