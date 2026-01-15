/**
 * GDPR/Privacy Compliance Generator Types
 * Types for generating privacy policy addendums and consent language
 */

// Supported regions/jurisdictions
export type ComplianceRegion = 'eu' | 'uk' | 'california' | 'global';

// GDPR Article 6 lawful bases
export type LawfulBasis =
  | 'contract'      // Performance of a contract
  | 'consent'       // Consent
  | 'legitimate'    // Legitimate interests
  | 'legal';        // Legal obligation

// AI agent platforms
export type AgentPlatform =
  | 'openai'        // ChatGPT Shopping
  | 'google'        // Google AI Mode / Gemini
  | 'microsoft'     // Microsoft Copilot
  | 'other';

// Input options for compliance generator
export interface ComplianceGeneratorInput {
  // Company information
  companyName: string;
  companyEmail?: string;
  companyAddress?: string;
  dpoEmail?: string;            // Data Protection Officer email

  // Regions to comply with
  regions: ComplianceRegion[];

  // AI platforms being used
  platforms: AgentPlatform[];

  // Lawful basis for processing
  lawfulBasis: LawfulBasis;

  // Optional features
  includeMarketingConsent?: boolean;
  includeDataRetention?: boolean;
  retentionPeriodYears?: number;

  // Custom data processors
  additionalProcessors?: DataProcessor[];
}

// Data processor information
export interface DataProcessor {
  name: string;
  purpose: string;
  country?: string;
  privacyPolicyUrl?: string;
}

// Generated compliance document
export interface ComplianceDocument {
  title: string;
  sections: ComplianceSection[];
  disclaimer: string;
  generatedAt: string;
  regions: ComplianceRegion[];
}

// Section of a compliance document
export interface ComplianceSection {
  id: string;
  title: string;
  content: string;
  required: boolean;
  applicableRegions: ComplianceRegion[];
}

// Complete generator output
export interface ComplianceGeneratorOutput {
  // Full privacy policy addendum
  privacyAddendum: ComplianceDocument;

  // Individual snippets for easy copy/paste
  snippets: {
    // Privacy policy section for AI commerce
    aiCommerceSection: string;

    // Data processor disclosures
    processorDisclosures: string;

    // Consent language for checkout
    consentLanguage: string;

    // Marketing opt-in text
    marketingOptIn?: string;

    // Data subject rights notice
    dataSubjectRights: string;

    // Cookie/tracking notice for agent transactions
    trackingNotice: string;
  };

  // Combined HTML for embedding
  embedHtml: string;

  // Plain text version
  plainText: string;

  // Metadata
  generatedAt: string;
  lawfulBasis: LawfulBasis;
  regions: ComplianceRegion[];
}

// Predefined data processors for AI platforms
export const AI_PLATFORM_PROCESSORS: Record<AgentPlatform, DataProcessor> = {
  openai: {
    name: 'OpenAI, LLC',
    purpose: 'AI-powered shopping assistant and checkout processing',
    country: 'United States',
    privacyPolicyUrl: 'https://openai.com/privacy/',
  },
  google: {
    name: 'Google LLC',
    purpose: 'AI shopping agent (Google AI Mode, Gemini) and checkout processing',
    country: 'United States',
    privacyPolicyUrl: 'https://policies.google.com/privacy',
  },
  microsoft: {
    name: 'Microsoft Corporation',
    purpose: 'AI shopping assistant (Copilot) and checkout processing',
    country: 'United States',
    privacyPolicyUrl: 'https://privacy.microsoft.com/privacystatement',
  },
  other: {
    name: 'Third-party AI Agent Provider',
    purpose: 'AI-powered shopping and checkout assistance',
    country: 'Various',
  },
};

// Region display names
export const REGION_NAMES: Record<ComplianceRegion, string> = {
  eu: 'European Union (GDPR)',
  uk: 'United Kingdom (UK GDPR)',
  california: 'California (CCPA/CPRA)',
  global: 'Global (General Best Practices)',
};

// Lawful basis descriptions
export const LAWFUL_BASIS_DESCRIPTIONS: Record<LawfulBasis, { title: string; description: string; gdprArticle: string }> = {
  contract: {
    title: 'Performance of a Contract',
    description: 'Processing is necessary for the performance of a contract with the data subject or to take steps at their request prior to entering into a contract.',
    gdprArticle: 'Article 6(1)(b)',
  },
  consent: {
    title: 'Consent',
    description: 'The data subject has given consent to the processing of their personal data for one or more specific purposes.',
    gdprArticle: 'Article 6(1)(a)',
  },
  legitimate: {
    title: 'Legitimate Interests',
    description: 'Processing is necessary for the purposes of the legitimate interests pursued by the controller or by a third party.',
    gdprArticle: 'Article 6(1)(f)',
  },
  legal: {
    title: 'Legal Obligation',
    description: 'Processing is necessary for compliance with a legal obligation to which the controller is subject.',
    gdprArticle: 'Article 6(1)(c)',
  },
};
