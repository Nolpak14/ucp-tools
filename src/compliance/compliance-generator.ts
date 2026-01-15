/**
 * GDPR/Privacy Compliance Generator
 * Generates privacy policy addendums and consent language for agentic commerce
 */

import type {
  ComplianceGeneratorInput,
  ComplianceGeneratorOutput,
  ComplianceDocument,
  ComplianceSection,
  DataProcessor,
  ComplianceRegion,
} from './types.js';
import {
  AI_PLATFORM_PROCESSORS,
  REGION_NAMES,
  LAWFUL_BASIS_DESCRIPTIONS,
} from './types.js';
import {
  generateAiCommerceSection,
  generateProcessorDisclosures,
  generateConsentLanguage,
  generateMarketingOptIn,
  generateDataSubjectRights,
  generateTrackingNotice,
  generateDisclaimer,
} from './templates.js';

/**
 * Generate complete compliance documentation
 */
export function generateComplianceDocuments(
  input: ComplianceGeneratorInput
): ComplianceGeneratorOutput {
  // Validate input
  validateInput(input);

  // Build list of data processors
  const processors = buildProcessorList(input);

  // Generate all sections
  const aiCommerceSection = generateAiCommerceSection(
    input.companyName,
    processors,
    input.lawfulBasis,
    input.regions
  );

  const processorDisclosures = generateProcessorDisclosures(
    processors,
    input.regions
  );

  const consentLanguage = generateConsentLanguage(
    input.companyName,
    input.lawfulBasis,
    input.includeMarketingConsent || false
  );

  const marketingOptIn = input.includeMarketingConsent
    ? generateMarketingOptIn(input.companyName)
    : undefined;

  const dataSubjectRights = generateDataSubjectRights(
    input.companyName,
    input.companyEmail || 'privacy@yourcompany.com',
    input.dpoEmail,
    input.regions
  );

  const trackingNotice = generateTrackingNotice(
    input.companyName,
    input.regions
  );

  const disclaimer = generateDisclaimer();

  // Build the full privacy addendum document
  const privacyAddendum = buildPrivacyAddendum(
    input,
    aiCommerceSection,
    processorDisclosures,
    dataSubjectRights,
    trackingNotice,
    disclaimer
  );

  // Generate embed HTML
  const embedHtml = generateEmbedHtml(
    input.companyName,
    aiCommerceSection,
    processorDisclosures,
    dataSubjectRights,
    trackingNotice,
    disclaimer
  );

  // Generate plain text
  const plainText = generatePlainText(
    input.companyName,
    aiCommerceSection,
    processorDisclosures,
    consentLanguage,
    marketingOptIn,
    dataSubjectRights,
    trackingNotice,
    disclaimer
  );

  return {
    privacyAddendum,
    snippets: {
      aiCommerceSection,
      processorDisclosures,
      consentLanguage,
      marketingOptIn,
      dataSubjectRights,
      trackingNotice,
    },
    embedHtml,
    plainText,
    generatedAt: new Date().toISOString(),
    lawfulBasis: input.lawfulBasis,
    regions: input.regions,
  };
}

/**
 * Validate generator input
 */
function validateInput(input: ComplianceGeneratorInput): void {
  if (!input.companyName || input.companyName.trim() === '') {
    throw new Error('Company name is required');
  }

  if (!input.regions || input.regions.length === 0) {
    throw new Error('At least one region must be selected');
  }

  if (!input.platforms || input.platforms.length === 0) {
    throw new Error('At least one AI platform must be selected');
  }

  if (!input.lawfulBasis) {
    throw new Error('Lawful basis must be specified');
  }
}

/**
 * Build the list of data processors from input
 */
function buildProcessorList(input: ComplianceGeneratorInput): DataProcessor[] {
  const processors: DataProcessor[] = [];

  // Add AI platform processors
  for (const platform of input.platforms) {
    if (platform !== 'other') {
      processors.push(AI_PLATFORM_PROCESSORS[platform]);
    }
  }

  // Add custom processors
  if (input.additionalProcessors) {
    processors.push(...input.additionalProcessors);
  }

  return processors;
}

/**
 * Build the full privacy addendum document
 */
function buildPrivacyAddendum(
  input: ComplianceGeneratorInput,
  aiCommerceSection: string,
  processorDisclosures: string,
  dataSubjectRights: string,
  trackingNotice: string,
  disclaimer: string
): ComplianceDocument {
  const sections: ComplianceSection[] = [
    {
      id: 'ai-commerce',
      title: 'AI-Powered Shopping and Agentic Commerce',
      content: aiCommerceSection,
      required: true,
      applicableRegions: ['eu', 'uk', 'california', 'global'],
    },
    {
      id: 'processors',
      title: 'Third-Party Data Processors',
      content: processorDisclosures,
      required: true,
      applicableRegions: ['eu', 'uk', 'california', 'global'],
    },
    {
      id: 'rights',
      title: 'Your Data Rights',
      content: dataSubjectRights,
      required: true,
      applicableRegions: ['eu', 'uk', 'california', 'global'],
    },
    {
      id: 'tracking',
      title: 'Tracking and Cookies',
      content: trackingNotice,
      required: false,
      applicableRegions: ['eu', 'uk', 'global'],
    },
  ];

  // Add data retention section if requested
  if (input.includeDataRetention) {
    const retentionYears = input.retentionPeriodYears || 7;
    sections.push({
      id: 'retention',
      title: 'Data Retention',
      content: generateDataRetentionSection(input.companyName, retentionYears, input.regions),
      required: false,
      applicableRegions: ['eu', 'uk', 'california', 'global'],
    });
  }

  return {
    title: `Privacy Policy Addendum: AI Commerce - ${input.companyName}`,
    sections,
    disclaimer,
    generatedAt: new Date().toISOString(),
    regions: input.regions,
  };
}

/**
 * Generate data retention section
 */
function generateDataRetentionSection(
  companyName: string,
  retentionYears: number,
  regions: ComplianceRegion[]
): string {
  let section = `## Data Retention for AI Commerce Transactions

${companyName} retains personal data from AI agent transactions for the following periods:

| Data Category | Retention Period | Purpose |
|--------------|------------------|---------|
| Order Information | ${retentionYears} years | Legal/tax compliance, warranty claims |
| Transaction Records | ${retentionYears} years | Financial records, dispute resolution |
| Delivery Information | 2 years | Customer service, delivery issues |
| Communication Records | 3 years | Customer support, quality assurance |
| Payment Confirmations | ${retentionYears} years | Financial audit requirements |

### Retention Principles

- Data is retained only as long as necessary for the stated purposes
- We regularly review and delete data that is no longer needed
- You may request earlier deletion, subject to legal retention requirements
`;

  if (regions.includes('eu') || regions.includes('uk')) {
    section += `
### GDPR Storage Limitation

In accordance with Article 5(1)(e) of the GDPR, we do not keep personal data for longer than necessary. Retention periods are based on:
- Contractual obligations
- Legal requirements (tax, accounting)
- Legitimate business needs
- Applicable limitation periods for legal claims
`;
  }

  return section;
}

/**
 * Generate embeddable HTML
 */
function generateEmbedHtml(
  companyName: string,
  aiCommerceSection: string,
  processorDisclosures: string,
  dataSubjectRights: string,
  trackingNotice: string,
  disclaimer: string
): string {
  // Convert markdown to simple HTML
  const convertMarkdown = (md: string): string => {
    return md
      // Headers
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      // Tables (basic)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      })
      // Links
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  };

  return `<!-- AI Commerce Privacy Policy Addendum - Generated by UCP.tools -->
<div class="ucp-privacy-addendum">
  <style>
    .ucp-privacy-addendum {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
    }
    .ucp-privacy-addendum h2 { font-size: 1.5em; margin-top: 2em; border-bottom: 2px solid #2E86AB; padding-bottom: 0.5em; }
    .ucp-privacy-addendum h3 { font-size: 1.2em; margin-top: 1.5em; color: #2E86AB; }
    .ucp-privacy-addendum h4 { font-size: 1em; margin-top: 1em; }
    .ucp-privacy-addendum table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    .ucp-privacy-addendum th, .ucp-privacy-addendum td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .ucp-privacy-addendum th { background: #f5f5f5; }
    .ucp-privacy-addendum blockquote { border-left: 4px solid #2E86AB; margin: 1em 0; padding: 0.5em 1em; background: #f9f9f9; }
    .ucp-privacy-addendum .disclaimer { margin-top: 2em; padding: 1em; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 0.9em; }
  </style>

  <h2>Privacy Policy Addendum: AI Commerce</h2>
  <p><em>Effective Date: ${new Date().toLocaleDateString()}</em></p>
  <p>This addendum describes how ${companyName} handles personal data when you make purchases through AI shopping agents.</p>

  <div class="section">
    ${convertMarkdown(aiCommerceSection)}
  </div>

  <div class="section">
    ${convertMarkdown(processorDisclosures)}
  </div>

  <div class="section">
    ${convertMarkdown(dataSubjectRights)}
  </div>

  <div class="section">
    ${convertMarkdown(trackingNotice)}
  </div>

  <div class="disclaimer">
    ${convertMarkdown(disclaimer)}
  </div>
</div>
<!-- End AI Commerce Privacy Policy Addendum -->`;
}

/**
 * Generate plain text version
 */
function generatePlainText(
  companyName: string,
  aiCommerceSection: string,
  processorDisclosures: string,
  consentLanguage: string,
  marketingOptIn: string | undefined,
  dataSubjectRights: string,
  trackingNotice: string,
  disclaimer: string
): string {
  const divider = '='.repeat(60);

  let text = `${divider}
PRIVACY POLICY ADDENDUM: AI COMMERCE
${companyName}
Generated: ${new Date().toISOString()}
${divider}

${aiCommerceSection}

${divider}

${processorDisclosures}

${divider}

${consentLanguage}
`;

  if (marketingOptIn) {
    text += `
${divider}

${marketingOptIn}
`;
  }

  text += `
${divider}

${dataSubjectRights}

${divider}

${trackingNotice}

${divider}

${disclaimer}
`;

  return text;
}

/**
 * Get available regions with descriptions
 */
export function getAvailableRegions(): Array<{ id: ComplianceRegion; name: string }> {
  return Object.entries(REGION_NAMES).map(([id, name]) => ({
    id: id as ComplianceRegion,
    name,
  }));
}

/**
 * Get lawful basis options with descriptions
 */
export function getLawfulBasisOptions(): Array<{
  id: string;
  title: string;
  description: string;
  gdprArticle: string;
}> {
  return Object.entries(LAWFUL_BASIS_DESCRIPTIONS).map(([id, info]) => ({
    id,
    ...info,
  }));
}

/**
 * Get AI platform options
 */
export function getAiPlatformOptions(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    { id: 'openai', name: 'OpenAI (ChatGPT Shopping)', description: 'ChatGPT-powered shopping assistant' },
    { id: 'google', name: 'Google (AI Mode / Gemini)', description: 'Google AI shopping agent' },
    { id: 'microsoft', name: 'Microsoft (Copilot)', description: 'Microsoft Copilot checkout' },
    { id: 'other', name: 'Other AI Platforms', description: 'Other AI shopping agents' },
  ];
}
