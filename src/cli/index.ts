#!/usr/bin/env node
/**
 * UCP Profile Validator CLI
 */

import { program } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { validateProfile, validateRemote, validateQuick } from '../validator/index.js';
import { buildProfile, generateMinimalProfile } from '../generator/index.js';
import { generateHostingArtifacts } from '../hosting/index.js';
import type { ValidationReport } from '../types/validation.js';
import type { GeneratorInput, HostingConfig, HostingMode, HostingPlatform } from '../types/generator.js';

// Colors for terminal output (simple implementation without chalk for ESM)
const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

program
  .name('ucp-validate')
  .description('UCP Profile Validator and Generator CLI')
  .version('1.0.0');

/**
 * Validate command
 */
program
  .command('validate')
  .description('Validate a UCP profile')
  .option('-f, --file <path>', 'Path to local JSON file')
  .option('-r, --remote <domain>', 'Remote domain to fetch profile from')
  .option('-q, --quick', 'Quick validation (no network checks)')
  .option('-o, --output <path>', 'Output report to file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      let report: ValidationReport;

      if (options.remote) {
        console.log(colors.blue(`Fetching profile from https://${options.remote}/.well-known/ucp...`));
        report = await validateRemote(options.remote, {
          skipNetworkChecks: options.quick,
        });
      } else if (options.file) {
        const filePath = resolve(options.file);
        if (!existsSync(filePath)) {
          console.error(colors.red(`File not found: ${filePath}`));
          process.exit(1);
        }
        const content = readFileSync(filePath, 'utf-8');
        const profile = JSON.parse(content);

        if (options.quick) {
          report = validateQuick(profile);
        } else {
          report = await validateProfile(profile);
        }
      } else {
        console.error(colors.red('Please specify --file or --remote'));
        process.exit(1);
      }

      // Output
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printValidationReport(report);
      }

      if (options.output) {
        writeFileSync(options.output, JSON.stringify(report, null, 2));
        console.log(colors.gray(`\nReport saved to: ${options.output}`));
      }

      process.exit(report.ok ? 0 : 1);
    } catch (error) {
      console.error(colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Generate command
 */
program
  .command('generate')
  .description('Generate a new UCP profile')
  .requiredOption('-d, --domain <domain>', 'Primary domain (e.g., merchant.com)')
  .requiredOption('-e, --endpoint <url>', 'REST API endpoint URL')
  .option('-i, --id <id>', 'Merchant ID (auto-generated if not provided)')
  .option('--order', 'Enable Order capability')
  .option('--fulfillment', 'Enable Fulfillment capability')
  .option('--discount', 'Enable Discount capability')
  .option('-o, --output <path>', 'Output file path', 'ucp.json')
  .option('--json', 'Output to stdout as JSON')
  .action(async (options) => {
    try {
      const input: GeneratorInput = {
        merchant: {
          merchantId: options.id || `merchant-${Date.now()}`,
          primaryDomain: options.domain,
        },
        transport: {
          rest: {
            endpoint: options.endpoint,
          },
        },
        capabilities: {
          checkout: true,
          order: options.order || false,
          fulfillment: options.fulfillment || false,
          discount: options.discount || false,
        },
        security: {
          generateSigningKeys: options.order || false,
        },
      };

      const result = await buildProfile(input);

      if (options.json) {
        console.log(result.profileJson);
      } else {
        writeFileSync(options.output, result.profileJson);
        console.log(colors.green(`✓ Profile generated: ${options.output}`));

        if (result.signingKeyPair) {
          const keyFile = options.output.replace('.json', '-private-key.pem');
          writeFileSync(keyFile, result.signingKeyPair.privateKey);
          console.log(colors.yellow(`⚠ Private key saved: ${keyFile}`));
          console.log(colors.gray('  Keep this file secure! Do not commit to version control.'));
        }

        console.log(colors.blue('\nNext steps:'));
        console.log('  1. Review the generated profile');
        console.log('  2. Run: ucp-validate validate -f ' + options.output);
        console.log('  3. Deploy to https://' + options.domain + '/.well-known/ucp');
      }
    } catch (error) {
      console.error(colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Generate minimal profile
 */
program
  .command('generate-minimal')
  .description('Generate a minimal starter profile')
  .requiredOption('-e, --endpoint <url>', 'REST API endpoint URL')
  .option('-o, --output <path>', 'Output file path', 'ucp.json')
  .action((options) => {
    try {
      const profile = generateMinimalProfile(options.endpoint);
      const json = JSON.stringify(profile, null, 2);

      writeFileSync(options.output, json);
      console.log(colors.green(`✓ Minimal profile generated: ${options.output}`));
    } catch (error) {
      console.error(colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Generate hosting artifacts
 */
program
  .command('hosting')
  .description('Generate hosting configuration files')
  .requiredOption('-f, --file <path>', 'Path to profile JSON file')
  .requiredOption('-d, --domain <domain>', 'Merchant domain')
  .requiredOption('-m, --mode <mode>', 'Hosting mode: static, edge-worker, reverse-proxy')
  .option('-p, --platform <platform>', 'Platform: nginx, apache, vercel, netlify, cloudflare-worker, s3-cloudfront')
  .option('-i, --id <id>', 'Merchant ID')
  .option('-o, --output <dir>', 'Output directory', './ucp-hosting')
  .action((options) => {
    try {
      const filePath = resolve(options.file);
      if (!existsSync(filePath)) {
        console.error(colors.red(`File not found: ${filePath}`));
        process.exit(1);
      }

      const profileJson = readFileSync(filePath, 'utf-8');

      const config: HostingConfig = {
        mode: options.mode as HostingMode,
        platform: options.platform as HostingPlatform,
        merchantId: options.id || `merchant-${Date.now()}`,
        merchantDomain: options.domain,
      };

      const artifacts = generateHostingArtifacts(config, profileJson);

      // Create output directory
      const outputDir = resolve(options.output);
      if (!existsSync(outputDir)) {
        const { mkdirSync } = require('fs');
        mkdirSync(outputDir, { recursive: true });
      }

      // Write artifacts
      for (const artifact of artifacts) {
        const artifactPath = resolve(outputDir, artifact.filename);
        // Create subdirectories if needed
        const dir = artifactPath.substring(0, artifactPath.lastIndexOf('/'));
        if (dir && !existsSync(dir)) {
          const { mkdirSync } = require('fs');
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(artifactPath, artifact.content);
        console.log(colors.green(`✓ ${artifact.filename}`));
      }

      console.log(colors.blue(`\nArtifacts generated in: ${outputDir}`));
      console.log(colors.gray('See README.md for installation instructions.'));
    } catch (error) {
      console.error(colors.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Print validation report to console
 */
function printValidationReport(report: ValidationReport): void {
  console.log('\n' + colors.bold('UCP Profile Validation Report'));
  console.log('═'.repeat(50));

  if (report.profile_url) {
    console.log(colors.gray(`Profile: ${report.profile_url}`));
  }
  if (report.ucp_version) {
    console.log(colors.gray(`UCP Version: ${report.ucp_version}`));
  }
  console.log(colors.gray(`Validated: ${report.validated_at}`));
  console.log(colors.gray(`Mode: ${report.validation_mode}`));
  console.log('');

  // Summary
  if (report.ok) {
    console.log(colors.green('✓ Validation PASSED'));
  } else {
    console.log(colors.red('✗ Validation FAILED'));
  }

  // Issue counts
  const errors = report.issues.filter(i => i.severity === 'error');
  const warnings = report.issues.filter(i => i.severity === 'warn');
  const info = report.issues.filter(i => i.severity === 'info');

  if (report.issues.length === 0) {
    console.log(colors.green('\nNo issues found!'));
  } else {
    console.log(`\n${errors.length} error(s), ${warnings.length} warning(s), ${info.length} info`);
  }

  // Print issues
  if (errors.length > 0) {
    console.log('\n' + colors.red('Errors:'));
    for (const issue of errors) {
      printIssue(issue);
    }
  }

  if (warnings.length > 0) {
    console.log('\n' + colors.yellow('Warnings:'));
    for (const issue of warnings) {
      printIssue(issue);
    }
  }

  if (info.length > 0) {
    console.log('\n' + colors.blue('Info:'));
    for (const issue of info) {
      printIssue(issue);
    }
  }

  console.log('');
}

function printIssue(issue: { severity: string; code: string; path: string; message: string; hint?: string }): void {
  const icon = issue.severity === 'error' ? '✗' : issue.severity === 'warn' ? '⚠' : 'ℹ';
  const color = issue.severity === 'error' ? colors.red : issue.severity === 'warn' ? colors.yellow : colors.blue;

  console.log(`  ${color(icon)} [${issue.code}] ${issue.message}`);
  console.log(colors.gray(`    Path: ${issue.path}`));
  if (issue.hint) {
    console.log(colors.gray(`    Hint: ${issue.hint}`));
  }
}

program.parse();
