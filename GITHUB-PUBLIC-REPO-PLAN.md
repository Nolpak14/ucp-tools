# UCP.tools - Public GitHub Repository Plan

## Repository: `ucptools/ucp-validator`

### Why Make It Public?
1. **Credibility** - Open source = trust in the UCP ecosystem
2. **Discoverability** - GitHub SEO for "UCP validator"
3. **First-mover claim** - Stake position as THE UCP validation tool
4. **Community** - Contributors, stars, backlinks
5. **Integration** - Others can use our validation in their projects

---

## What to Publish (Open Source - MIT License)

### Core Library (`/src`)
- [x] `src/types/` - UCP profile types and validation types
- [x] `src/validator/` - All validators (structural, rules, network)
- [x] `src/generator/` - Profile builder and key generator
- [x] `src/index.ts` - Main exports

### Documentation
- [ ] `README.md` - Installation, usage, API reference
- [ ] `CONTRIBUTING.md` - How to contribute
- [ ] `LICENSE` - MIT license

### Examples
- [x] `examples/` - Sample profiles

### Build/Config
- [x] `package.json` - NPM package config
- [x] `tsconfig.json` - TypeScript config

---

## What to Keep Private (Competitive Advantage)

### Web Application
- `api/` - Serverless functions (validate, generate, badge, generate-schema)
- `public/` - Frontend HTML/CSS/JS
- Vercel deployment config

### Why Keep Private?
- The hosted service at ucptools.dev is our competitive advantage
- Badge generation creates viral marketing
- Schema snippet generator creates user value
- Others can build their own UI using the open source library

---

## Recommended Package Name

```json
{
  "name": "@ucptools/validator",
  "version": "1.0.0",
  "description": "Validate and generate UCP (Universal Commerce Protocol) Business Profiles"
}
```

Or simpler: `ucp-validator`

---

## README.md Outline

```markdown
# UCP Validator

Validate and generate UCP (Universal Commerce Protocol) Business Profiles.

## Installation
npm install @ucptools/validator

## Quick Start
import { validateProfile, buildProfile } from '@ucptools/validator';

## Features
- Structural validation (JSON structure, required fields)
- UCP rules validation (namespace binding, extensions, endpoints)
- Network validation (fetch and verify schemas)
- Profile generation (minimal and full profiles)
- Signing key generation

## Online Tool
Try it online at https://ucptools.dev

## License
MIT
```

---

## Action Items

1. [ ] Create GitHub organization: `ucptools`
2. [ ] Create repo: `ucptools/ucp-validator`
3. [ ] Extract library files (exclude api/ and public/)
4. [ ] Write comprehensive README
5. [ ] Publish to NPM as `@ucptools/validator`
6. [ ] Add GitHub badges to the README
7. [ ] Submit to awesome-ucp or similar lists

---

## Marketing Value

When published, the repo will:
- Rank for "UCP validator" searches
- Get links from developers using it
- Show ucptools.dev in README (traffic)
- Build credibility for the hosted tool
- Enable integrations (CI/CD, other tools)

## Timeline

Can be done in 1-2 hours once we decide to proceed.
