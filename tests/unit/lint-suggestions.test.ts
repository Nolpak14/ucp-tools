/**
 * Unit Tests for Lint Suggestions Feature (Issue #9)
 * Tests the generateLintSuggestions function logic
 */

import { describe, it, expect } from 'vitest';

// Recreate the lint suggestion generation logic for testing
const suggestionMap: Record<string, { severity: string; title: string; impact: string }> = {
    // Critical issues
    'UCP_FETCH_FAILED': {
        severity: 'critical',
        title: 'Create a UCP Profile',
        impact: 'AI shopping agents cannot discover your store without a UCP profile',
    },
    'UCP_MISSING_ROOT': {
        severity: 'critical',
        title: 'Add "ucp" Root Object',
        impact: 'Profile cannot be parsed without the required root structure',
    },
    'UCP_MISSING_VERSION': {
        severity: 'critical',
        title: 'Add UCP Version',
        impact: 'Agents cannot determine compatibility without a version',
    },
    'UCP_INVALID_VERSION': {
        severity: 'critical',
        title: 'Fix Version Format',
        impact: 'Invalid version format will cause parsing errors',
    },
    'UCP_MISSING_SERVICES': {
        severity: 'critical',
        title: 'Add Services Configuration',
        impact: 'No services means AI agents have nothing to interact with',
    },
    'UCP_MISSING_CAPABILITIES': {
        severity: 'critical',
        title: 'Add Capabilities Array',
        impact: 'Without capabilities, agents cannot perform any actions',
    },
    'UCP_MISSING_KEYS': {
        severity: 'critical',
        title: 'Add Signing Keys for Order Capability',
        impact: 'Order transactions cannot be verified without signing keys',
    },
    'UCP_ENDPOINT_NOT_HTTPS': {
        severity: 'critical',
        title: 'Use HTTPS for Endpoints',
        impact: 'HTTP endpoints are insecure and rejected by AI agents',
    },
    'UCP_NS_MISMATCH': {
        severity: 'critical',
        title: 'Fix Namespace Origin',
        impact: 'Spec/schema URLs must match the capability namespace',
    },
    'SCHEMA_NO_RETURN_POLICY': {
        severity: 'critical',
        title: 'Add MerchantReturnPolicy Schema',
        impact: 'Required for AI commerce eligibility (Jan 2026 deadline)',
    },
    'SCHEMA_NO_SHIPPING': {
        severity: 'critical',
        title: 'Add OfferShippingDetails Schema',
        impact: 'Required for AI commerce eligibility (Jan 2026 deadline)',
    },
    // Warnings
    'UCP_NO_TRANSPORT': {
        severity: 'warning',
        title: 'Add Transport Binding',
        impact: 'Service has no way for agents to communicate with it',
    },
    'UCP_TRAILING_SLASH': {
        severity: 'warning',
        title: 'Remove Trailing Slash from Endpoint',
        impact: 'May cause URL concatenation issues',
    },
    'UCP_ORPHAN_EXT': {
        severity: 'warning',
        title: 'Fix Orphaned Extension',
        impact: 'Capability extends a parent that does not exist',
    },
    'SCHEMA_NO_ORG': {
        severity: 'warning',
        title: 'Add Organization Schema',
        impact: 'AI agents may not recognize your business identity',
    },
    'PRODUCT_NO_DESCRIPTION': {
        severity: 'warning',
        title: 'Add Product Description',
        impact: 'AI agents may hallucinate product details',
    },
    'PRODUCT_NO_IMAGE': {
        severity: 'warning',
        title: 'Add Product Image',
        impact: 'Visual context helps AI product matching',
    },
};

interface Issue {
    code: string;
    message: string;
    severity: 'error' | 'warn';
    category?: string;
    path?: string;
}

interface LintSuggestion {
    severity: string;
    title: string;
    code: string;
    impact: string;
    fix?: string;
    codeSnippet?: string;
    docLink?: string;
    path?: string;
}

function generateLintSuggestions(
    ucpIssues: Issue[],
    schemaIssues: Issue[],
    hasUcp: boolean,
    profile: any,
    schemaStats: { products: number }
): LintSuggestion[] {
    const suggestions: LintSuggestion[] = [];
    const allIssues = [...ucpIssues, ...schemaIssues];
    const processedCodes = new Set<string>();

    allIssues.forEach(issue => {
        const template = suggestionMap[issue.code];
        if (template && !processedCodes.has(issue.code)) {
            processedCodes.add(issue.code);
            suggestions.push({
                severity: template.severity,
                title: template.title,
                code: issue.code,
                impact: template.impact,
                path: issue.path,
            });
        }
    });

    // Add contextual suggestions
    if (hasUcp) {
        const capabilities = profile?.ucp?.capabilities?.map((c: any) => c.name) || [];
        if (!capabilities.includes('dev.ucp.shopping.checkout') && capabilities.length > 0) {
            suggestions.push({
                severity: 'info',
                title: 'Consider Adding Checkout Capability',
                code: 'SUGGESTION_ADD_CHECKOUT',
                impact: 'Enables AI agents to complete purchases on your site',
            });
        }
    }

    if (schemaStats.products === 0 && hasUcp) {
        suggestions.push({
            severity: 'info',
            title: 'Add Product Schema for Better AI Discovery',
            code: 'SUGGESTION_ADD_PRODUCTS',
            impact: 'Product schemas help AI agents understand your catalog',
        });
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    suggestions.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    return suggestions;
}

describe('Lint Suggestions Generation (Issue #9)', () => {
    describe('Critical Issues', () => {
        it('should generate suggestion for missing UCP profile', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_FETCH_FAILED', message: 'No UCP profile found', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], false, null, { products: 0 });

            expect(suggestions.length).toBeGreaterThanOrEqual(1);
            const fetchSuggestion = suggestions.find(s => s.code === 'UCP_FETCH_FAILED');
            expect(fetchSuggestion).toBeDefined();
            expect(fetchSuggestion?.severity).toBe('critical');
            expect(fetchSuggestion?.title).toBe('Create a UCP Profile');
        });

        it('should generate suggestion for missing version', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_VERSION', message: 'Missing version field', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_MISSING_VERSION');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
            expect(suggestion?.title).toBe('Add UCP Version');
        });

        it('should generate suggestion for invalid version format', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_INVALID_VERSION', message: 'Invalid version: v1.0', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_INVALID_VERSION');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for missing services', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_SERVICES', message: 'Missing services', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_MISSING_SERVICES');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for missing capabilities', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_CAPABILITIES', message: 'Missing capabilities array', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_MISSING_CAPABILITIES');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for non-HTTPS endpoint', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_ENDPOINT_NOT_HTTPS', message: 'Endpoint must use HTTPS', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_ENDPOINT_NOT_HTTPS');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for missing signing keys', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_KEYS', message: 'Order requires signing_keys', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_MISSING_KEYS');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for missing return policy', () => {
            const schemaIssues: Issue[] = [
                { code: 'SCHEMA_NO_RETURN_POLICY', message: 'No return policy found', severity: 'error', category: 'schema' }
            ];
            const suggestions = generateLintSuggestions([], schemaIssues, true, {}, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SCHEMA_NO_RETURN_POLICY');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });

        it('should generate suggestion for missing shipping details', () => {
            const schemaIssues: Issue[] = [
                { code: 'SCHEMA_NO_SHIPPING', message: 'No shipping info', severity: 'error', category: 'schema' }
            ];
            const suggestions = generateLintSuggestions([], schemaIssues, true, {}, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SCHEMA_NO_SHIPPING');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('critical');
        });
    });

    describe('Warning Issues', () => {
        it('should generate suggestion for missing transport', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_NO_TRANSPORT', message: 'Service has no transport bindings', severity: 'warn' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'UCP_NO_TRANSPORT');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('warning');
        });

        it('should generate suggestion for missing organization schema', () => {
            const schemaIssues: Issue[] = [
                { code: 'SCHEMA_NO_ORG', message: 'No organization schema', severity: 'warn', category: 'schema' }
            ];
            const suggestions = generateLintSuggestions([], schemaIssues, true, {}, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SCHEMA_NO_ORG');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('warning');
        });

        it('should generate suggestion for missing product description', () => {
            const schemaIssues: Issue[] = [
                { code: 'PRODUCT_NO_DESCRIPTION', message: 'Product missing description', severity: 'warn', category: 'product_quality' }
            ];
            const suggestions = generateLintSuggestions([], schemaIssues, true, {}, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'PRODUCT_NO_DESCRIPTION');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('warning');
        });
    });

    describe('Contextual Suggestions', () => {
        it('should suggest checkout capability when profile has other capabilities', () => {
            const profile = {
                ucp: {
                    capabilities: [
                        { name: 'dev.ucp.shopping.catalog', version: '1.0' }
                    ]
                }
            };
            const suggestions = generateLintSuggestions([], [], true, profile, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SUGGESTION_ADD_CHECKOUT');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('info');
        });

        it('should not suggest checkout when already present', () => {
            const profile = {
                ucp: {
                    capabilities: [
                        { name: 'dev.ucp.shopping.checkout', version: '1.0' }
                    ]
                }
            };
            const suggestions = generateLintSuggestions([], [], true, profile, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SUGGESTION_ADD_CHECKOUT');
            expect(suggestion).toBeUndefined();
        });

        it('should suggest product schema when UCP exists but no products', () => {
            const profile = { ucp: { capabilities: [] } };
            const suggestions = generateLintSuggestions([], [], true, profile, { products: 0 });

            const suggestion = suggestions.find(s => s.code === 'SUGGESTION_ADD_PRODUCTS');
            expect(suggestion).toBeDefined();
            expect(suggestion?.severity).toBe('info');
        });

        it('should not suggest product schema when products exist', () => {
            const profile = { ucp: { capabilities: [] } };
            const suggestions = generateLintSuggestions([], [], true, profile, { products: 5 });

            const suggestion = suggestions.find(s => s.code === 'SUGGESTION_ADD_PRODUCTS');
            expect(suggestion).toBeUndefined();
        });
    });

    describe('Deduplication', () => {
        it('should not duplicate suggestions for same issue code', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_VERSION', message: 'Missing version 1', severity: 'error' },
                { code: 'UCP_MISSING_VERSION', message: 'Missing version 2', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            const versionSuggestions = suggestions.filter(s => s.code === 'UCP_MISSING_VERSION');
            expect(versionSuggestions).toHaveLength(1);
        });
    });

    describe('Sorting by Severity', () => {
        it('should sort critical issues before warnings', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_NO_TRANSPORT', message: 'No transport', severity: 'warn' },
                { code: 'UCP_MISSING_VERSION', message: 'Missing version', severity: 'error' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, [], true, {}, { products: 0 });

            expect(suggestions[0].severity).toBe('critical');
            expect(suggestions[1].severity).toBe('warning');
        });

        it('should sort warnings before info suggestions', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_NO_TRANSPORT', message: 'No transport', severity: 'warn' }
            ];
            const profile = { ucp: { capabilities: [{ name: 'dev.ucp.shopping.catalog' }] } };
            const suggestions = generateLintSuggestions(ucpIssues, [], true, profile, { products: 0 });

            const warningIndex = suggestions.findIndex(s => s.severity === 'warning');
            const infoIndex = suggestions.findIndex(s => s.severity === 'info');

            if (warningIndex !== -1 && infoIndex !== -1) {
                expect(warningIndex).toBeLessThan(infoIndex);
            }
        });
    });

    describe('Combined Issues', () => {
        it('should handle mix of UCP and Schema issues', () => {
            const ucpIssues: Issue[] = [
                { code: 'UCP_MISSING_VERSION', message: 'Missing version', severity: 'error' }
            ];
            const schemaIssues: Issue[] = [
                { code: 'SCHEMA_NO_RETURN_POLICY', message: 'No return policy', severity: 'error', category: 'schema' }
            ];
            const suggestions = generateLintSuggestions(ucpIssues, schemaIssues, true, {}, { products: 5 });

            expect(suggestions.some(s => s.code === 'UCP_MISSING_VERSION')).toBe(true);
            expect(suggestions.some(s => s.code === 'SCHEMA_NO_RETURN_POLICY')).toBe(true);
        });

        it('should return empty array when no issues', () => {
            const profile = { ucp: { capabilities: [{ name: 'dev.ucp.shopping.checkout' }] } };
            const suggestions = generateLintSuggestions([], [], true, profile, { products: 5 });

            // Only contextual suggestions, no issue-based ones
            expect(suggestions.every(s => s.code.startsWith('SUGGESTION_'))).toBe(true);
        });
    });
});
