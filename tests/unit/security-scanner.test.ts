/**
 * Tests for Security Posture Scanner
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanEndpointSecurity } from '../../src/security/security-scanner.js';
import { SecurityCheckIds } from '../../src/security/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Security Scanner', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('scanEndpointSecurity', () => {
        it('should return a complete security scan result', async () => {
            // Mock HTTP check (redirect to HTTPS)
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 301,
                headers: new Headers({ 'location': 'https://example.com/.well-known/ucp' }),
            });

            // Mock HTTPS endpoint check
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'strict-transport-security': 'max-age=31536000',
                    'x-content-type-options': 'nosniff',
                    'access-control-allow-origin': '*',
                }),
                text: async () => JSON.stringify({ ucp: { version: '2026-01-11' } }),
            });

            const result = await scanEndpointSecurity('example.com');

            expect(result.domain).toBe('example.com');
            expect(result.endpoint).toBe('https://example.com/.well-known/ucp');
            expect(result.scanned_at).toBeTruthy();
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            expect(result.grade).toMatch(/^[A-F]$/);
            expect(result.checks).toBeInstanceOf(Array);
            expect(result.checks.length).toBeGreaterThan(0);
            expect(result.summary).toHaveProperty('passed');
            expect(result.summary).toHaveProperty('failed');
            expect(result.summary).toHaveProperty('warnings');
            expect(result.summary).toHaveProperty('skipped');
        });

        it('should detect HTTPS enforcement via redirect', async () => {
            // HTTP redirects to HTTPS
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 301,
                headers: new Headers({ 'location': 'https://example.com/.well-known/ucp' }),
            });

            // HTTPS endpoint
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const httpsCheck = result.checks.find(c => c.id === SecurityCheckIds.HTTPS_REQUIRED);
            expect(httpsCheck).toBeDefined();
            expect(httpsCheck?.status).toBe('pass');
        });

        it('should fail HTTPS check if HTTP serves content', async () => {
            // HTTP serves content without redirect
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{}',
            });

            // HTTPS endpoint
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const httpsCheck = result.checks.find(c => c.id === SecurityCheckIds.HTTPS_REQUIRED);
            expect(httpsCheck).toBeDefined();
            expect(httpsCheck?.status).toBe('fail');
        });

        it('should detect private IP addresses', async () => {
            // HTTP check fails
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            const result = await scanEndpointSecurity('192.168.1.1');

            const privateIpCheck = result.checks.find(c => c.id === SecurityCheckIds.PRIVATE_IP);
            expect(privateIpCheck).toBeDefined();
            expect(privateIpCheck?.status).toBe('fail');
            expect(privateIpCheck?.severity).toBe('high');
        });

        it('should pass private IP check for public domains', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            const result = await scanEndpointSecurity('example.com');

            const privateIpCheck = result.checks.find(c => c.id === SecurityCheckIds.PRIVATE_IP);
            expect(privateIpCheck).toBeDefined();
            expect(privateIpCheck?.status).toBe('pass');
        });

        it('should check security headers', async () => {
            // HTTP fails
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            // HTTPS with good security headers
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'strict-transport-security': 'max-age=31536000; includeSubDomains',
                    'x-content-type-options': 'nosniff',
                    'x-frame-options': 'DENY',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const headersCheck = result.checks.find(c => c.id === SecurityCheckIds.SECURITY_HEADERS);
            expect(headersCheck).toBeDefined();
            expect(headersCheck?.status).toBe('pass');
            expect(headersCheck?.details).toContain('HSTS');
        });

        it('should warn on missing security headers', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            // HTTPS with no security headers
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const headersCheck = result.checks.find(c => c.id === SecurityCheckIds.SECURITY_HEADERS);
            expect(headersCheck).toBeDefined();
            expect(headersCheck?.status).toBe('fail');
        });

        it('should detect CORS configuration', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'access-control-allow-origin': 'https://trusted.com',
                    'access-control-allow-methods': 'GET, POST',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const corsCheck = result.checks.find(c => c.id === SecurityCheckIds.CORS_CONFIG);
            expect(corsCheck).toBeDefined();
            expect(corsCheck?.status).toBe('pass');
        });

        it('should warn on wildcard CORS', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'access-control-allow-origin': '*',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const corsCheck = result.checks.find(c => c.id === SecurityCheckIds.CORS_CONFIG);
            expect(corsCheck).toBeDefined();
            expect(corsCheck?.status).toBe('warn');
            expect(corsCheck?.details).toContain('all origins');
        });

        it('should detect rate limiting headers', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'x-ratelimit-limit': '100',
                    'x-ratelimit-remaining': '99',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const rateLimitCheck = result.checks.find(c => c.id === SecurityCheckIds.RATE_LIMITING);
            expect(rateLimitCheck).toBeDefined();
            expect(rateLimitCheck?.status).toBe('pass');
        });

        it('should warn when no rate limiting detected', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const rateLimitCheck = result.checks.find(c => c.id === SecurityCheckIds.RATE_LIMITING);
            expect(rateLimitCheck).toBeDefined();
            expect(rateLimitCheck?.status).toBe('warn');
        });

        it('should check content-type header', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json; charset=utf-8',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('example.com');

            const contentTypeCheck = result.checks.find(c => c.id === SecurityCheckIds.CONTENT_TYPE);
            expect(contentTypeCheck).toBeDefined();
            expect(contentTypeCheck?.status).toBe('pass');
        });

        it('should detect potential error disclosure', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                }),
                text: async () => JSON.stringify({
                    error: 'Error at /home/user/app/server.js:42:15',
                    stack: 'at Object.<anonymous> (/home/user/app/server.js:42:15)',
                }),
            });

            const result = await scanEndpointSecurity('example.com');

            const errorCheck = result.checks.find(c => c.id === SecurityCheckIds.ERROR_DISCLOSURE);
            expect(errorCheck).toBeDefined();
            expect(errorCheck?.status).toBe('warn');
        });

        it('should handle unreachable endpoints gracefully', async () => {
            // Both HTTP and HTTPS fail
            mockFetch.mockRejectedValue(new Error('Network error'));

            const result = await scanEndpointSecurity('unreachable.example.com');

            expect(result.domain).toBe('unreachable.example.com');
            expect(result.checks.length).toBeGreaterThan(0);
            // Should have skipped checks for unreachable endpoint
            expect(result.summary.skipped).toBeGreaterThan(0);
        });

        it('should calculate appropriate grades', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            // Good security setup
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'strict-transport-security': 'max-age=31536000',
                    'x-content-type-options': 'nosniff',
                    'access-control-allow-origin': 'https://trusted.com',
                    'x-ratelimit-limit': '100',
                }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('secure.example.com');

            expect(result.score).toBeGreaterThanOrEqual(60);
            expect(['A', 'B', 'C']).toContain(result.grade);
        });

        it('should normalize domain input', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{}',
            });

            const result = await scanEndpointSecurity('https://example.com/path/to/something');

            expect(result.domain).toBe('example.com');
            expect(result.endpoint).toBe('https://example.com/.well-known/ucp');
        });

        it('should detect localhost as private IP', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            const result = await scanEndpointSecurity('localhost');

            const privateIpCheck = result.checks.find(c => c.id === SecurityCheckIds.PRIVATE_IP);
            expect(privateIpCheck?.status).toBe('fail');
        });

        it('should detect various private IP ranges', async () => {
            const privateIps = ['10.0.0.1', '172.16.0.1', '192.168.0.1', '127.0.0.1'];

            for (const ip of privateIps) {
                mockFetch.mockReset();
                mockFetch.mockRejectedValue(new Error('connection refused'));

                const result = await scanEndpointSecurity(ip);

                const privateIpCheck = result.checks.find(c => c.id === SecurityCheckIds.PRIVATE_IP);
                expect(privateIpCheck?.status).toBe('fail');
            }
        });
    });

    describe('Score Calculation', () => {
        it('should give higher scores for passing critical checks', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            // All good headers
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({
                    'content-type': 'application/json',
                    'strict-transport-security': 'max-age=31536000',
                    'x-content-type-options': 'nosniff',
                    'x-frame-options': 'DENY',
                    'access-control-allow-origin': 'https://trusted.com',
                    'access-control-allow-methods': 'GET, POST',
                    'x-ratelimit-limit': '100',
                    'cache-control': 'no-store',
                }),
                text: async () => '{}',
            });

            const goodResult = await scanEndpointSecurity('secure.example.com');

            mockFetch.mockReset();
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            // Minimal headers
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                headers: new Headers({}),
                text: async () => '{}',
            });

            const badResult = await scanEndpointSecurity('insecure.example.com');

            expect(goodResult.score).toBeGreaterThan(badResult.score);
        });
    });
});
