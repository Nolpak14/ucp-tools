/**
 * GDPR/Privacy Compliance Generator Module
 * Generates privacy policy addendums and consent language for agentic commerce
 */

export {
  generateComplianceDocuments,
  getAvailableRegions,
  getLawfulBasisOptions,
  getAiPlatformOptions,
} from './compliance-generator.js';

export type {
  ComplianceRegion,
  LawfulBasis,
  AgentPlatform,
  ComplianceGeneratorInput,
  ComplianceGeneratorOutput,
  ComplianceDocument,
  ComplianceSection,
  DataProcessor,
} from './types.js';

export {
  AI_PLATFORM_PROCESSORS,
  REGION_NAMES,
  LAWFUL_BASIS_DESCRIPTIONS,
} from './types.js';
