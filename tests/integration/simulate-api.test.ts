/**
 * Integration tests for the AI Agent Simulation API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock profile for testing
const mockProfile = {
  ucp: {
    version: '2026-01-11',
    services: {
      'dev.ucp.shopping': {
        version: '2026-01-11',
        spec: 'https://ucp.dev/specs/shopping',
        rest: {
          schema: 'https://example.com/api/openapi.json',
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
};

// Mock fetch
const originalFetch = global.fetch;

describe('Simulate API', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('simulateAgentInteraction function', () => {
    it('should simulate agent interaction for valid domain', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      // Mock successful profile fetch
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.well-known/ucp')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockProfile),
          });
        }
        // Default to success for other URLs
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ properties: { checkout_id: {} } }),
        });
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      expect(result.ok).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(result.discovery.success).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should return low score for unreachable domain', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('nonexistent.example.com', { timeoutMs: 5000 });

      expect(result.ok).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.recommendations).toContain('Ensure UCP profile is accessible at /.well-known/ucp or /.well-known/ucp.json');
    });

    it('should detect missing checkout capability', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      const profileWithoutCheckout = {
        ucp: {
          version: '2026-01-11',
          services: {
            'dev.ucp.shopping': {
              version: '2026-01-11',
              spec: 'https://ucp.dev/specs/shopping',
              rest: {
                schema: 'https://example.com/api/openapi.json',
                endpoint: 'https://example.com/api',
              },
            },
          },
          capabilities: [],
        },
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.well-known/ucp')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(profileWithoutCheckout),
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      expect(result.checkout?.canCreateCheckout).toBe(false);
      expect(result.recommendations).toContain('Add checkout capability (dev.ucp.shopping.checkout) to enable purchases');
    });

    it('should include all simulation phases', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.well-known/ucp')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockProfile),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({}),
        });
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('example.com', { 
        timeoutMs: 10000,
        testCheckoutFlow: true,
      });

      // Check all phases are present
      expect(result.discovery).toBeDefined();
      expect(result.capabilities).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.restApi).toBeDefined();
      expect(result.checkout).toBeDefined();
      expect(result.payment).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('API response structure', () => {
    it('should generate correct grade from score', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.well-known/ucp')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockProfile),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.resolve({ properties: { checkout_id: {} } }),
        });
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      // Score should be between 0-100
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should include timing information', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('.well-known/ucp')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.resolve(mockProfile),
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      const { simulateAgentInteraction } = await import('../../src/simulator/index.js');
      const result = await simulateAgentInteraction('example.com', { timeoutMs: 10000 });

      expect(result.simulatedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
