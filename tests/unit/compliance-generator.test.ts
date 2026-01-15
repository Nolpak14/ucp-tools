/**
 * Tests for GDPR/Privacy Compliance Generator
 */

import { describe, it, expect } from 'vitest';
import {
    generateComplianceDocuments,
    getAvailableRegions,
    getLawfulBasisOptions,
    getAiPlatformOptions,
    AI_PLATFORM_PROCESSORS,
    REGION_NAMES,
    LAWFUL_BASIS_DESCRIPTIONS,
} from '../../src/compliance/index.js';
import type { ComplianceGeneratorInput } from '../../src/compliance/index.js';

describe('Compliance Generator', () => {
    describe('generateComplianceDocuments', () => {
        const validInput: ComplianceGeneratorInput = {
            companyName: 'Test Company',
            companyEmail: 'privacy@test.com',
            regions: ['eu'],
            platforms: ['openai'],
            lawfulBasis: 'contract',
        };

        it('should generate complete compliance documents', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result).toBeDefined();
            expect(result.privacyAddendum).toBeDefined();
            expect(result.snippets).toBeDefined();
            expect(result.embedHtml).toBeDefined();
            expect(result.plainText).toBeDefined();
            expect(result.generatedAt).toBeDefined();
            expect(result.lawfulBasis).toBe('contract');
            expect(result.regions).toContain('eu');
        });

        it('should include company name in generated content', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.snippets.aiCommerceSection).toContain('Test Company');
            expect(result.plainText).toContain('Test Company');
            expect(result.embedHtml).toContain('Test Company');
        });

        it('should include selected AI platforms', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                platforms: ['openai', 'google'],
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.processorDisclosures).toContain('OpenAI');
            expect(result.snippets.processorDisclosures).toContain('Google');
        });

        it('should include GDPR-specific content for EU region', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.snippets.aiCommerceSection).toContain('GDPR');
            expect(result.snippets.dataSubjectRights).toContain('Article');
        });

        it('should include CCPA content for California region', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                regions: ['california'],
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.aiCommerceSection).toContain('California');
            expect(result.snippets.aiCommerceSection).toContain('CCPA');
        });

        it('should include UK GDPR content for UK region', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                regions: ['uk'],
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.aiCommerceSection).toContain('United Kingdom');
        });

        it('should include marketing consent when requested', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                includeMarketingConsent: true,
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.marketingOptIn).toBeDefined();
            expect(result.snippets.marketingOptIn).toContain('marketing');
            expect(result.snippets.consentLanguage).toContain('marketing');
        });

        it('should not include marketing consent when not requested', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                includeMarketingConsent: false,
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.marketingOptIn).toBeUndefined();
        });

        it('should include data retention section when requested', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                includeDataRetention: true,
                retentionPeriodYears: 5,
            };

            const result = generateComplianceDocuments(input);

            const retentionSection = result.privacyAddendum.sections.find(s => s.id === 'retention');
            expect(retentionSection).toBeDefined();
            expect(retentionSection?.content).toContain('5 years');
        });

        it('should use default retention period of 7 years', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                includeDataRetention: true,
            };

            const result = generateComplianceDocuments(input);

            const retentionSection = result.privacyAddendum.sections.find(s => s.id === 'retention');
            expect(retentionSection?.content).toContain('7 years');
        });

        it('should include correct lawful basis information', () => {
            const bases: Array<ComplianceGeneratorInput['lawfulBasis']> = ['contract', 'consent', 'legitimate', 'legal'];

            for (const basis of bases) {
                const input: ComplianceGeneratorInput = {
                    ...validInput,
                    lawfulBasis: basis,
                };

                const result = generateComplianceDocuments(input);
                const basisInfo = LAWFUL_BASIS_DESCRIPTIONS[basis];

                expect(result.snippets.aiCommerceSection).toContain(basisInfo.title);
                expect(result.lawfulBasis).toBe(basis);
            }
        });

        it('should include DPO email when provided', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                dpoEmail: 'dpo@test.com',
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.dataSubjectRights).toContain('dpo@test.com');
        });

        it('should include additional custom processors', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                additionalProcessors: [
                    {
                        name: 'Custom Processor Inc',
                        purpose: 'Custom processing',
                        country: 'Germany',
                    },
                ],
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.processorDisclosures).toContain('Custom Processor Inc');
            expect(result.snippets.processorDisclosures).toContain('Germany');
        });

        it('should generate valid HTML embed code', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.embedHtml).toContain('<div class="ucp-privacy-addendum">');
            expect(result.embedHtml).toContain('</div>');
            expect(result.embedHtml).toContain('<style>');
        });

        it('should include multiple regions when selected', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                regions: ['eu', 'uk', 'california'],
            };

            const result = generateComplianceDocuments(input);

            expect(result.regions).toHaveLength(3);
            expect(result.snippets.aiCommerceSection).toContain('GDPR');
            expect(result.snippets.aiCommerceSection).toContain('California');
        });

        it('should throw error for missing company name', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                companyName: '',
            };

            expect(() => generateComplianceDocuments(input)).toThrow('Company name is required');
        });

        it('should throw error for empty regions', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                regions: [],
            };

            expect(() => generateComplianceDocuments(input)).toThrow('At least one region must be selected');
        });

        it('should throw error for empty platforms', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                platforms: [],
            };

            expect(() => generateComplianceDocuments(input)).toThrow('At least one AI platform must be selected');
        });

        it('should include consent language for checkout', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.snippets.consentLanguage).toContain('checkout');
            expect(result.snippets.consentLanguage).toContain('AI shopping assistant');
        });

        it('should include tracking notice', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.snippets.trackingNotice).toBeDefined();
            expect(result.snippets.trackingNotice).toContain('cookie');
            expect(result.snippets.trackingNotice).toContain('AI agent');
        });

        it('should include disclaimer in generated documents', () => {
            const result = generateComplianceDocuments(validInput);

            expect(result.privacyAddendum.disclaimer).toContain('NOT constitute legal advice');
            expect(result.plainText).toContain('DISCLAIMER');
        });

        it('should include all required sections in privacy addendum', () => {
            const result = generateComplianceDocuments(validInput);

            const sectionIds = result.privacyAddendum.sections.map(s => s.id);
            expect(sectionIds).toContain('ai-commerce');
            expect(sectionIds).toContain('processors');
            expect(sectionIds).toContain('rights');
            expect(sectionIds).toContain('tracking');
        });

        it('should handle Microsoft Copilot platform', () => {
            const input: ComplianceGeneratorInput = {
                ...validInput,
                platforms: ['microsoft'],
            };

            const result = generateComplianceDocuments(input);

            expect(result.snippets.processorDisclosures).toContain('Microsoft');
            expect(result.snippets.processorDisclosures).toContain('Copilot');
        });
    });

    describe('getAvailableRegions', () => {
        it('should return all available regions', () => {
            const regions = getAvailableRegions();

            expect(regions).toHaveLength(4);
            expect(regions.map(r => r.id)).toContain('eu');
            expect(regions.map(r => r.id)).toContain('uk');
            expect(regions.map(r => r.id)).toContain('california');
            expect(regions.map(r => r.id)).toContain('global');
        });

        it('should include display names for regions', () => {
            const regions = getAvailableRegions();

            const euRegion = regions.find(r => r.id === 'eu');
            expect(euRegion?.name).toContain('GDPR');
        });
    });

    describe('getLawfulBasisOptions', () => {
        it('should return all lawful basis options', () => {
            const options = getLawfulBasisOptions();

            expect(options).toHaveLength(4);
            expect(options.map(o => o.id)).toContain('contract');
            expect(options.map(o => o.id)).toContain('consent');
            expect(options.map(o => o.id)).toContain('legitimate');
            expect(options.map(o => o.id)).toContain('legal');
        });

        it('should include descriptions and GDPR articles', () => {
            const options = getLawfulBasisOptions();

            const contractOption = options.find(o => o.id === 'contract');
            expect(contractOption?.title).toBeDefined();
            expect(contractOption?.description).toBeDefined();
            expect(contractOption?.gdprArticle).toContain('Article');
        });
    });

    describe('getAiPlatformOptions', () => {
        it('should return all AI platform options', () => {
            const options = getAiPlatformOptions();

            expect(options.length).toBeGreaterThanOrEqual(3);
            expect(options.map(o => o.id)).toContain('openai');
            expect(options.map(o => o.id)).toContain('google');
            expect(options.map(o => o.id)).toContain('microsoft');
        });

        it('should include platform names and descriptions', () => {
            const options = getAiPlatformOptions();

            const openaiOption = options.find(o => o.id === 'openai');
            expect(openaiOption?.name).toContain('OpenAI');
            expect(openaiOption?.description).toBeDefined();
        });
    });

    describe('AI_PLATFORM_PROCESSORS', () => {
        it('should have processor info for all main platforms', () => {
            expect(AI_PLATFORM_PROCESSORS.openai).toBeDefined();
            expect(AI_PLATFORM_PROCESSORS.google).toBeDefined();
            expect(AI_PLATFORM_PROCESSORS.microsoft).toBeDefined();
        });

        it('should include privacy policy URLs', () => {
            expect(AI_PLATFORM_PROCESSORS.openai.privacyPolicyUrl).toContain('openai.com');
            expect(AI_PLATFORM_PROCESSORS.google.privacyPolicyUrl).toContain('google.com');
            expect(AI_PLATFORM_PROCESSORS.microsoft.privacyPolicyUrl).toContain('microsoft.com');
        });
    });

    describe('REGION_NAMES', () => {
        it('should have display names for all regions', () => {
            expect(REGION_NAMES.eu).toContain('European Union');
            expect(REGION_NAMES.uk).toContain('United Kingdom');
            expect(REGION_NAMES.california).toContain('California');
            expect(REGION_NAMES.global).toContain('Global');
        });
    });

    describe('LAWFUL_BASIS_DESCRIPTIONS', () => {
        it('should have descriptions for all lawful bases', () => {
            expect(LAWFUL_BASIS_DESCRIPTIONS.contract.title).toBeDefined();
            expect(LAWFUL_BASIS_DESCRIPTIONS.consent.title).toBeDefined();
            expect(LAWFUL_BASIS_DESCRIPTIONS.legitimate.title).toBeDefined();
            expect(LAWFUL_BASIS_DESCRIPTIONS.legal.title).toBeDefined();
        });

        it('should include GDPR article references', () => {
            expect(LAWFUL_BASIS_DESCRIPTIONS.contract.gdprArticle).toContain('6(1)(b)');
            expect(LAWFUL_BASIS_DESCRIPTIONS.consent.gdprArticle).toContain('6(1)(a)');
        });
    });
});
