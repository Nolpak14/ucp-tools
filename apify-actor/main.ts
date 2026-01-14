/**
 * UCP Profile Validator - Apify Actor
 * Validates any domain's UCP Business Profile at /.well-known/ucp
 *
 * Free tier: validation + report
 * Paid tier: generation + monitoring
 */

import { Actor } from 'apify';
import { validateRemote, validateQuick } from '../src/validator/index.js';

interface Input {
  domain: string;
  mode?: 'quick' | 'full';
  includeRecommendations?: boolean;
}

interface Output {
  domain: string;
  profileUrl: string;
  valid: boolean;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  ucpVersion?: string;
  errors: number;
  warnings: number;
  issues: Array<{
    severity: string;
    code: string;
    message: string;
    hint?: string;
  }>;
  recommendations?: string[];
  checkedAt: string;
  // CTA for monetization
  upgradeUrl: string;
}

await Actor.init();

const input = await Actor.getInput<Input>();

if (!input?.domain) {
  throw new Error('Missing required input: domain');
}

const domain = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
const profileUrl = `https://${domain}/.well-known/ucp`;

console.log(`Validating UCP profile for: ${domain}`);

const report = await validateRemote(domain, {
  mode: input.mode === 'quick' ? 'rules' : 'full',
});

// Calculate score (0-100)
const errorWeight = 20;
const warnWeight = 5;
const errors = report.issues.filter(i => i.severity === 'error').length;
const warnings = report.issues.filter(i => i.severity === 'warn').length;
const score = Math.max(0, 100 - (errors * errorWeight) - (warnings * warnWeight));

// Calculate grade
const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

// Generate recommendations
const recommendations: string[] = [];
if (errors > 0) {
  recommendations.push('Fix all errors before going live with UCP-enabled agents');
}
if (!report.ucp_version) {
  recommendations.push('Ensure your profile is accessible at /.well-known/ucp');
}
if (report.issues.some(i => i.code === 'UCP_MISSING_SIGNING_KEYS')) {
  recommendations.push('Add signing_keys if you plan to use Order capability with webhooks');
}
if (report.issues.some(i => i.code === 'UCP_ENDPOINT_NOT_HTTPS')) {
  recommendations.push('All endpoints must use HTTPS for security');
}
if (score === 100) {
  recommendations.push('Your profile is fully compliant! Consider adding more capabilities.');
}

const output: Output = {
  domain,
  profileUrl,
  valid: report.ok,
  score,
  grade,
  ucpVersion: report.ucp_version,
  errors,
  warnings,
  issues: report.issues.map(i => ({
    severity: i.severity,
    code: i.code,
    message: i.message,
    hint: i.hint,
  })),
  recommendations: input.includeRecommendations !== false ? recommendations : undefined,
  checkedAt: report.validated_at,
  upgradeUrl: 'https://ucp.tools/generate?ref=apify',
};

console.log(`\nValidation complete: ${grade} (${score}/100)`);
console.log(`Errors: ${errors}, Warnings: ${warnings}`);

await Actor.pushData(output);
await Actor.setValue('OUTPUT', output);

await Actor.exit();
