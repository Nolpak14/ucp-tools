# UCP Profile Manager

Generate, validate, and host **UCP (Universal Commerce Protocol) Business Profiles** compliant with the [official UCP specification](https://ucp.dev/specification/overview/).

## Features

- **Profile Generator**: Create valid UCP profiles with smart defaults
- **Multi-level Validator**: Structural, UCP rules, and network validation
- **Hosting Artifacts**: Generate configs for Nginx, Apache, Vercel, Netlify, Cloudflare Workers
- **REST API**: Full-featured API for integration
- **CLI Tool**: Command-line validation and generation

## Installation

```bash
npm install
npm run build
```

## Quick Start

### Generate a Minimal Profile

```bash
npm run generate -- generate-minimal -e https://api.yourstore.com/ucp/v1 -o ucp.json
```

### Generate a Full Profile

```bash
npm run generate -- generate \
  -d yourstore.com \
  -e https://api.yourstore.com/ucp/v1 \
  --order \
  --fulfillment \
  -o ucp.json
```

### Validate a Profile

```bash
# Validate local file
npm run validate -- validate -f ucp.json

# Validate remote profile
npm run validate -- validate -r yourstore.com

# Quick validation (no network checks)
npm run validate -- validate -f ucp.json --quick
```

### Generate Hosting Configuration

```bash
npm run validate -- hosting \
  -f ucp.json \
  -d yourstore.com \
  -m static \
  -p nginx \
  -o ./hosting
```

## API Usage

### Start the API Server

```bash
npm run dev    # Development with hot reload
npm run start  # Production
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/profiles/generate` | Generate full profile |
| POST | `/v1/profiles/generate-minimal` | Generate minimal profile |
| POST | `/v1/profiles/validate` | Validate profile JSON |
| POST | `/v1/profiles/validate-quick` | Quick validation (no network) |
| POST | `/v1/profiles/validate-remote` | Validate remote profile |
| POST | `/v1/hosting/artifacts` | Generate hosting configs |
| GET | `/health` | Health check |

### Generate Profile

```bash
curl -X POST http://localhost:3000/v1/profiles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": {
      "merchantId": "store-123",
      "primaryDomain": "yourstore.com"
    },
    "transport": {
      "rest": {
        "endpoint": "https://api.yourstore.com/ucp/v1"
      }
    },
    "capabilities": {
      "checkout": true,
      "order": true
    }
  }'
```

### Validate Profile

```bash
curl -X POST http://localhost:3000/v1/profiles/validate \
  -H "Content-Type: application/json" \
  -d '{
    "profile": { "ucp": { ... } },
    "options": { "mode": "full" }
  }'
```

## Programmatic Usage

```typescript
import {
  buildProfile,
  validateProfile,
  generateMinimalProfile,
  generateHostingArtifacts,
} from 'ucp-profile-manager';

// Generate a profile
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

// Validate a profile
const report = await validateProfile(result.profile);
console.log(report.ok ? 'Valid!' : 'Invalid!', report.issues);
```

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

## Validation Report Format

```json
{
  "ok": false,
  "profile_url": "https://yourstore.com/.well-known/ucp",
  "ucp_version": "2026-01-11",
  "issues": [
    {
      "severity": "error",
      "code": "UCP_NS_ORIGIN_MISMATCH",
      "path": "$.ucp.capabilities[0].schema",
      "message": "dev.ucp.* schema must be hosted on ucp.dev",
      "hint": "Use https://ucp.dev/schemas/shopping/checkout.json"
    }
  ],
  "validated_at": "2026-01-14T10:30:00.000Z",
  "validation_mode": "full"
}
```

## Hosting Modes

### Static File
Upload `ucp.json` and configure your web server:
- Nginx, Apache, Vercel, Netlify, Cloudflare Pages, S3+CloudFront

### Edge Worker
Proxy from our hosted service via Cloudflare Worker:
```javascript
// Generated worker.js proxies from hosted profile
export default {
  async fetch(request) {
    return fetch('https://profiles.ucptools.dev/{merchant}/ucp.json');
  }
};
```

### Reverse Proxy
Nginx/Apache proxy configuration to hosted service.

## UCP Profile Structure

Based on [UCP Specification](https://github.com/Universal-Commerce-Protocol/ucp):

```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": {
        "version": "2026-01-11",
        "spec": "https://ucp.dev/specification/overview/",
        "rest": {
          "schema": "https://ucp.dev/services/shopping/rest.openapi.json",
          "endpoint": "https://api.yourstore.com/ucp/v1"
        }
      }
    },
    "capabilities": [
      {
        "name": "dev.ucp.shopping.checkout",
        "version": "2026-01-11",
        "spec": "https://ucp.dev/specification/checkout/",
        "schema": "https://ucp.dev/schemas/shopping/checkout.json"
      }
    ]
  },
  "payment": {
    "handlers": [...]
  },
  "signing_keys": [...]
}
```

## References

- [UCP Specification](https://ucp.dev/specification/overview/)
- [UCP GitHub Repository](https://github.com/Universal-Commerce-Protocol/ucp)
- [Google UCP Business Profile Guide](https://developers.google.com/merchant/ucp/guides/business-profile)

## License

MIT
