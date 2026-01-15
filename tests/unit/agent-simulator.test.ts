/**
 * Tests for AI Agent Simulator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  simulateDiscoveryFlow,
  inspectCapabilities,
  inspectServices,
  simulateRestApi,
  simulateCheckoutFlow,
  simulatePaymentReadiness,
  simulateAgentInteraction,
  calculateScore,
  generateRecommendations,
} from '../../src/simulator/agent-simulator.js';
import type { UcpProfile } from '../../src/types/ucp-profile.js';
import type { DiscoveryFlowResult, CapabilityInspectionResult, ServiceInspectionResult } from '../../src/simulator/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample UCP profile for testing
const sampleProfile: UcpProfile = {
  ucp: {
    version: '2026-01-11',
    services: {
      'dev.ucp.shopping': {
        version: '2026-01-11',
        spec: 'https://ucp.dev/specs/shopping',
        rest: {
          schema: 'https://ucp.dev/services/shopping/openapi.json',
          endpoint: 'https://example.com/api',
        },
      },
    },
    capabilities: [
      {
        name: 'dev.ucp.shopping.checkout',
        version: '2026-01-11',
        spec: 'https://ucp.dev/specs/shopping/checkout',
        schema: 'https://ucp.dev/schemas/shopping/checkout.json',
      },
      {
        name: 'dev.ucp.shopping.order',
        version: '2026-01-11',
        spec: 'https://ucp.dev/specs/shopping/order',
        schema: 'https://ucp.dev/schemas/shopping/order.json',
        extends: 'dev.ucp.shopping.checkout',
      },
    ],
  },
  signing_keys: [
    {
      kty: 'EC',
      crv: 'P-256',
      x: 'test-x',
      y: 'test-y',
      kid: 'key-1',
    },
  ],
  payment: {
    handlers: [
      {
        id: 'stripe',
        name: 'com.stripe.checkout',
        version: '2026-01-11',
        spec: 'https://stripe.com/docs/ucp',
      },
    ],
  },
};

// Minimal profile without optional features
const minimalProfile: UcpProfile = {
  ucp: {
    version: '2026-01-11',
    services: {
      'dev.ucp.shopping': {
        version: '2026-01-11',
        spec: 'https://ucp.dev/specs/shopping',
        rest: {
          schema: 'https://example.com/api/schema.json',
          endpoint: 'https://example.com/api',
        },
      },
    },
    capabilities: [],
  },
};

describe('Agent Simulator', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('simulateDiscoveryFlow', () => {
    it('should successfully discover a UCP profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => sampleProfile,
      });

      const result = await simulateDiscoveryFlow('example.com', 5000);

      expect(result.success).toBe(true);
      expect(result.profileUrl).toBe('https://example.com/.well-known/ucp');
      expect(result.services).toContain('dev.ucp.shopping');
      expect(result.capabilities).toContain('dev.ucp.shopping.checkout');
      expect(result.transports).toContain('rest');
    });

    it('should try .well-known/ucp.json if .well-known/ucp fails', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => sampleProfile,
      });

      const result = await simulateDiscoveryFlow('example.com', 5000);

      expect(result.success).toBe(true);
      expect(result.profileUrl).toBe('https://example.com/.well-known/ucp.json');
    });

    it('should fail if no UCP profile found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await simulateDiscoveryFlow('example.com', 5000);

      expect(result.success).toBe(false);
      expect(result.steps.some(s => s.status === 'failed')).toBe(true);
    });

    it('should detect available transports', async () => {
      const profileWithMultipleTransports = {
        ...sampleProfile,
        ucp: {
          ...sampleProfile.ucp,
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                schema: 'https://example.com/openapi.json',
                endpoint: 'https://example.com/api',
              },
              mcp: {
                schema: 'https://example.com/mcp.json',
                endpoint: 'https://example.com/mcp',
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => profileWithMultipleTransports,
      });

      const result = await simulateDiscoveryFlow('example.com', 5000);

      expect(result.transports).toContain('rest');
      expect(result.transports).toContain('mcp');
    });

    it('should handle network timeout gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 100);
        });
      });

      const result = await simulateDiscoveryFlow('example.com', 50);

      expect(result.success).toBe(false);
    });
  });

  describe('inspectCapabilities', () => {
    it('should inspect capabilities and check schema accessibility', async () => {
      // Schema fetch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ type: 'object' }),
      });
      // Spec fetch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      // Second capability schema
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ type: 'object' }),
      });
      // Second capability spec
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await inspectCapabilities(sampleProfile, 5000);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('dev.ucp.shopping.checkout');
      expect(result[0].schemaAccessible).toBe(true);
      expect(result[1].isExtension).toBe(true);
      expect(result[1].parentCapability).toBe('dev.ucp.shopping.checkout');
    });

    it('should handle inaccessible schemas', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await inspectCapabilities(sampleProfile, 5000);

      expect(result[0].schemaAccessible).toBe(false);
    });
  });

  describe('inspectServices', () => {
    it('should inspect REST service transport', async () => {
      // Schema check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ openapi: '3.0.0' }),
      });
      // Endpoint check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await inspectServices(sampleProfile, 5000);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('dev.ucp.shopping');
      expect(result[0].transports.rest?.schemaAccessible).toBe(true);
      expect(result[0].transports.rest?.endpointResponsive).toBe(true);
    });

    it('should detect unresponsive endpoints', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await inspectServices(sampleProfile, 5000);

      expect(result[0].transports.rest?.endpointResponsive).toBe(false);
    });
  });

  describe('simulateRestApi', () => {
    it('should load and analyze OpenAPI schema', async () => {
      const openApiSchema = {
        openapi: '3.0.0',
        paths: {
          '/checkout': { post: {} },
          '/orders': { get: {} },
        },
      };

      // Schema fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => openApiSchema,
      });
      // Endpoint check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await simulateRestApi(sampleProfile, 5000);

      expect(result.success).toBe(true);
      expect(result.schemaLoaded).toBe(true);
      expect(result.endpointAccessible).toBe(true);
      expect(result.steps.some(s => s.message.includes('2 operation path'))).toBe(true);
    });

    it('should skip if no REST service configured', async () => {
      const noRestProfile: UcpProfile = {
        ucp: {
          version: '2026-01-11',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping',
              mcp: {
                schema: 'https://example.com/mcp.json',
                endpoint: 'https://example.com/mcp',
              },
            },
          },
          capabilities: [],
        },
      };

      const result = await simulateRestApi(noRestProfile, 5000);

      expect(result.success).toBe(false);
      expect(result.steps[0].status).toBe('skipped');
    });
  });

  describe('simulateCheckoutFlow', () => {
    it('should detect checkout capability', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ properties: { checkout_id: {} } }),
      });

      const result = await simulateCheckoutFlow(sampleProfile, 5000);

      expect(result.canCreateCheckout).toBe(true);
      expect(result.checkoutSchemaValid).toBe(true);
    });

    it('should detect order and fulfillment capabilities', async () => {
      const fullProfile: UcpProfile = {
        ucp: {
          version: '2026-01-11',
          services: {},
          capabilities: [
            { name: 'dev.ucp.shopping.checkout', version: '2026-01-11', spec: '', schema: '' },
            { name: 'dev.ucp.shopping.order', version: '2026-01-11', spec: '', schema: '' },
            { name: 'dev.ucp.shopping.fulfillment', version: '2026-01-11', spec: '', schema: '' },
          ],
        },
      };

      // Skip schema checks
      mockFetch.mockResolvedValue({ ok: false });

      const result = await simulateCheckoutFlow(fullProfile, 5000);

      expect(result.canCreateCheckout).toBe(true);
      expect(result.orderFlowSupported).toBe(true);
      expect(result.fulfillmentSupported).toBe(true);
    });

    it('should fail if no checkout capability', async () => {
      const result = await simulateCheckoutFlow(minimalProfile, 5000);

      expect(result.canCreateCheckout).toBe(false);
      expect(result.steps.some(s => s.status === 'failed')).toBe(true);
    });
  });

  describe('simulatePaymentReadiness', () => {
    it('should detect payment handlers', async () => {
      const result = await simulatePaymentReadiness(sampleProfile, 5000);

      expect(result.handlersFound).toBe(1);
      expect(result.steps.some(s => s.message.includes('payment handler'))).toBe(true);
    });

    it('should validate signing keys', async () => {
      const result = await simulatePaymentReadiness(sampleProfile, 5000);

      expect(result.webhookVerifiable).toBe(true);
      expect(result.signingKeyValid).toBe(true);
    });

    it('should detect missing payment config', async () => {
      const result = await simulatePaymentReadiness(minimalProfile, 5000);

      expect(result.handlersFound).toBe(0);
      expect(result.webhookVerifiable).toBe(false);
    });
  });

  describe('calculateScore', () => {
    it('should give high score for complete profile', () => {
      const discovery: DiscoveryFlowResult = {
        success: true,
        steps: [],
        capabilities: ['dev.ucp.shopping.checkout'],
        services: ['dev.ucp.shopping'],
        transports: ['rest'],
      };

      const capabilities: CapabilityInspectionResult[] = [
        { name: 'dev.ucp.shopping.checkout', version: '2026-01-11', schemaAccessible: true, specAccessible: true, isExtension: false },
      ];

      const services: ServiceInspectionResult[] = [
        { name: 'dev.ucp.shopping', version: '2026-01-11', transports: { rest: { endpoint: '', schemaAccessible: true, endpointResponsive: true } } },
      ];

      const checkout = { success: true, steps: [], canCreateCheckout: true, checkoutSchemaValid: true, orderFlowSupported: true, fulfillmentSupported: false };
      const payment = { success: true, steps: [], handlersFound: 1, webhookVerifiable: true, signingKeyValid: true };

      const score = calculateScore(discovery, capabilities, services, undefined, checkout, payment);

      expect(score).toBeGreaterThanOrEqual(70);
    });

    it('should give low score for failed discovery', () => {
      const discovery: DiscoveryFlowResult = {
        success: false,
        steps: [],
        capabilities: [],
        services: [],
        transports: [],
      };

      const score = calculateScore(discovery, [], [], undefined, undefined, undefined);

      expect(score).toBeLessThan(30);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend fixing discovery issues', () => {
      const discovery: DiscoveryFlowResult = {
        success: false,
        steps: [],
        capabilities: [],
        services: [],
        transports: [],
      };

      const recommendations = generateRecommendations(discovery, [], []);

      expect(recommendations.some(r => r.includes('/.well-known/ucp'))).toBe(true);
    });

    it('should recommend adding checkout capability', () => {
      const discovery: DiscoveryFlowResult = {
        success: true,
        steps: [],
        capabilities: [],
        services: ['dev.ucp.shopping'],
        transports: ['rest'],
      };

      const checkout = { success: false, steps: [], canCreateCheckout: false, checkoutSchemaValid: false, orderFlowSupported: false, fulfillmentSupported: false };

      const recommendations = generateRecommendations(discovery, [], [], undefined, checkout);

      expect(recommendations.some(r => r.includes('checkout capability'))).toBe(true);
    });

    it('should give positive message when all looks good', () => {
      const discovery: DiscoveryFlowResult = {
        success: true,
        steps: [],
        capabilities: ['dev.ucp.shopping.checkout'],
        services: ['dev.ucp.shopping'],
        transports: ['rest'],
      };

      const capabilities: CapabilityInspectionResult[] = [
        { name: 'dev.ucp.shopping.checkout', version: '2026-01-11', schemaAccessible: true, specAccessible: true, isExtension: false },
      ];

      const restApi = { success: true, steps: [], schemaLoaded: true, endpointAccessible: true, sampleOperations: [] };
      const checkout = { success: true, steps: [], canCreateCheckout: true, checkoutSchemaValid: true, orderFlowSupported: true, fulfillmentSupported: true };
      const payment = { success: true, steps: [], handlersFound: 1, webhookVerifiable: true, signingKeyValid: true };

      const recommendations = generateRecommendations(discovery, capabilities, [], restApi, checkout, payment);

      expect(recommendations.some(r => r.includes('well-configured'))).toBe(true);
    });
  });

  describe('simulateAgentInteraction (integration)', () => {
    it('should run full simulation successfully', async () => {
      // Profile fetch (discovery)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => sampleProfile,
      });
      // Profile fetch again for detailed inspection
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => sampleProfile,
      });
      // All subsequent fetches succeed
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ type: 'object', properties: { checkout_id: {} } }),
      });

      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      expect(result.ok).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.discovery.success).toBe(true);
      expect(result.summary.totalSteps).toBeGreaterThan(0);
    });

    it('should handle complete failure gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await simulateAgentInteraction('nonexistent.com', { timeoutMs: 5000 });

      expect(result.ok).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should include timing information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => sampleProfile,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({}),
      });

      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.simulatedAt).toBeTruthy();
    });
  });
});
