/**
 * UCP (Universal Commerce Protocol) Profile Types
 * Based on https://ucp.dev/specification/overview/
 */

// Current UCP version
export const CURRENT_UCP_VERSION = '2026-01-11';

// Transport binding types
export interface RestTransport {
  schema: string;  // OpenAPI schema URL
  endpoint: string; // REST API endpoint (https, no trailing slash)
}

export interface McpTransport {
  schema: string;  // MCP schema URL
  endpoint: string; // MCP endpoint URL
}

export interface A2aTransport {
  agentCard: string; // A2A agent card URL
}

export interface EmbeddedTransport {
  schema: string;  // Embedded schema URL
}

// Service definition with transport bindings
export interface UcpService {
  version: string;
  spec: string;
  rest?: RestTransport;
  mcp?: McpTransport;
  a2a?: A2aTransport;
  embedded?: EmbeddedTransport;
}

// Capability definition
export interface UcpCapability {
  name: string;        // e.g., "dev.ucp.shopping.checkout"
  version: string;     // e.g., "2026-01-11"
  spec: string;        // Specification URL
  schema: string;      // JSON Schema URL
  extends?: string;    // Parent capability for extensions
  config?: Record<string, unknown>; // Capability-specific settings
}

// JWK (JSON Web Key) for signing
export interface JwkKey {
  kty: string;         // Key type (e.g., "EC", "RSA")
  kid: string;         // Key ID
  use?: string;        // Key use (e.g., "sig")
  alg?: string;        // Algorithm (e.g., "ES256")
  crv?: string;        // Curve (for EC keys)
  x?: string;          // X coordinate (for EC keys)
  y?: string;          // Y coordinate (for EC keys)
  n?: string;          // Modulus (for RSA keys)
  e?: string;          // Exponent (for RSA keys)
}

// Signing keys - array of JWK public keys at root level
export type SigningKeys = JwkKey[];

// Payment handler definition
export interface PaymentHandler {
  id: string;           // Handler identifier
  name: string;         // Display name
  version: string;      // Handler version (YYYY-MM-DD)
  spec: string;         // Handler specification URL
  config_schema?: string;        // Configuration schema URL
  instrument_schemas?: string[]; // Payment instrument schemas
  config?: Record<string, unknown>; // Handler-specific config
}

// Payment configuration
export interface PaymentConfig {
  handlers: PaymentHandler[];
}

// Main UCP object within profile
export interface UcpObject {
  version: string;
  services: Record<string, UcpService>;
  capabilities: UcpCapability[];
}

// Complete UCP Business Profile (/.well-known/ucp)
export interface UcpProfile {
  ucp: UcpObject;
  payment?: PaymentConfig;       // Payment handlers configuration
  signing_keys?: SigningKeys;    // JWK public keys for webhook verification
  // Additional vendor extensions can be added as siblings
  [key: string]: unknown;
}

// Known capability namespaces
export const CAPABILITY_NAMESPACES = {
  UCP_OFFICIAL: 'dev.ucp.',
  VENDOR_PREFIX: 'com.',
} as const;

// Known UCP capabilities (from official spec)
export const KNOWN_CAPABILITIES = {
  CHECKOUT: 'dev.ucp.shopping.checkout',
  ORDER: 'dev.ucp.shopping.order',
  PAYMENT: 'dev.ucp.shopping.payment',
  PAYMENT_DATA: 'dev.ucp.shopping.payment_data',
  FULFILLMENT: 'dev.ucp.shopping.fulfillment',
  DISCOUNT: 'dev.ucp.shopping.discount',
  BUYER_CONSENT: 'dev.ucp.shopping.buyer_consent',
} as const;

// Known UCP services
export const KNOWN_SERVICES = {
  SHOPPING: 'dev.ucp.shopping',
} as const;

// Default URLs for UCP official resources
export const UCP_DEFAULTS = {
  SPEC_BASE: 'https://ucp.dev/specification/',
  SCHEMA_BASE: 'https://ucp.dev/schemas/',
  SERVICE_SCHEMA_BASE: 'https://ucp.dev/services/',

  // Default schema URLs
  SHOPPING_REST_SCHEMA: 'https://ucp.dev/services/shopping/rest.openapi.json',
  CHECKOUT_SPEC: 'https://ucp.dev/specification/checkout/',
  CHECKOUT_SCHEMA: 'https://ucp.dev/schemas/shopping/checkout.json',
  ORDER_SPEC: 'https://ucp.dev/specification/order/',
  ORDER_SCHEMA: 'https://ucp.dev/schemas/shopping/order.json',
  FULFILLMENT_SPEC: 'https://ucp.dev/specification/fulfillment/',
  FULFILLMENT_SCHEMA: 'https://ucp.dev/schemas/shopping/fulfillment.json',
  DISCOUNT_SPEC: 'https://ucp.dev/specification/discount/',
  DISCOUNT_SCHEMA: 'https://ucp.dev/schemas/shopping/discount.json',
} as const;

// Environment types
export type Environment = 'production' | 'staging' | 'development';

// Profile status
export type ProfileStatus = 'draft' | 'published';
