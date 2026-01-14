# Apify Store Listing - UCP Profile Validator

Complete copy-paste content for Apify Store publication. Updated January 2026.

---

## 1. DISPLAY INFORMATION

### Actor Name
```
ucp-profile-validator
```

### Title
```
UCP Profile Validator
```

### Description (exactly 300 characters)
```
Validate any merchant's Universal Commerce Protocol (UCP) business profile at /.well-known/ucp. Check AI commerce readiness with instant A-F grading, detailed issue reports, and fix recommendations. Essential for e-commerce stores preparing for AI shopping agents.
```
*Character count: 299*

### SEO Title (40-50 characters)
```
UCP Profile Validator - AI Commerce Readiness Check
```
*Character count: 50*

### SEO Description (140-156 characters)
```
Free UCP profile validator. Check if your store's /.well-known/ucp endpoint is ready for AI shopping agents. Get instant A-F grade with fix recommendations.
```
*Character count: 156*

---

## 2. CATEGORIES & TAGS

### Primary Category
```
Developer Tools
```

### Additional Categories
```
E-commerce
SEO Tools
```

### Tags/Keywords (comma-separated)
```
ucp, universal commerce protocol, ai commerce, ecommerce validation, api validation, schema validation, well-known, ai shopping, agent commerce, google ucp, shopify ucp, ai agents, commerce api, merchant profile
```

---

## 3. PRICING CONFIGURATION

### Pricing Model
```
Pay per event (PAY_PER_EVENT) with Synthetic Events
```

### Why Pay Per Event?

| Model | Status | AI/MCP Compatible | Notes |
|-------|--------|-------------------|-------|
| Free | Available | Yes | No revenue |
| Rental | Available | **No** | Incompatible with AI agents |
| Pay Per Result | **DEPRECATED** | Yes | Being removed in 2026 |
| **Pay Per Event** | **RECOMMENDED** | Yes | Most flexible, future-proof |

### Why Use Synthetic Events (No Code Needed!)

Apify provides **synthetic events** that auto-charge without any `Actor.charge()` code:

1. **`apify-actor-start`** - Auto-charged when actor starts
   - **Apify covers first 5 seconds of compute FREE**
   - Default price: $0.00005 per start

2. **`apify-default-dataset-item`** - Auto-charged on each `Actor.pushData()`
   - You set the price per result
   - No code changes needed - just configure in Console

### Recommended Event Configuration

| Event | Type | Price | Description |
|-------|------|-------|-------------|
| `apify-actor-start` | Synthetic (auto) | $0.00005 | Charged per run start (Apify subsidizes first 5 sec) |
| `apify-default-dataset-item` | Synthetic (auto) | $0.001 | Charged per validation result |

### Tiered Pricing for `apify-default-dataset-item`

| Tier | Price per Result | Price per 1,000 |
|------|-----------------|-----------------|
| FREE | $0.002 | $2.00 |
| BRONZE | $0.0018 | $1.80 |
| SILVER | $0.0015 | $1.50 |
| GOLD | $0.001 | $1.00 |
| PLATINUM | $0.001 | $1.00 |
| DIAMOND | $0.001 | $1.00 |

### Example Cost Calculation

For 100 validations on FREE tier:
- Actor starts: 100 × $0.00005 = $0.005
- Results: 100 × $0.002 = $0.20
- **Total: $0.205** (~$2.05 per 1,000 validations)

For 100 validations on GOLD tier:
- Actor starts: 100 × $0.00005 = $0.005
- Results: 100 × $0.001 = $0.10
- **Total: $0.105** (~$1.05 per 1,000 validations)

### Revenue Calculation

You receive 80% of revenue minus platform costs:
- Revenue from 1,000 validations (GOLD): $1.05
- Platform cost estimate: ~$0.10
- **Your profit: (0.8 × $1.05) - $0.10 = $0.74**

### Why This Pricing Works

1. **No code needed** - Synthetic events handle charging automatically
2. **Apify subsidizes startup** - First 5 sec compute is free
3. **Competitive** - Similar to email validators ($0.001-0.002)
4. **AI/MCP compatible** - Essential for future AI agent integrations
5. **Future-proof** - PPR is deprecated, PPE is the standard

---

## 4. INPUT SCHEMA

Already configured in `.actor/input_schema.json`:

```json
{
  "title": "UCP Profile Validator",
  "description": "Enter a domain to validate its UCP (Universal Commerce Protocol) business profile...",
  "type": "object",
  "schemaVersion": 1,
  "properties": {
    "domain": {
      "title": "Domain",
      "type": "string",
      "description": "Enter the merchant domain to validate (without https://)...",
      "editor": "textfield",
      "prefill": "google.com",
      "example": "shopify.com"
    },
    "mode": {
      "title": "Validation Mode",
      "type": "string",
      "default": "full",
      "enum": ["full", "quick"],
      "enumTitles": ["Full (recommended)", "Quick (structural only)"]
    },
    "includeRecommendations": {
      "title": "Include Fix Recommendations",
      "type": "boolean",
      "default": true
    }
  },
  "required": ["domain"]
}
```

---

## 5. OUTPUT SCHEMA

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `domain` | string | The validated domain |
| `profileUrl` | string | Full URL of the UCP profile |
| `valid` | boolean | Whether profile passes validation |
| `score` | number | Compliance score 0-100 |
| `grade` | string | Letter grade A-F |
| `ucpVersion` | string | Detected UCP spec version |
| `errors` | number | Count of error-level issues |
| `warnings` | number | Count of warning-level issues |
| `issues` | array | Detailed list of all issues found |
| `recommendations` | array | Actionable fix suggestions |
| `checkedAt` | string | ISO timestamp of validation |
| `generatorUrl` | string | Link to profile generator tool |

### Sample Output
```json
{
  "domain": "example.com",
  "profileUrl": "https://example.com/.well-known/ucp",
  "valid": false,
  "score": 60,
  "grade": "D",
  "ucpVersion": "2026-01-11",
  "errors": 2,
  "warnings": 1,
  "issues": [
    {
      "severity": "error",
      "code": "UCP_NS_MISMATCH",
      "message": "dev.ucp.* spec must be on ucp.dev"
    }
  ],
  "recommendations": [
    "Fix all errors before deploying",
    "Add signing_keys for Order capability"
  ],
  "checkedAt": "2026-01-14T12:00:00.000Z",
  "generatorUrl": "https://ucptools.dev/generate"
}
```

---

## 6. EXAMPLE INPUTS

### Basic Input
```json
{
  "domain": "google.com"
}
```

### Full Options
```json
{
  "domain": "mystore.com",
  "mode": "full",
  "includeRecommendations": true
}
```

### Quick Validation
```json
{
  "domain": "mystore.com",
  "mode": "quick"
}
```

---

## 7. USE CASES (for Store listing)

Copy these directly:

```
- Validate your store's UCP profile before AI agent integration
- Audit competitor UCP readiness
- Monitor multiple merchant profiles for compliance
- Pre-launch check for headless commerce deployments
- Agency bulk validation of client stores
```

---

## 8. FAQ CONTENT

### Q: What is UCP?
```
The Universal Commerce Protocol is an open standard by Google, Shopify, and others that enables AI agents to discover and shop at online stores. Merchants publish a profile at /.well-known/ucp describing their capabilities.
```

### Q: Why do I need this validator?
```
If your UCP profile has errors, AI shopping agents won't be able to find or transact with your store. This validator catches issues before they become problems, ensuring you're ready when AI commerce goes mainstream.
```

### Q: What does the grade mean?
```
A = Fully compliant (90-100 score)
B = Minor issues (80-89)
C = Several issues (70-79)
D = Significant problems (60-69)
F = Broken or missing (0-59)
```

### Q: How do I fix issues?
```
Each issue includes an error code and recommendation. Visit https://ucptools.dev/generate to create a new profile from scratch, or manually fix the issues based on the recommendations provided.
```

### Q: Can I validate multiple domains?
```
Yes! Use the Apify API or schedules to validate multiple domains in bulk. Perfect for agencies managing many stores or monitoring competitors.
```

### Q: Is this affiliated with Google or Shopify?
```
No. UCP.tools is an independent project that validates against the official UCP specification. We are not affiliated with Google, Shopify, or any other UCP consortium member.
```

---

## 9. ICON/LOGO

Recommended: Create a simple icon featuring:
- Checkmark or shield symbol (validation/security)
- Commerce/shopping cart element
- Colors: Blue (#2563eb) and green (#16a34a)
- Do NOT use Google, Shopify, or UCP consortium logos

---

## 10. AUTHOR INFORMATION

### Developer Name
```
UCP.tools
```

### Website
```
https://ucptools.dev
```

### Support Email
```
hello@ucptools.dev
```

---

## 11. PUBLICATION CHECKLIST

### Before Publishing
- [x] Actor code tested and working
- [x] README.md complete with all sections
- [x] Input schema with descriptions and prefills
- [x] Output schema with dataset views
- [x] actor.json with metadata and use cases
- [x] Description exactly 300 characters
- [x] SEO title and description set
- [ ] Icon/logo uploaded
- [ ] Categories selected
- [ ] Tags added
- [ ] Pricing configured

### After Publishing
- [ ] Test run from Store page
- [ ] Verify output displays correctly
- [ ] Check SEO by searching "UCP validator Apify"
- [ ] Share on social media
- [ ] Add Actor badge to ucptools.dev website

---

## 12. DEPLOYMENT COMMANDS

### Push to Apify
```bash
cd ucp-profile-manager/apify-actor
apify push
```

### Test Run via CLI
```bash
apify call ucp-profile-validator -i '{"domain": "google.com"}'
```

### View Actor (Console)
```
https://console.apify.com/actors/zNlcAOgvdpdzblpIA
```

### Store Listing (Public)
```
https://apify.com/minute_contest/ucp-profile-validator
```

---

## 13. PROMOTION CHECKLIST

After publishing:

1. **Apify Community**
   - Post in Apify Discord
   - Share on Apify community forum

2. **Social Media**
   - Twitter: Announce with #AICommerce #UCP hashtags
   - LinkedIn: Post about AI commerce readiness

3. **SEO**
   - Add Actor to ucptools.dev website
   - Create blog post about UCP validation

4. **Integrations**
   - Add to n8n community nodes list
   - Create Make.com integration template
   - Build Zapier integration

---

## 14. VERSION HISTORY

### v1.0 (2026-01-14)
- Initial release
- Full UCP spec validation
- A-F grading system
- Fix recommendations
- Quick and full validation modes

---

*Last updated: January 14, 2026*
