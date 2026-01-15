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
