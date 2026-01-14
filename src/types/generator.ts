/**
 * Generator Types for UCP Profile Generator
 */

import type { Environment, ProfileStatus } from './ucp-profile.js';

// Merchant information
export interface MerchantInfo {
  merchantId: string;
  primaryDomain: string;
  displayName?: string;
  environment?: Environment;
}

// Transport configuration inputs
export interface TransportConfig {
  rest?: {
    endpoint: string;
    schemaUrl?: string;  // Override default
  };
  mcp?: {
    endpoint: string;
    schemaUrl?: string;
  };
  a2a?: {
    agentCardUrl: string;
  };
  embedded?: {
    schemaUrl: string;
  };
}

// Capability selection (based on official UCP spec)
export interface CapabilitySelection {
  checkout: boolean;      // Default: true
  order: boolean;         // Requires signing keys
  fulfillment: boolean;   // Extension of order
  discount: boolean;      // Extension
  payment?: boolean;      // Payment capability
  buyerConsent?: boolean; // Buyer consent capability
  customCapabilities?: CustomCapability[];
}

// Custom/vendor capability
export interface CustomCapability {
  namespace: string;      // e.g., "com.myvendor"
  name: string;           // e.g., "custom-feature"
  version: string;
  specUrl: string;
  schemaUrl: string;
  extendsCapability?: string;
}

// Security configuration
export interface SecurityConfig {
  generateSigningKeys: boolean;
  signingKeyAlgorithm?: 'ES256' | 'RS256';
  uploadedPublicKey?: string;  // PEM or JWK format
}

// Complete generator input
export interface GeneratorInput {
  merchant: MerchantInfo;
  transport: TransportConfig;
  capabilities: CapabilitySelection;
  security?: SecurityConfig;
  ucpVersion?: string;    // Override default version
}

// Generator output artifacts
export interface GeneratorOutput {
  profile: object;                    // The UCP profile JSON
  profileJson: string;                // Formatted JSON string
  installInstructions: string;        // Markdown instructions
  validationReport?: object;          // Initial validation
  signingKeyPair?: {                  // If keys were generated
    publicKey: object;                // JWK public key
    privateKey: string;               // PEM private key (for merchant to store securely)
  };
}

// Hosting mode options
export type HostingMode = 'static' | 'edge-worker' | 'reverse-proxy';

// Hosting target platforms
export type HostingPlatform =
  | 'nginx'
  | 'apache'
  | 'vercel'
  | 'netlify'
  | 'cloudflare-worker'
  | 'cloudflare-pages'
  | 's3-cloudfront'
  | 'generic';

// Hosting configuration
export interface HostingConfig {
  mode: HostingMode;
  platform?: HostingPlatform;
  merchantId: string;
  merchantDomain: string;
  hostedProfileUrl?: string;  // For edge/proxy modes
}

// Install artifact
export interface InstallArtifact {
  filename: string;
  content: string;
  contentType: 'json' | 'javascript' | 'nginx' | 'apache' | 'markdown';
  description: string;
}

// Database models (for API service)
export interface MerchantRecord {
  id: string;
  primaryDomain: string;
  displayName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileRecord {
  id: string;
  merchantId: string;
  versionTag: string;
  ucpVersion: string;
  jsonBody: object;
  status: ProfileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationRunRecord {
  id: string;
  profileId: string;
  mode: 'draft' | 'remote';
  result: object;
  ok: boolean;
  createdAt: Date;
}
