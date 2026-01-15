/**
 * UCP Profile Manager
 * Generate, validate, and host UCP Business Profiles
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Generator
export {
  buildProfile,
  generateMinimalProfile,
  generateSigningKeyPair,
  validatePublicKey,
} from './generator/index.js';

// Validator
export {
  validateProfile,
  validateRemote,
  validateQuick,
  validateJsonString,
  validateStructure,
  validateRules,
  validateNetwork,
  clearSchemaCache,
} from './validator/index.js';

// Simulator
export {
  simulateAgentInteraction,
  simulateDiscoveryFlow,
  inspectCapabilities,
  inspectServices,
  simulateRestApi,
  simulateCheckoutFlow,
  simulatePaymentReadiness,
} from './simulator/index.js';

// Hosting
export { generateHostingArtifacts } from './hosting/index.js';

// Security Scanner
export {
  scanEndpointSecurity,
  SecurityCheckIds,
} from './security/index.js';
export type {
  SecurityCheck,
  SecurityScanResult,
  SecurityScanOptions,
  SecuritySeverity,
  SecurityCheckStatus,
  SecurityCheckId,
} from './security/index.js';

// Compliance Generator
export {
  generateComplianceDocuments,
  getAvailableRegions,
  getLawfulBasisOptions,
  getAiPlatformOptions,
  AI_PLATFORM_PROCESSORS,
  REGION_NAMES,
  LAWFUL_BASIS_DESCRIPTIONS,
} from './compliance/index.js';
export type {
  ComplianceRegion,
  LawfulBasis,
  AgentPlatform,
  ComplianceGeneratorInput,
  ComplianceGeneratorOutput,
  ComplianceDocument,
  ComplianceSection,
  DataProcessor,
} from './compliance/index.js';

// Feed Analyzer
export {
  analyzeProductFeed,
  analyzeProductFeedFromHtml,
  analyzeProduct,
  extractProductsFromHtml,
  validateGtin,
  QUALITY_CHECKS,
  VALID_AVAILABILITY_VALUES,
  CATEGORY_WEIGHTS,
  GRADE_THRESHOLDS,
} from './feed-analyzer/index.js';
export type {
  ProductData,
  ProductOffer,
  ProductAnalysis,
  QualityCheck,
  FeedAnalysisResult,
  FeedAnalysisInput,
  CategoryScores,
  Recommendation,
  FeedSummary,
  GtinValidation,
  IssueSeverity,
  CheckCategory,
} from './feed-analyzer/index.js';
