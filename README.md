# @ucptools/validator

[![npm version](https://img.shields.io/npm/v/@ucptools/validator)](https://www.npmjs.com/package/@ucptools/validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Validate and generate UCP (Universal Commerce Protocol) Business Profiles** for AI-powered shopping agents like ChatGPT, Google AI Mode, and Copilot checkout.

> **Try it online:** [ucptools.dev](https://ucptools.dev) - Free AI Commerce Readiness Checker

---

## What is UCP?

The [Universal Commerce Protocol](https://ucp.dev) is an open standard enabling AI agents to discover, browse, and complete purchases on any UCP-enabled merchant. Google announced UCP on January 11, 2026, with support from Shopify, Target, Walmart, and 20+ ecosystem partners.

This library helps you:
- **Validate** your UCP profile for compliance
- **Generate** properly formatted UCP profiles
- **Verify** schemas and capability declarations

---

## Installation

```bash
npm install @ucptools/validator
```

---

## Quick Start

### Validate a Profile

```typescript
import { validateProfile, validateQuick, validateRemote } from '@ucptools/validator';

// Validate a local profile object
const report = await validateProfile(myProfile);
console.log(report.ok ? 'Valid!' : 'Issues found:', report.issues);

// Quick validation (no network calls)
const quickReport = validateQuick(myProfile);

// Validate a remote profile by domain
const remoteReport = await validateRemote('example.com');
```

### Generate a Profile

```typescript
import { buildProfile, generateMinimalProfile } from '@ucptools/validator';

// Generate a minimal profile (checkout only)
const minimal = generateMinimalProfile({
  endpoint: 'https://api.yourstore.com/ucp/v1',
});

// Generate a full profile
const result = await buildProfile({
  merchant: {
    merchantId: 'store-123',
    primaryDomain: 'yourstore.com',
  },
  transport: {
    rest: { endpoint: 'https://api.yourstore.com/ucp/v1' },
  },
  capabilities: {
    checkout: true,
    order: true,
    fulfillment: false,
    discount: false,
    product: false,
    inventory: false,
  },
});

console.log(result.profileJson);
```

### Generate Signing Keys

```typescript
import { generateSigningKeyPair } from '@ucptools/validator';

// Generate Ed25519 key pair for Order capability
const { publicKey, privateKey, kid } = await generateSigningKeyPair('Ed25519');
```

---

## Validation Levels

### 1. Structural Validation (Fast, Offline)
- JSON structure verification
- Required fields check
- Version format validation (YYYY-MM-DD)

### 2. UCP Rules Validation (Offline)
- Namespace/origin binding (`dev.ucp.*` must use `ucp.dev` URLs)
- Extension chain validation (no orphaned `extends`)
- Endpoint rules (HTTPS, no trailing slash)
- Signing keys requirement for Order capability

### 3. Network Validation (Online)
- Fetch and verify remote schemas
- Self-describing schema validation
- Schema/capability version matching

---

## Validation Report

```typescript
interface ValidationReport {
  ok: boolean;                    // true if no errors
  profile_url?: string;           // URL of validated profile
  ucp_version?: string;           // UCP version from profile
  issues: ValidationIssue[];      // Array of issues found
  validated_at: string;           // ISO timestamp
  validation_mode: ValidationMode;
}

interface ValidationIssue {
  severity: 'error' | 'warn' | 'info';
  code: string;                   // e.g., 'UCP_NS_ORIGIN_MISMATCH'
  path: string;                   // JSON path, e.g., '$.ucp.capabilities[0]'
  message: string;
  hint?: string;                  // Suggestion to fix
}
```

---

## Error Codes

| Code | Severity | Description |
|------|----------|-------------|
| `UCP_MISSING_ROOT` | error | Missing `ucp` object at root |
| `UCP_MISSING_VERSION` | error | Missing version field |
| `UCP_INVALID_VERSION_FORMAT` | error | Version not in YYYY-MM-DD format |
| `UCP_NS_ORIGIN_MISMATCH` | error | Schema URL doesn't match namespace origin |
| `UCP_ORPHANED_EXTENSION` | error | Extends references non-existent capability |
| `UCP_ENDPOINT_NOT_HTTPS` | error | Endpoint must use HTTPS |
| `UCP_ENDPOINT_TRAILING_SLASH` | warn | Remove trailing slash from endpoint |
| `UCP_MISSING_SIGNING_KEYS` | error | Order capability requires signing_keys |
| `UCP_SCHEMA_FETCH_FAILED` | warn | Could not fetch remote schema |

---

## CLI Usage

```bash
# Validate a local file
npx @ucptools/validator validate -f ucp.json

# Validate a remote profile
npx @ucptools/validator validate -r yourstore.com

# Generate a minimal profile
npx @ucptools/validator generate-minimal -e https://api.example.com/ucp/v1 -o ucp.json
```

---

## Online Tool

Don't want to install anything? Use our free online tool:

**[ucptools.dev](https://ucptools.dev)** - AI Commerce Readiness Checker

- Validates UCP profiles + Schema.org requirements
- Generates UCP profiles with a simple form
- Creates Schema.org snippets (MerchantReturnPolicy, shippingDetails)
- Provides A-F grading and actionable recommendations

---

## Resources

- [UCP Specification](https://ucp.dev/specification/overview/)
- [UCP GitHub Repository](https://github.com/Universal-Commerce-Protocol/ucp)
- [Google UCP Business Profile Guide](https://developers.google.com/merchant/ucp/guides/business-profile)
- [UCP JavaScript SDK](https://github.com/Universal-Commerce-Protocol/js-sdk)

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

---

## License

MIT - See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with love for the AI Commerce ecosystem<br>
  <a href="https://ucptools.dev">ucptools.dev</a>
</p>
