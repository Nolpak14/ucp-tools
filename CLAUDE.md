# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UCP Profile Manager is a toolkit for validating and generating UCP (Universal Commerce Protocol) Business Profiles - an open standard enabling AI agents to discover, browse, and complete purchases on UCP-enabled merchants. The project includes a core library, REST API, CLI tools, web UI, and Apify actor integration.

**Live deployment:** https://ucptools.dev

## Commands

```bash
# Development
npm run dev           # Watch mode Express server (tsx watch src/api/server.ts)
npm run build         # TypeScript compilation
npm start             # Production server (node dist/api/server.js)

# Testing
npm test              # Vitest tests (30s timeout, v8 coverage)

# Linting
npm run lint          # ESLint on src/**/*.ts

# CLI tools
npm run validate      # Run validator CLI (tsx src/cli/index.ts)
npm run generate      # Run generator CLI (tsx src/cli/generate.ts)

# Database (Drizzle + PostgreSQL)
npm run db:generate   # Generate Drizzle schema
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema to DB
npm run db:studio     # Open Drizzle Studio
```

## Architecture

### Core Library (`/src/`)

**Validator (`/src/validator/`)** - Four validation levels:
- `structural-validator.ts` - JSON structure, required fields, version format (YYYY-MM-DD)
- `rules-validator.ts` - UCP compliance (namespace/origin binding, extension chains, HTTPS endpoints, signing keys)
- `network-validator.ts` - Remote schema fetching/verification, self-describing schema validation
- `sdk-validator.ts` - Integration with @ucp-js/sdk for official UCP compliance
- `index.ts` - Orchestrator exposing `validateProfile()`, `validateRemote()`, `validateQuick()`, `validateJsonString()`

**Generator (`/src/generator/`)** - Profile generation:
- `profile-builder.ts` - `buildProfile()` for full profiles, `generateMinimalProfile()` for checkout-only
- `key-generator.ts` - Ed25519/ES256 signing key generation (`generateSigningKeyPair()`)

**Simulator (`/src/simulator/`)** - AI agent interaction simulation:
- `agent-simulator.ts` - Tests real-world functionality: discovery flow, capability inspection, checkout simulation
- Not just spec compliance - simulates actual agent workflows

**Hosting (`/src/hosting/`)** - Platform-specific deployment configs:
- `artifacts-generator.ts` - Generates installation artifacts for Nginx, Apache, Vercel, Netlify, Cloudflare Workers, S3+CloudFront

### API & Deployment

**Express API (`/src/api/server.ts`)** - REST endpoints:
- `POST /v1/profiles/validate`, `/validate-quick`, `/validate-remote`, `/validate-json`
- `POST /v1/profiles/generate`, `/generate-minimal`
- `POST /v1/hosting/artifacts`

**Vercel Serverless (`/api/`)** - Edge functions for ucptools.dev

**Database (`/src/db/`)** - Drizzle ORM with PostgreSQL (Neon):
- Schema: merchants (directory), benchmarkStats, benchmarkSummary
- Service: `/src/services/directory.ts` - merchant CRUD, filtering, stats

### Types (`/src/types/`)
- `ucp-profile.ts` - UCP specification types
- `validation.ts` - ValidationReport, ValidationIssue interfaces
- `generator.ts` - Generator input/output types

## Key Patterns

**Validation Issue Structure:**
```typescript
{
  severity: 'error' | 'warn' | 'info',
  code: string,        // e.g., 'UCP_NS_ORIGIN_MISMATCH'
  path: string,        // JSON path, e.g., '$.ucp.capabilities[0]'
  message: string,
  hint?: string        // Fix suggestion
}
```

**Error Codes:** `UCP_MISSING_ROOT`, `UCP_MISSING_VERSION`, `UCP_INVALID_VERSION_FORMAT`, `UCP_NS_ORIGIN_MISMATCH`, `UCP_ORPHANED_EXTENSION`, `UCP_ENDPOINT_NOT_HTTPS`, `UCP_ENDPOINT_TRAILING_SLASH`, `UCP_MISSING_SIGNING_KEYS`, `UCP_SCHEMA_FETCH_FAILED`

## Environment Variables

```
DATABASE_URL    # PostgreSQL connection string (Neon)
NODE_ENV        # development | production
PORT            # API port (default: 3000)
LOG_LEVEL       # Pino log level (default: info)
```

## Tech Stack

- **Runtime:** Node.js 20+, TypeScript 5.6, ES2022 target
- **API:** Express 4.21
- **Database:** PostgreSQL via @neondatabase/serverless, Drizzle ORM
- **Validation:** AJV 8.17 (JSON Schema), Zod 3.23, @ucp-js/sdk 0.1
- **Crypto:** jose (JWT/JWK), Ed25519 signing
- **CLI:** Commander 12, Chalk 5
- **Testing:** Vitest
- **Deployment:** Vercel
