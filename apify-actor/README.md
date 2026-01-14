# UCP Profile Validator

Validate any merchant's **Universal Commerce Protocol (UCP)** business profile and check if their store is ready for AI-powered commerce agents.

## What does UCP Profile Validator do?

This Actor fetches and validates UCP business profiles published at `/.well-known/ucp`. It checks compliance with the [official UCP specification](https://ucp.dev/specification/overview/) and provides:

- **Instant A-F grading** based on compliance score (0-100)
- **Detailed issue reports** with error codes and severity levels
- **Actionable fix recommendations** for each problem found
- **UCP version detection** to ensure you're using the latest spec

## What is UCP?

The [Universal Commerce Protocol](https://ucp.dev) is an open standard developed by Google, Shopify, and other industry leaders. It enables AI shopping agents to:

- Discover online stores programmatically
- Understand store capabilities (checkout, orders, fulfillment)
- Transact securely with proper authentication

Merchants publish their UCP profile at `https://yourdomain.com/.well-known/ucp` to participate in AI-powered commerce.

## Why validate your UCP profile?

- **AI agents can't find you**: Invalid profiles mean AI shopping assistants skip your store
- **Lost sales**: Customers using AI tools won't be able to purchase from you
- **Compliance issues**: Incorrect schemas break integrations with payment and fulfillment systems
- **Competitive disadvantage**: Early UCP adopters capture AI-driven traffic first

## How to use UCP Profile Validator

1. Enter the domain you want to validate (e.g., `mystore.com`)
2. Select validation mode (Full recommended for comprehensive checks)
3. Click **Run**
4. Review the grade, issues, and recommendations in the output

### Input options

| Field | Description | Default |
|-------|-------------|---------|
| `domain` | Merchant domain to validate | Required |
| `mode` | `full` (comprehensive) or `quick` (structural only) | `full` |
| `includeRecommendations` | Add fix suggestions to output | `true` |

## Validation checks performed

| Check | Severity | Description |
|-------|----------|-------------|
| Profile accessibility | Error | Can we reach `/.well-known/ucp`? |
| JSON structure | Error | Valid JSON with required `ucp` object |
| Version format | Error | Must be `YYYY-MM-DD` format |
| Services defined | Error | At least one service with transport binding |
| Capabilities array | Error | Required capabilities with name/version/spec/schema |
| HTTPS endpoints | Error | All endpoints must use HTTPS |
| Namespace validation | Error | `dev.ucp.*` must use `ucp.dev` URLs |
| Extension chains | Error | Parent capabilities must exist |
| Signing keys | Error | Required if Order capability is present |
| Trailing slashes | Warning | Endpoints should not have trailing `/` |

## Output example

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
    },
    {
      "severity": "error",
      "code": "UCP_MISSING_KEYS",
      "message": "Order requires signing_keys"
    },
    {
      "severity": "warn",
      "code": "UCP_TRAILING_SLASH",
      "message": "Remove trailing slash"
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

## Grading system

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90-100 | Fully compliant, ready for AI agents |
| **B** | 80-89 | Minor issues, mostly ready |
| **C** | 70-79 | Several issues to fix |
| **D** | 60-69 | Significant problems |
| **F** | 0-59 | Profile broken or missing |

## How much does it cost?

This Actor uses **pay-per-event pricing**:

- **$0.001 - $0.002 per validation** (tiered pricing for higher volumes)
- Platform compute costs are included
- No monthly fees or subscriptions

| Tier | Price per 1,000 validations |
|------|----------------------------|
| Free | $2.00 |
| Gold+ | $1.00 |

Example: Validating 100 domains costs approximately $0.10 - $0.20.

## Use cases

- **Pre-launch validation**: Check your profile before going live with AI commerce
- **Competitor analysis**: See which stores in your industry are UCP-ready
- **Bulk monitoring**: Validate hundreds of domains programmatically via API
- **Agency audits**: Check all client stores at once with scheduled runs
- **CI/CD integration**: Add validation to your deployment pipeline

## API integration

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_USERNAME~ucp-profile-validator/runs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{"domain": "example.com"}'
```

## Tips for fixing UCP issues

1. **Start with errors first** - Warnings won't block AI agents, but errors will
2. **Use the generator** - Visit [ucptools.dev/generate](https://ucptools.dev/generate) to create a valid profile from scratch
3. **Test locally** - Use Quick mode during development for faster iteration
4. **Check namespace rules** - Official `dev.ucp.*` capabilities must reference `ucp.dev` URLs

## Need to generate a profile?

If your store doesn't have a UCP profile yet, use our free generator:
**[https://ucptools.dev/generate](https://ucptools.dev/generate)**

## Resources

- [UCP Specification](https://ucp.dev/specification/overview/)
- [UCP GitHub Repository](https://github.com/Universal-Commerce-Protocol/ucp)
- [Google UCP Business Profile Guide](https://developers.google.com/merchant/ucp/guides/business-profile)

## Support

- **Website**: [ucptools.dev](https://ucptools.dev)
- **Email**: hello@ucptools.dev

---

**UCP.tools** - Get ready for AI commerce.
