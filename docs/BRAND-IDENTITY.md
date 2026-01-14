# UCP.tools - Brand Identity Guide

## Brand Overview

**UCP.tools** is an independent developer tool that helps merchants prepare for AI-powered commerce by validating and generating Universal Commerce Protocol (UCP) business profiles.

---

## Brand Name & Variations

| Context | Usage |
|---------|-------|
| **Primary** | UCP.tools |
| **Domain** | ucptools.dev (or ucptools.io as fallback) |
| **Apify Actor** | UCP Profile Validator |
| **npm package** | ucp-profile-tools |
| **GitHub** | ucp-tools |
| **Tagline** | "Get ready for AI commerce" |
| **Short tagline** | "Validate. Generate. Ship." |

---

## Brand Voice & Personality

### Tone
- **Developer-first**: Technical but approachable
- **Direct**: No fluff, get to the point
- **Helpful**: Focus on solving problems
- **Independent**: Not affiliated with any platform

### Language Style
- Use "you/your" not "users/merchants"
- Active voice: "Validate your profile" not "Profiles can be validated"
- Confident: "Fix issues instantly" not "May help fix issues"
- No corporate jargon: "Check" not "Leverage our validation capabilities"

### Example Copy

**Good:**
> "Your UCP profile has 2 errors. Here's how to fix them."

**Bad:**
> "Our comprehensive validation engine has detected potential compliance issues in your Universal Commerce Protocol business profile configuration."

---

## Visual Identity

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Primary Blue** | `#2563eb` | Buttons, links, accents |
| **Primary Dark** | `#1d4ed8` | Hover states |
| **Success Green** | `#16a34a` | Valid, success states |
| **Warning Amber** | `#ca8a04` | Warnings |
| **Error Red** | `#dc2626` | Errors, invalid states |
| **Background** | `#f8fafc` | Page background |
| **Card White** | `#ffffff` | Cards, panels |
| **Text Dark** | `#1e293b` | Primary text |
| **Text Muted** | `#64748b` | Secondary text |
| **Border** | `#e2e8f0` | Borders, dividers |

### Typography

- **Headings**: System font stack (SF Pro, Segoe UI, Roboto)
- **Body**: Same system font stack
- **Code**: Monospace (SF Mono, Consolas, Monaco)
- **Font weights**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Logo Concepts

**Text Logo:**
```
UCP.tools
```
- "UCP" in Primary Blue (#2563eb), bold
- ".tools" in Text Muted (#64748b), normal weight

**Icon Concepts:**
- Checkmark inside a document/file icon
- Shield with checkmark (security/validation)
- Interconnected nodes (protocol/commerce)

### Grade Badges (Validation Scores)

| Grade | Background | Text Color |
|-------|------------|------------|
| A | `#dcfce7` | `#16a34a` |
| B | `#dbeafe` | `#2563eb` |
| C | `#fef9c3` | `#ca8a04` |
| D | `#fed7aa` | `#ea580c` |
| F | `#fee2e2` | `#dc2626` |

---

## Messaging Framework

### Elevator Pitch (10 seconds)
> "UCP.tools validates and generates UCP business profiles so your store is ready for AI shopping agents."

### Short Description (30 seconds)
> "UCP.tools is a free validator and generator for Universal Commerce Protocol profiles. Check if your /.well-known/ucp endpoint is correct, generate compliant profiles, and get ready for AI-powered commerce - in seconds."

### Full Description (Product Hunt / Apify Store)
> "The Universal Commerce Protocol (UCP) lets AI agents discover and transact with online stores. But getting your profile right is tricky - wrong namespaces, missing fields, and endpoint issues break agent compatibility.
>
> UCP.tools fixes that:
> - **Validate** any domain's UCP profile instantly
> - **Generate** compliant profiles with a simple wizard
> - **Get actionable fixes** for every issue found
> - **Score your readiness** with A-F grades
>
> Free to use. No signup required. Built by developers, for developers."

### Key Messages

1. **Problem**: "AI agents can't discover your store if your UCP profile is broken"
2. **Solution**: "Validate and fix your profile in seconds"
3. **Proof**: "Checks all UCP spec rules: namespaces, endpoints, signing keys"
4. **CTA**: "Check your profile free at ucptools.dev"

---

## Target Audience

### Primary: Developers & Technical Founders
- Building on headless commerce (Medusa, Saleor, custom)
- Care about standards compliance
- Comfortable with JSON/APIs
- Value speed and accuracy

### Secondary: E-commerce Agencies
- Managing multiple client stores
- Need bulk validation
- Want white-label reports

### Tertiary: Non-technical Merchants
- Shopify/WooCommerce store owners
- Need simple "is it working?" check
- May upgrade to managed service

---

## Competitive Positioning

### We Are
- Free and instant
- Developer-focused
- Independent (not affiliated with Google/Shopify)
- Self-serve first

### We Are Not
- Enterprise sales motion
- Full UCP implementation service
- Platform-specific (works with any backend)

### Differentiators
| Feature | UCP.tools | UCP Ready | WellKnown | UCP Playground |
|---------|-----------|-----------|-----------|----------------|
| Free validation | ✅ Unlimited | Limited | ❌ | Demo only |
| Profile generation | ✅ | ❌ | ❌ | ❌ |
| CLI/API access | ✅ | ❌ | ❌ | ❌ |
| No signup | ✅ | ? | ❌ | ✅ |

---

## Content Guidelines

### Headlines
- Lead with benefit: "Validate Your UCP Profile" not "UCP Validation Tool"
- Use numbers: "Fix 12 common UCP errors" not "Fix UCP errors"
- Create urgency: "AI agents are coming. Is your store ready?"

### Call-to-Actions
- Primary: "Validate Now" / "Check Your Profile"
- Secondary: "Generate Profile" / "Download JSON"
- Tertiary: "See Pricing" / "Get Pro"

### Error Messages
- Be specific: "Endpoint must use HTTPS" not "Invalid endpoint"
- Be helpful: Include "hint" with fix suggestion
- Be human: "Oops, we couldn't reach your profile" not "Error 404"

---

## Social Media Templates

### Twitter/X Bio
> Free UCP profile validator & generator. Get your store ready for AI commerce agents. ⚡ Instant results, no signup.

### Product Hunt Tagline
> Validate and generate UCP profiles for AI-powered commerce

### GitHub Description
> Free, open-source UCP (Universal Commerce Protocol) profile validator and generator. CLI + API + Web UI.

---

## Legal & Disclaimers

### Standard Disclaimer
> "UCP.tools is an independent project and is not affiliated with, endorsed by, or sponsored by Google, Shopify, or the Universal Commerce Protocol working group."

### Open Source Notice
> "UCP.tools is open source under the MIT license. The UCP specification is maintained by the UCP working group."

---

## Asset Checklist for Launch

- [ ] Logo (SVG, PNG @1x, @2x)
- [ ] Favicon (16x16, 32x32, apple-touch-icon)
- [ ] Open Graph image (1200x630)
- [ ] Twitter card image (1200x600)
- [ ] Product Hunt thumbnail (240x240)
- [ ] Apify Actor icon (256x256)
- [ ] Screenshots (web UI, CLI output, validation report)

---

## GPT Prompt for Brand-Consistent Content

When generating content for UCP.tools, use this context:

```
You are writing for UCP.tools, a free developer tool that validates and generates Universal Commerce Protocol (UCP) business profiles.

Brand voice: Developer-first, direct, helpful, independent
Target audience: Developers building e-commerce, technical founders, agencies
Key differentiator: Free, instant, no signup, generates profiles (not just validates)

Avoid: Corporate jargon, "leverage", "utilize", "comprehensive solution"
Use: "Check", "fix", "validate", "generate", "your profile", "instant"

Colors: Blue (#2563eb), Green for success, Red for errors
Tagline: "Get ready for AI commerce"
```
