/**
 * UCP Profile Builder
 * Generates valid UCP Business Profiles from configuration inputs
 */

import type {
  UcpProfile,
  UcpObject,
  UcpService,
  UcpCapability,
  SigningKeys,
  JwkKey,
} from '../types/ucp-profile.js';
import type {
  GeneratorInput,
  GeneratorOutput,
  TransportConfig,
  CapabilitySelection,
} from '../types/generator.js';
import {
  CURRENT_UCP_VERSION,
  KNOWN_CAPABILITIES,
  KNOWN_SERVICES,
  UCP_DEFAULTS,
} from '../types/ucp-profile.js';
import { generateSigningKeyPair } from './key-generator.js';

/**
 * Build a complete UCP Profile from generator inputs
 */
export async function buildProfile(input: GeneratorInput): Promise<GeneratorOutput> {
  const ucpVersion = input.ucpVersion || CURRENT_UCP_VERSION;

  // Build services
  const services = buildServices(input.transport, ucpVersion);

  // Build capabilities
  const capabilities = buildCapabilities(input.capabilities, ucpVersion);

  // Build the UCP object
  const ucpObject: UcpObject = {
    version: ucpVersion,
    services,
    capabilities,
  };

  // Build the full profile
  const profile: UcpProfile = {
    ucp: ucpObject,
  };

  // Handle signing keys if Order capability is enabled
  let signingKeyPair: GeneratorOutput['signingKeyPair'] | undefined;

  if (input.capabilities.order) {
    if (input.security?.generateSigningKeys !== false) {
      // Generate new signing keys
      const keyPair = await generateSigningKeyPair(
        input.security?.signingKeyAlgorithm || 'ES256'
      );
      profile.signing_keys = [keyPair.publicKey];
      signingKeyPair = keyPair;
    } else if (input.security?.uploadedPublicKey) {
      // Use uploaded public key
      const publicKey = parsePublicKey(input.security.uploadedPublicKey);
      profile.signing_keys = [publicKey];
    }
  }

  // Format the profile JSON
  const profileJson = JSON.stringify(profile, null, 2);

  // Generate install instructions
  const installInstructions = generateInstallInstructions(
    input.merchant.primaryDomain,
    input.merchant.merchantId
  );

  return {
    profile,
    profileJson,
    installInstructions,
    signingKeyPair,
  };
}

/**
 * Build services configuration
 */
function buildServices(
  transport: TransportConfig,
  ucpVersion: string
): Record<string, UcpService> {
  const services: Record<string, UcpService> = {};

  // Always include the shopping service for MVP
  const shoppingService: UcpService = {
    version: ucpVersion,
    spec: `${UCP_DEFAULTS.SPEC_BASE}overview/`,
  };

  // Add REST transport (required for MVP)
  if (transport.rest) {
    shoppingService.rest = {
      schema: transport.rest.schemaUrl || UCP_DEFAULTS.SHOPPING_REST_SCHEMA,
      endpoint: normalizeEndpoint(transport.rest.endpoint),
    };
  }

  // Add MCP transport (optional)
  if (transport.mcp) {
    shoppingService.mcp = {
      schema: transport.mcp.schemaUrl || `${UCP_DEFAULTS.SERVICE_SCHEMA_BASE}shopping/mcp.json`,
      endpoint: normalizeEndpoint(transport.mcp.endpoint),
    };
  }

  // Add A2A transport (optional)
  if (transport.a2a) {
    shoppingService.a2a = {
      agentCard: transport.a2a.agentCardUrl,
    };
  }

  // Add embedded transport (optional)
  if (transport.embedded) {
    shoppingService.embedded = {
      schema: transport.embedded.schemaUrl,
    };
  }

  services[KNOWN_SERVICES.SHOPPING] = shoppingService;

  return services;
}

/**
 * Build capabilities array based on selection
 */
function buildCapabilities(
  selection: CapabilitySelection,
  ucpVersion: string
): UcpCapability[] {
  const capabilities: UcpCapability[] = [];

  // Checkout capability (default ON)
  if (selection.checkout !== false) {
    capabilities.push({
      name: KNOWN_CAPABILITIES.CHECKOUT,
      version: ucpVersion,
      spec: UCP_DEFAULTS.CHECKOUT_SPEC,
      schema: UCP_DEFAULTS.CHECKOUT_SCHEMA,
    });
  }

  // Order capability
  if (selection.order) {
    capabilities.push({
      name: KNOWN_CAPABILITIES.ORDER,
      version: ucpVersion,
      spec: UCP_DEFAULTS.ORDER_SPEC,
      schema: UCP_DEFAULTS.ORDER_SCHEMA,
    });
  }

  // Fulfillment capability (extends Order)
  if (selection.fulfillment) {
    capabilities.push({
      name: KNOWN_CAPABILITIES.FULFILLMENT,
      version: ucpVersion,
      spec: UCP_DEFAULTS.FULFILLMENT_SPEC,
      schema: UCP_DEFAULTS.FULFILLMENT_SCHEMA,
      extends: KNOWN_CAPABILITIES.ORDER,
    });
  }

  // Discount capability
  if (selection.discount) {
    capabilities.push({
      name: KNOWN_CAPABILITIES.DISCOUNT,
      version: ucpVersion,
      spec: UCP_DEFAULTS.DISCOUNT_SPEC,
      schema: UCP_DEFAULTS.DISCOUNT_SCHEMA,
    });
  }

  // Custom capabilities
  if (selection.customCapabilities) {
    for (const custom of selection.customCapabilities) {
      const capability: UcpCapability = {
        name: `${custom.namespace}.${custom.name}`,
        version: custom.version,
        spec: custom.specUrl,
        schema: custom.schemaUrl,
      };
      if (custom.extendsCapability) {
        capability.extends = custom.extendsCapability;
      }
      capabilities.push(capability);
    }
  }

  return capabilities;
}

/**
 * Normalize endpoint URL (ensure https, no trailing slash)
 */
function normalizeEndpoint(endpoint: string): string {
  let normalized = endpoint.trim();

  // Ensure https
  if (!normalized.startsWith('https://')) {
    if (normalized.startsWith('http://')) {
      normalized = normalized.replace('http://', 'https://');
    } else {
      normalized = `https://${normalized}`;
    }
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Parse uploaded public key (PEM or JWK format)
 */
function parsePublicKey(keyData: string): JwkKey {
  // Try to parse as JSON (JWK)
  try {
    const parsed = JSON.parse(keyData);
    if (parsed.kty) {
      return parsed as JwkKey;
    }
  } catch {
    // Not JSON, assume PEM format
  }

  // For PEM format, we'll need to convert (simplified for now)
  throw new Error(
    'PEM format not yet supported. Please provide the public key in JWK format.'
  );
}

/**
 * Generate installation instructions markdown
 */
function generateInstallInstructions(
  merchantDomain: string,
  merchantId: string
): string {
  return `# UCP Profile Installation Instructions

## Profile Location

Your UCP Business Profile must be accessible at:
\`\`\`
https://${merchantDomain}/.well-known/ucp
\`\`\`

## Installation Options

### Option 1: Static File (Recommended for most setups)

1. Save the \`ucp.json\` file to your web server
2. Configure your server to serve it at \`/.well-known/ucp\`

#### Nginx Configuration
\`\`\`nginx
location = /.well-known/ucp {
    alias /path/to/ucp.json;
    default_type application/json;
    add_header Access-Control-Allow-Origin "*";
    add_header Cache-Control "public, max-age=3600";
}
\`\`\`

#### Apache Configuration
\`\`\`apache
<Directory "/path/to/.well-known">
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>

<Files "ucp">
    ForceType application/json
    Header set Access-Control-Allow-Origin "*"
    Header set Cache-Control "public, max-age=3600"
</Files>
\`\`\`

#### Vercel (vercel.json)
\`\`\`json
{
  "rewrites": [
    { "source": "/.well-known/ucp", "destination": "/ucp.json" }
  ],
  "headers": [
    {
      "source": "/.well-known/ucp",
      "headers": [
        { "key": "Content-Type", "value": "application/json" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
\`\`\`

#### Netlify (_redirects)
\`\`\`
/.well-known/ucp  /ucp.json  200
\`\`\`

### Option 2: Edge Worker (Cloudflare)

This approach proxies the profile from our hosted service.

\`\`\`javascript
// Cloudflare Worker
export default {
  async fetch(request, env) {
    const profileUrl = 'https://profiles.ucp.tools/${merchantId}/ucp.json';

    const response = await fetch(profileUrl, {
      cf: { cacheTtl: 3600, cacheEverything: true }
    });

    return new Response(response.body, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};
\`\`\`

Route: \`${merchantDomain}/.well-known/ucp*\`

### Option 3: Reverse Proxy (Nginx)

\`\`\`nginx
location = /.well-known/ucp {
    proxy_pass https://profiles.ucp.tools/${merchantId}/ucp.json;
    proxy_set_header Host profiles.ucp.tools;
    proxy_cache_valid 200 1h;
    add_header Access-Control-Allow-Origin "*";
}
\`\`\`

## Verification

After installation, verify your profile:

1. Open: https://${merchantDomain}/.well-known/ucp
2. Confirm JSON response with correct structure
3. Run validation: \`ucp-validate --remote https://${merchantDomain}\`

## Support

For help, visit: https://ucp.tools
`;
}

/**
 * Generate a minimal starter profile (for quick setup)
 */
export function generateMinimalProfile(
  endpoint: string,
  ucpVersion: string = CURRENT_UCP_VERSION
): UcpProfile {
  return {
    ucp: {
      version: ucpVersion,
      services: {
        [KNOWN_SERVICES.SHOPPING]: {
          version: ucpVersion,
          spec: `${UCP_DEFAULTS.SPEC_BASE}overview/`,
          rest: {
            schema: UCP_DEFAULTS.SHOPPING_REST_SCHEMA,
            endpoint: normalizeEndpoint(endpoint),
          },
        },
      },
      capabilities: [
        {
          name: KNOWN_CAPABILITIES.CHECKOUT,
          version: ucpVersion,
          spec: UCP_DEFAULTS.CHECKOUT_SPEC,
          schema: UCP_DEFAULTS.CHECKOUT_SCHEMA,
        },
      ],
    },
  };
}
