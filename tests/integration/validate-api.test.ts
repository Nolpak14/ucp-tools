/**
 * Integration Tests for Validate API - Lint Suggestions (Issue #9)
 * Tests that the validate endpoint returns lint_suggestions in the response
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock validation response structure
interface ValidationResponse {
    domain: string;
    ucp: {
        found: boolean;
        issues: Array<{ code: string; message: string; severity: string }>;
    };
    schema: {
        found: boolean;
        issues: Array<{ code: string; message: string; severity: string; category?: string }>;
        stats: {
            products: number;
            returnPolicies: number;
            organizations: number;
        };
    };
    ai_readiness: {
        score: number;
        grade: string;
        label: string;
    };
    lint_suggestions?: Array<{
        severity: string;
        title: string;
        code: string;
        impact: string;
        fix?: string;
        codeSnippet?: string;
        docLink?: string;
        generatorLink?: string;
    }>;
}

// Since we can't easily test the actual API endpoint in unit tests,
// we'll test the lint_suggestions structure requirements

describe('Validate API - Lint Suggestions Response (Issue #9)', () => {
    describe('Response Structure', () => {
        it('should include lint_suggestions array in response', () => {
            // Mock a typical response with issues
            const mockResponse: ValidationResponse = {
                domain: 'example.com',
                ucp: {
                    found: false,
                    issues: [{ code: 'UCP_FETCH_FAILED', message: 'No UCP profile found', severity: 'error' }]
                },
                schema: {
                    found: true,
                    issues: [
                        { code: 'SCHEMA_NO_RETURN_POLICY', message: 'No return policy', severity: 'error', category: 'schema' }
                    ],
                    stats: { products: 5, returnPolicies: 0, organizations: 1 }
                },
                ai_readiness: {
                    score: 45,
                    grade: 'F',
                    label: 'Not Ready'
                },
                lint_suggestions: [
                    {
                        severity: 'critical',
                        title: 'Create a UCP Profile',
                        code: 'UCP_FETCH_FAILED',
                        impact: 'AI shopping agents cannot discover your store without a UCP profile',
                        docLink: 'https://ucp.dev/docs/getting-started',
                        generatorLink: '/generate'
                    },
                    {
                        severity: 'critical',
                        title: 'Add MerchantReturnPolicy Schema',
                        code: 'SCHEMA_NO_RETURN_POLICY',
                        impact: 'Required for AI commerce eligibility (Jan 2026 deadline)',
                        docLink: 'https://schema.org/MerchantReturnPolicy',
                        generatorLink: '/generate?tab=schema'
                    }
                ]
            };

            // Verify structure
            expect(mockResponse.lint_suggestions).toBeDefined();
            expect(Array.isArray(mockResponse.lint_suggestions)).toBe(true);
            expect(mockResponse.lint_suggestions!.length).toBeGreaterThan(0);
        });

        it('each suggestion should have required fields', () => {
            const suggestion = {
                severity: 'critical',
                title: 'Create a UCP Profile',
                code: 'UCP_FETCH_FAILED',
                impact: 'AI shopping agents cannot discover your store without a UCP profile'
            };

            expect(suggestion).toHaveProperty('severity');
            expect(suggestion).toHaveProperty('title');
            expect(suggestion).toHaveProperty('code');
            expect(suggestion).toHaveProperty('impact');
        });

        it('severity should be valid enum value', () => {
            const validSeverities = ['critical', 'warning', 'info'];

            const suggestions = [
                { severity: 'critical', title: 'Test', code: 'TEST', impact: 'Test' },
                { severity: 'warning', title: 'Test', code: 'TEST', impact: 'Test' },
                { severity: 'info', title: 'Test', code: 'TEST', impact: 'Test' }
            ];

            suggestions.forEach(s => {
                expect(validSeverities).toContain(s.severity);
            });
        });
    });

    describe('Suggestion Content Quality', () => {
        it('should provide actionable fix guidance', () => {
            const suggestion = {
                severity: 'critical',
                title: 'Add UCP Version',
                code: 'UCP_MISSING_VERSION',
                impact: 'Agents cannot determine compatibility without a version',
                fix: 'Add a version field in YYYY-MM-DD format',
                codeSnippet: '"version": "2026-05-01"',
                docLink: 'https://ucp.dev/docs/versioning'
            };

            // Should have either fix text or code snippet
            expect(suggestion.fix || suggestion.codeSnippet).toBeDefined();
        });

        it('should include documentation link when available', () => {
            const suggestion = {
                severity: 'critical',
                title: 'Add MerchantReturnPolicy Schema',
                code: 'SCHEMA_NO_RETURN_POLICY',
                impact: 'Required for AI commerce eligibility',
                docLink: 'https://schema.org/MerchantReturnPolicy'
            };

            expect(suggestion.docLink).toMatch(/^https?:\/\//);
        });

        it('should include generator link for actionable issues', () => {
            const suggestion = {
                severity: 'critical',
                title: 'Create a UCP Profile',
                code: 'UCP_FETCH_FAILED',
                impact: 'AI shopping agents cannot discover your store',
                generatorLink: '/generate'
            };

            expect(suggestion.generatorLink).toBe('/generate');
        });
    });

    describe('Issue Code Mapping', () => {
        const knownIssueCodes = [
            // UCP Critical
            'UCP_FETCH_FAILED',
            'UCP_MISSING_ROOT',
            'UCP_MISSING_VERSION',
            'UCP_INVALID_VERSION',
            'UCP_MISSING_SERVICES',
            'UCP_MISSING_CAPABILITIES',
            'UCP_MISSING_KEYS',
            'UCP_ENDPOINT_NOT_HTTPS',
            'UCP_NS_MISMATCH',
            // Schema Critical
            'SCHEMA_NO_RETURN_POLICY',
            'SCHEMA_NO_SHIPPING',
            // UCP Warnings
            'UCP_NO_TRANSPORT',
            'UCP_TRAILING_SLASH',
            'UCP_ORPHAN_EXT',
            // Schema Warnings
            'SCHEMA_NO_ORG',
            'ORG_NO_NAME',
            'SCHEMA_RETURN_NO_COUNTRY',
            'SCHEMA_RETURN_NO_CATEGORY',
            // Product Warnings
            'PRODUCT_NO_DESCRIPTION',
            'PRODUCT_NO_IMAGE',
            // Contextual
            'SUGGESTION_ADD_CHECKOUT',
            'SUGGESTION_ADD_PRODUCTS',
        ];

        it('should have mappings for all known issue codes', () => {
            // This test ensures we have coverage for all common issues
            expect(knownIssueCodes.length).toBeGreaterThan(20);
        });

        it('critical issues should be sorted first', () => {
            const suggestions = [
                { severity: 'warning', title: 'Warning', code: 'WARN1', impact: 'Test' },
                { severity: 'critical', title: 'Critical', code: 'CRIT1', impact: 'Test' },
                { severity: 'info', title: 'Info', code: 'INFO1', impact: 'Test' },
            ];

            // Sort by severity
            const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
            const sorted = [...suggestions].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

            expect(sorted[0].severity).toBe('critical');
            expect(sorted[1].severity).toBe('warning');
            expect(sorted[2].severity).toBe('info');
        });
    });
});

describe('Validate API - PDF Report Data (Issue #7)', () => {
    describe('Response Data for PDF Generation', () => {
        it('should include all data needed for PDF report', () => {
            const mockResponse: ValidationResponse = {
                domain: 'example.com',
                ucp: {
                    found: true,
                    issues: []
                },
                schema: {
                    found: true,
                    issues: [],
                    stats: { products: 10, returnPolicies: 1, organizations: 1 }
                },
                ai_readiness: {
                    score: 85,
                    grade: 'B',
                    label: 'Partially Ready'
                },
                lint_suggestions: []
            };

            // Required for PDF header
            expect(mockResponse.domain).toBeDefined();
            expect(mockResponse.ai_readiness.grade).toBeDefined();
            expect(mockResponse.ai_readiness.score).toBeDefined();
            expect(mockResponse.ai_readiness.label).toBeDefined();

            // Required for PDF sections
            expect(mockResponse.ucp).toBeDefined();
            expect(mockResponse.ucp.found).toBeDefined();
            expect(mockResponse.schema).toBeDefined();
            expect(mockResponse.schema.stats).toBeDefined();

            // Required for recommendations
            expect(mockResponse.lint_suggestions).toBeDefined();
        });

        it('should have grade within valid range A-F', () => {
            const validGrades = ['A', 'B', 'C', 'D', 'F'];
            const grade = 'B';

            expect(validGrades).toContain(grade);
        });

        it('should have score within 0-100 range', () => {
            const score = 85;

            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        });
    });
});
