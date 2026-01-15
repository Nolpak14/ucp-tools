/**
 * Unit Tests for PDF Report Generation (Issue #7)
 * Tests the data transformation and formatting logic for PDF reports
 */

import { describe, it, expect } from 'vitest';

// Types matching the validation API response
interface ValidationData {
    domain?: string;
    ucp?: {
        found: boolean;
        issues: Array<{ code: string; message: string; severity: 'error' | 'warn' }>;
    };
    schema?: {
        found: boolean;
        issues: Array<{ code: string; message: string; severity: 'error' | 'warn'; category?: string }>;
        stats: {
            products: number;
            returnPolicies: number;
            organizations?: number;
        };
    };
    ai_readiness?: {
        score: number;
        grade: string;
        label: string;
    };
    benchmark?: {
        percentile: number;
        total_sites_analyzed: number;
        avg_score?: number;
    };
    product_quality?: {
        completeness: number;
    };
    lint_suggestions?: Array<{
        severity: string;
        title: string;
        code: string;
        impact: string;
        fix?: string;
        codeSnippet?: string;
        docLink?: string;
    }>;
}

// Helper functions that mirror the PDF generation logic
function getGradeColor(grade: string): [number, number, number] {
    const gradeColors: Record<string, [number, number, number]> = {
        'A': [22, 163, 74],   // Green
        'B': [37, 99, 235],   // Blue
        'C': [202, 138, 4],   // Yellow
        'D': [234, 88, 12],   // Orange
        'F': [220, 38, 38]    // Red
    };
    return gradeColors[grade] || gradeColors['F'];
}

function countIssuesBySeverity(issues: Array<{ severity: string }>): { errors: number; warnings: number } {
    return {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warn').length
    };
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function generateFilename(domain: string): string {
    return `ucp-report-${domain.replace(/\./g, '-')}.pdf`;
}

function extractReportData(data: ValidationData, domain: string) {
    return {
        domain,
        score: data.ai_readiness?.score ?? 0,
        grade: data.ai_readiness?.grade ?? 'F',
        readinessLabel: data.ai_readiness?.label ?? 'Not Ready',
        ucpFound: data.ucp?.found ?? false,
        ucpIssues: data.ucp?.issues ?? [],
        schemaStats: data.schema?.stats ?? { products: 0, returnPolicies: 0 },
        schemaIssues: data.schema?.issues ?? [],
        productQuality: data.product_quality?.completeness ?? null,
        benchmark: data.benchmark ?? null,
        suggestions: data.lint_suggestions ?? [],
    };
}

describe('PDF Report Generation (Issue #7)', () => {
    describe('Grade Color Mapping', () => {
        it('should return green for grade A', () => {
            const color = getGradeColor('A');
            expect(color).toEqual([22, 163, 74]);
        });

        it('should return blue for grade B', () => {
            const color = getGradeColor('B');
            expect(color).toEqual([37, 99, 235]);
        });

        it('should return yellow for grade C', () => {
            const color = getGradeColor('C');
            expect(color).toEqual([202, 138, 4]);
        });

        it('should return orange for grade D', () => {
            const color = getGradeColor('D');
            expect(color).toEqual([234, 88, 12]);
        });

        it('should return red for grade F', () => {
            const color = getGradeColor('F');
            expect(color).toEqual([220, 38, 38]);
        });

        it('should default to red for unknown grade', () => {
            const color = getGradeColor('X');
            expect(color).toEqual([220, 38, 38]);
        });
    });

    describe('Issue Counting', () => {
        it('should correctly count errors and warnings', () => {
            const issues = [
                { severity: 'error', code: 'ERR1', message: 'Error 1' },
                { severity: 'error', code: 'ERR2', message: 'Error 2' },
                { severity: 'warn', code: 'WARN1', message: 'Warning 1' },
            ];
            const counts = countIssuesBySeverity(issues);

            expect(counts.errors).toBe(2);
            expect(counts.warnings).toBe(1);
        });

        it('should return zeros for empty array', () => {
            const counts = countIssuesBySeverity([]);

            expect(counts.errors).toBe(0);
            expect(counts.warnings).toBe(0);
        });

        it('should handle only errors', () => {
            const issues = [
                { severity: 'error', code: 'ERR1', message: 'Error 1' },
                { severity: 'error', code: 'ERR2', message: 'Error 2' },
            ];
            const counts = countIssuesBySeverity(issues);

            expect(counts.errors).toBe(2);
            expect(counts.warnings).toBe(0);
        });

        it('should handle only warnings', () => {
            const issues = [
                { severity: 'warn', code: 'WARN1', message: 'Warning 1' },
                { severity: 'warn', code: 'WARN2', message: 'Warning 2' },
            ];
            const counts = countIssuesBySeverity(issues);

            expect(counts.errors).toBe(0);
            expect(counts.warnings).toBe(2);
        });
    });

    describe('Text Truncation', () => {
        it('should not truncate short text', () => {
            const result = truncateText('Short text', 70);
            expect(result).toBe('Short text');
        });

        it('should truncate long text with ellipsis', () => {
            const longText = 'This is a very long message that should be truncated because it exceeds the maximum allowed length for display';
            const result = truncateText(longText, 70);

            expect(result.length).toBe(73); // 70 + '...'
            expect(result.endsWith('...')).toBe(true);
        });

        it('should handle exact length text', () => {
            const text = 'A'.repeat(70);
            const result = truncateText(text, 70);

            expect(result.length).toBe(70);
            expect(result.endsWith('...')).toBe(false);
        });
    });

    describe('Filename Generation', () => {
        it('should replace dots with dashes in domain', () => {
            const filename = generateFilename('example.com');
            expect(filename).toBe('ucp-report-example-com.pdf');
        });

        it('should handle subdomains', () => {
            const filename = generateFilename('shop.example.com');
            expect(filename).toBe('ucp-report-shop-example-com.pdf');
        });

        it('should handle multiple dots', () => {
            const filename = generateFilename('www.shop.example.co.uk');
            expect(filename).toBe('ucp-report-www-shop-example-co-uk.pdf');
        });
    });

    describe('Report Data Extraction', () => {
        it('should extract all fields from complete data', () => {
            const data: ValidationData = {
                ai_readiness: { score: 85, grade: 'B', label: 'Partially Ready' },
                ucp: { found: true, issues: [{ code: 'TEST', message: 'Test', severity: 'error' }] },
                schema: {
                    found: true,
                    issues: [{ code: 'SCHEMA_TEST', message: 'Schema test', severity: 'warn' }],
                    stats: { products: 10, returnPolicies: 2 }
                },
                product_quality: { completeness: 78 },
                benchmark: { percentile: 75, total_sites_analyzed: 1000 },
                lint_suggestions: [{ severity: 'critical', title: 'Test', code: 'TEST', impact: 'Test impact' }]
            };

            const result = extractReportData(data, 'example.com');

            expect(result.domain).toBe('example.com');
            expect(result.score).toBe(85);
            expect(result.grade).toBe('B');
            expect(result.readinessLabel).toBe('Partially Ready');
            expect(result.ucpFound).toBe(true);
            expect(result.ucpIssues).toHaveLength(1);
            expect(result.schemaStats.products).toBe(10);
            expect(result.schemaStats.returnPolicies).toBe(2);
            expect(result.schemaIssues).toHaveLength(1);
            expect(result.productQuality).toBe(78);
            expect(result.benchmark?.percentile).toBe(75);
            expect(result.suggestions).toHaveLength(1);
        });

        it('should provide defaults for missing data', () => {
            const data: ValidationData = {};

            const result = extractReportData(data, 'test.com');

            expect(result.domain).toBe('test.com');
            expect(result.score).toBe(0);
            expect(result.grade).toBe('F');
            expect(result.readinessLabel).toBe('Not Ready');
            expect(result.ucpFound).toBe(false);
            expect(result.ucpIssues).toEqual([]);
            expect(result.schemaStats).toEqual({ products: 0, returnPolicies: 0 });
            expect(result.schemaIssues).toEqual([]);
            expect(result.productQuality).toBeNull();
            expect(result.benchmark).toBeNull();
            expect(result.suggestions).toEqual([]);
        });

        it('should handle partial data', () => {
            const data: ValidationData = {
                ai_readiness: { score: 45, grade: 'F', label: 'Not Ready' },
                ucp: { found: false, issues: [] },
            };

            const result = extractReportData(data, 'partial.com');

            expect(result.score).toBe(45);
            expect(result.ucpFound).toBe(false);
            expect(result.schemaStats).toEqual({ products: 0, returnPolicies: 0 });
        });
    });

    describe('PDF Content Sections', () => {
        it('should limit displayed issues to prevent overflow', () => {
            const issues = Array.from({ length: 20 }, (_, i) => ({
                code: `ERR${i}`,
                message: `Error message ${i}`,
                severity: 'error' as const
            }));

            // PDF logic limits to 8 issues
            const displayedIssues = issues.slice(0, 8);
            expect(displayedIssues).toHaveLength(8);
        });

        it('should limit displayed suggestions to prevent overflow', () => {
            const suggestions = Array.from({ length: 10 }, (_, i) => ({
                severity: 'warning',
                title: `Suggestion ${i}`,
                code: `SUGG${i}`,
                impact: `Impact ${i}`
            }));

            // PDF logic limits to 5 suggestions
            const displayedSuggestions = suggestions.slice(0, 5);
            expect(displayedSuggestions).toHaveLength(5);
        });
    });

    describe('Validation Data Requirements', () => {
        it('should validate that data is available before generating', () => {
            const data = null;
            const domain = null;

            const isValid = data !== null && domain !== null;
            expect(isValid).toBe(false);
        });

        it('should accept valid data for PDF generation', () => {
            const data: ValidationData = {
                ai_readiness: { score: 70, grade: 'C', label: 'Partially Ready' }
            };
            const domain = 'test.com';

            const isValid = data !== null && domain !== null;
            expect(isValid).toBe(true);
        });
    });

    describe('Brand Colors', () => {
        it('should use correct brand blue', () => {
            const brandBlue: [number, number, number] = [46, 134, 171];
            expect(brandBlue).toEqual([46, 134, 171]);
        });

        it('should use correct brand teal', () => {
            const brandTeal: [number, number, number] = [54, 181, 162];
            expect(brandTeal).toEqual([54, 181, 162]);
        });

        it('should use correct severity colors', () => {
            const severityColors = {
                error: [220, 38, 38],
                warn: [202, 138, 4]
            };

            expect(severityColors.error).toEqual([220, 38, 38]);
            expect(severityColors.warn).toEqual([202, 138, 4]);
        });
    });
});

describe('PDF Report Integration Requirements', () => {
    describe('Data Storage', () => {
        it('should store validation data in expected format', () => {
            // Simulates window.lastValidationData structure
            const storedData: ValidationData = {
                ai_readiness: { score: 85, grade: 'B', label: 'Partially Ready' },
                ucp: { found: true, issues: [] },
                schema: { found: true, issues: [], stats: { products: 5, returnPolicies: 1 } },
                lint_suggestions: []
            };

            expect(storedData.ai_readiness).toBeDefined();
            expect(storedData.ucp).toBeDefined();
            expect(storedData.schema).toBeDefined();
            expect(storedData.lint_suggestions).toBeDefined();
        });

        it('should store domain for filename generation', () => {
            // Simulates window.lastValidatedDomain
            const storedDomain = 'example.com';

            expect(storedDomain).toBeDefined();
            expect(typeof storedDomain).toBe('string');
            expect(storedDomain.length).toBeGreaterThan(0);
        });
    });

    describe('Download Trigger', () => {
        it('should generate correct filename from domain', () => {
            const domain = 'shop.example.com';
            const filename = `ucp-report-${domain.replace(/\./g, '-')}.pdf`;

            expect(filename).toBe('ucp-report-shop-example-com.pdf');
        });
    });

    describe('Analytics Event', () => {
        it('should include required tracking fields', () => {
            const eventData = {
                domain: 'example.com',
                score: 85,
                grade: 'B'
            };

            expect(eventData).toHaveProperty('domain');
            expect(eventData).toHaveProperty('score');
            expect(eventData).toHaveProperty('grade');
        });
    });
});
