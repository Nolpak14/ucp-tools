/**
 * GDPR/Privacy Compliance Templates
 * Template content for privacy policy addendums and consent language
 */

import type { ComplianceRegion, LawfulBasis, DataProcessor } from './types.js';
import { LAWFUL_BASIS_DESCRIPTIONS, AI_PLATFORM_PROCESSORS } from './types.js';

/**
 * Generate the AI Commerce privacy policy section
 */
export function generateAiCommerceSection(
  companyName: string,
  platforms: DataProcessor[],
  lawfulBasis: LawfulBasis,
  regions: ComplianceRegion[]
): string {
  const basisInfo = LAWFUL_BASIS_DESCRIPTIONS[lawfulBasis];
  const platformList = platforms.map(p => p.name).join(', ');

  let section = `## AI-Powered Shopping and Agentic Commerce

### How We Use AI Shopping Agents

${companyName} enables customers to browse, shop, and complete purchases through AI-powered shopping agents and assistants. These include services such as ${platformList}.

When you interact with our store through an AI shopping agent:
- The AI agent may access our product catalog, pricing, and availability information
- Your order details are processed through our Universal Commerce Protocol (UCP) integration
- Transaction data is shared with the AI platform to complete your purchase

### Legal Basis for Processing

We process your personal data in connection with AI-assisted purchases under **${basisInfo.title}** (${basisInfo.gdprArticle} GDPR).

${basisInfo.description}

### Data Collected Through AI Agents

When you make a purchase through an AI shopping agent, we may collect:
- Order information (products, quantities, prices)
- Delivery address and contact details
- Payment confirmation (we do not receive full payment card details)
- Transaction identifiers for order tracking
- Communication preferences
`;

  if (regions.includes('eu') || regions.includes('uk')) {
    section += `
### International Data Transfers

Some AI agent providers are based outside the European Economic Area (EEA) or United Kingdom. When your data is transferred to these providers, it is protected by:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- The provider's certification under applicable data protection frameworks
- Additional technical and organizational security measures
`;
  }

  if (regions.includes('california')) {
    section += `
### California Privacy Rights (CCPA/CPRA)

California residents have additional rights regarding personal information collected through AI shopping agents:
- **Right to Know**: You may request details about the personal information we collect and share
- **Right to Delete**: You may request deletion of your personal information, subject to certain exceptions
- **Right to Opt-Out**: You may opt out of the "sale" or "sharing" of personal information
- **Right to Non-Discrimination**: We will not discriminate against you for exercising your privacy rights

To exercise these rights, contact us at the email address provided below.
`;
  }

  return section;
}

/**
 * Generate data processor disclosures
 */
export function generateProcessorDisclosures(
  processors: DataProcessor[],
  regions: ComplianceRegion[]
): string {
  let disclosure = `## Third-Party Data Processors (AI Commerce)

We work with the following third-party service providers to enable AI-powered shopping:

| Provider | Purpose | Location | Privacy Policy |
|----------|---------|----------|----------------|
`;

  for (const processor of processors) {
    const privacyLink = processor.privacyPolicyUrl
      ? `[View Policy](${processor.privacyPolicyUrl})`
      : 'Contact provider';
    disclosure += `| ${processor.name} | ${processor.purpose} | ${processor.country || 'Various'} | ${privacyLink} |\n`;
  }

  disclosure += `
These processors are contractually bound to:
- Process data only on our documented instructions
- Ensure appropriate security measures are in place
- Assist us in responding to data subject requests
- Delete or return all personal data at the end of the service relationship
`;

  if (regions.includes('eu') || regions.includes('uk')) {
    disclosure += `
All processors have entered into Data Processing Agreements (DPAs) that comply with Article 28 of the GDPR.
`;
  }

  return disclosure;
}

/**
 * Generate consent language for checkout
 */
export function generateConsentLanguage(
  companyName: string,
  lawfulBasis: LawfulBasis,
  includeMarketing: boolean
): string {
  let consent = `## Consent Language for AI-Assisted Checkout

Use the following language at checkout or in order confirmations:

### Order Processing Consent

> By completing this purchase through an AI shopping assistant, you acknowledge that:
> - Your order information will be processed by ${companyName} and the AI platform provider
> - We will use your data to fulfill your order, process payment, and provide customer support
> - Your data will be handled in accordance with our Privacy Policy
`;

  if (lawfulBasis === 'consent') {
    consent += `
### Explicit Consent (for consent-based processing)

> [ ] I consent to ${companyName} processing my personal data for the purpose of completing this purchase and providing related services. I understand I can withdraw my consent at any time.
`;
  }

  if (includeMarketing) {
    consent += `
### Marketing Consent (Optional)

> [ ] I would like to receive marketing communications from ${companyName} about products, offers, and updates. I understand I can unsubscribe at any time.

**Note**: Marketing consent must be:
- Freely given (not a condition of purchase)
- Specific and informed
- Indicated by clear affirmative action (pre-ticked boxes are not valid consent)
`;
  }

  consent += `
### Agent-Originated Orders Notice

> This order was initiated through an AI shopping assistant. The AI platform may retain conversation history in accordance with their privacy policy. Your transaction data with ${companyName} is subject to our Privacy Policy.
`;

  return consent;
}

/**
 * Generate marketing opt-in text
 */
export function generateMarketingOptIn(companyName: string): string {
  return `## Marketing Opt-In for Agent-Acquired Customers

For customers acquired through AI shopping agents, use the following opt-in language:

### Email Opt-In

> [ ] Yes, I'd like to receive emails from ${companyName} about new products, exclusive offers, and updates. I can unsubscribe anytime using the link in each email.

### SMS Opt-In (if applicable)

> [ ] Yes, send me SMS updates about my orders and occasional promotions from ${companyName}. Message frequency varies. Reply STOP to unsubscribe. Message and data rates may apply.

### Post-Purchase Marketing Request

For customers who made purchases via AI agents without opting in, you may send ONE transactional follow-up:

> Thank you for your recent purchase through [AI Agent Name]! Would you like to receive updates about new products and exclusive offers from ${companyName}?
>
> [Subscribe to Updates] [No Thanks]

**Important**: Do not add customers to marketing lists without explicit consent. Agent-originated orders do not imply marketing permission.
`;
}

/**
 * Generate data subject rights notice
 */
export function generateDataSubjectRights(
  companyName: string,
  contactEmail: string,
  dpoEmail: string | undefined,
  regions: ComplianceRegion[]
): string {
  let rights = `## Your Data Rights (AI Commerce Transactions)

You have the following rights regarding personal data collected through AI-assisted purchases:

### Access and Portability
- Request a copy of your personal data
- Receive your data in a portable, machine-readable format

### Correction and Deletion
- Request correction of inaccurate data
- Request deletion of your data (subject to legal retention requirements)

### Objection and Restriction
- Object to processing based on legitimate interests
- Request restriction of processing in certain circumstances
`;

  if (regions.includes('eu') || regions.includes('uk')) {
    rights += `
### GDPR-Specific Rights
- **Right to be Forgotten**: Request erasure under Article 17
- **Right to Restrict Processing**: Under Article 18
- **Right to Data Portability**: Under Article 20
- **Right to Object**: Under Article 21
- **Lodge a Complaint**: With your local data protection authority
`;
  }

  if (regions.includes('california')) {
    rights += `
### CCPA/CPRA Rights
- **Right to Know**: Categories and specific pieces of personal information collected
- **Right to Delete**: Request deletion of personal information
- **Right to Correct**: Request correction of inaccurate information
- **Right to Opt-Out**: Of sale or sharing of personal information
- **Right to Limit Use**: Of sensitive personal information
`;
  }

  rights += `
### How to Exercise Your Rights

To exercise any of these rights, contact us:
- **Email**: ${contactEmail}
${dpoEmail ? `- **Data Protection Officer**: ${dpoEmail}` : ''}

We will respond to your request within:
${regions.includes('eu') || regions.includes('uk') ? '- **EU/UK**: 30 days (extendable by 60 days for complex requests)' : ''}
${regions.includes('california') ? '- **California**: 45 days (extendable by 45 days if necessary)' : ''}

### Verification

To protect your privacy, we may need to verify your identity before processing your request. For orders placed through AI agents, we may ask for:
- Order number or transaction ID
- Email address used for the order
- Delivery address associated with the order
`;

  return rights;
}

/**
 * Generate tracking/cookie notice for agent transactions
 */
export function generateTrackingNotice(
  companyName: string,
  regions: ComplianceRegion[]
): string {
  let notice = `## Tracking and Cookies for AI Agent Transactions

### How Tracking Works with AI Agents

When you make a purchase through an AI shopping agent, the traditional cookie-based tracking model does not apply because:
- You may never visit our website directly
- The transaction occurs within the AI agent's interface
- Standard cookie consent banners do not load

### What Data is Collected

For AI agent transactions, we collect data through:
- **API Calls**: Order data transmitted via Universal Commerce Protocol (UCP)
- **Transaction Logs**: Records of purchases for fulfillment and support
- **Analytics**: Aggregated, anonymized data about AI agent sales (not linked to individuals)

### Our Commitment

- We do **not** place cookies on your device through AI agent transactions
- We do **not** build behavioral profiles based solely on AI agent purchases
- We **do** collect necessary transaction data to fulfill your order
`;

  if (regions.includes('eu') || regions.includes('uk')) {
    notice += `
### ePrivacy Compliance

AI agent transactions are processed under:
- **Strictly Necessary**: Processing required to complete your requested transaction
- **Contract Performance**: Data processing necessary to deliver your order

No consent is required for strictly necessary processing of transaction data.
`;
  }

  notice += `
### AI Platform Tracking

The AI shopping agent (ChatGPT, Google AI, Copilot) may have its own data collection practices. Please review their privacy policies:
- Conversation history with the AI agent
- Usage data collected by the AI platform
- Account information you've provided to the AI service

${companyName} is not responsible for data collected directly by AI platform providers.
`;

  return notice;
}

/**
 * Generate the legal disclaimer
 */
export function generateDisclaimer(): string {
  return `---

**IMPORTANT DISCLAIMER**

This document was generated by an automated tool and is provided for informational purposes only. It does NOT constitute legal advice.

- This template should be reviewed by a qualified legal professional before use
- Privacy laws vary by jurisdiction and change frequently
- Your specific business circumstances may require additional or different provisions
- ${new Date().getFullYear()} compliance requirements may have changed since generation

We recommend consulting with a privacy lawyer or data protection specialist to ensure your privacy policy fully complies with applicable laws.

Generated by [UCP.tools](https://ucptools.dev) - AI Commerce Readiness Platform
`;
}
