/**
 * Hosting Artifacts Generator
 * Generates installation artifacts for different hosting platforms
 */

import type {
  HostingConfig,
  HostingMode,
  HostingPlatform,
  InstallArtifact,
} from '../types/generator.js';

const HOSTED_PROFILE_BASE_URL = 'https://profiles.ucp.tools';

/**
 * Generate all installation artifacts for a hosting configuration
 */
export function generateHostingArtifacts(
  config: HostingConfig,
  profileJson: string
): InstallArtifact[] {
  const artifacts: InstallArtifact[] = [];

  // Always include the profile JSON
  artifacts.push({
    filename: 'ucp.json',
    content: profileJson,
    contentType: 'json',
    description: 'UCP Business Profile JSON file',
  });

  // Generate platform-specific artifacts
  switch (config.mode) {
    case 'static':
      artifacts.push(...generateStaticArtifacts(config));
      break;
    case 'edge-worker':
      artifacts.push(...generateEdgeWorkerArtifacts(config));
      break;
    case 'reverse-proxy':
      artifacts.push(...generateReverseProxyArtifacts(config));
      break;
  }

  // Always include README
  artifacts.push(generateReadme(config));

  return artifacts;
}

/**
 * Generate artifacts for static file hosting
 */
function generateStaticArtifacts(config: HostingConfig): InstallArtifact[] {
  const artifacts: InstallArtifact[] = [];
  const platform = config.platform || 'generic';

  switch (platform) {
    case 'nginx':
      artifacts.push(generateNginxStaticConfig(config));
      break;
    case 'apache':
      artifacts.push(generateApacheConfig(config));
      break;
    case 'vercel':
      artifacts.push(generateVercelConfig(config));
      break;
    case 'netlify':
      artifacts.push(generateNetlifyConfig(config));
      break;
    case 'cloudflare-pages':
      artifacts.push(generateCloudflarePagesFunctions(config));
      break;
    case 's3-cloudfront':
      artifacts.push(generateS3Instructions(config));
      break;
    default:
      artifacts.push(generateGenericStaticInstructions(config));
  }

  return artifacts;
}

/**
 * Generate artifacts for edge worker hosting
 */
function generateEdgeWorkerArtifacts(config: HostingConfig): InstallArtifact[] {
  const artifacts: InstallArtifact[] = [];
  const platform = config.platform || 'cloudflare-worker';

  if (platform === 'cloudflare-worker') {
    artifacts.push(generateCloudflareWorker(config));
    artifacts.push(generateWranglerConfig(config));
  }

  return artifacts;
}

/**
 * Generate artifacts for reverse proxy hosting
 */
function generateReverseProxyArtifacts(config: HostingConfig): InstallArtifact[] {
  const artifacts: InstallArtifact[] = [];

  artifacts.push(generateNginxProxyConfig(config));

  return artifacts;
}

/**
 * Nginx static file configuration
 */
function generateNginxStaticConfig(config: HostingConfig): InstallArtifact {
  const content = `# Nginx configuration for UCP profile at ${config.merchantDomain}
# Add this to your server block

location = /.well-known/ucp {
    alias /var/www/${config.merchantDomain}/ucp.json;
    default_type application/json;

    # CORS headers (required for cross-origin discovery)
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Accept, Content-Type" always;

    # Caching (1 hour recommended)
    add_header Cache-Control "public, max-age=3600" always;

    # Handle preflight requests
    if ($request_method = OPTIONS) {
        return 204;
    }
}
`;

  return {
    filename: 'nginx-ucp.conf',
    content,
    contentType: 'nginx',
    description: 'Nginx configuration snippet for static UCP profile',
  };
}

/**
 * Apache configuration
 */
function generateApacheConfig(config: HostingConfig): InstallArtifact {
  const content = `# Apache configuration for UCP profile at ${config.merchantDomain}
# Add this to your VirtualHost or .htaccess

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^.well-known/ucp$ /ucp.json [L]
</IfModule>

<Files "ucp.json">
    ForceType application/json

    # CORS headers
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, OPTIONS"
    Header set Access-Control-Allow-Headers "Accept, Content-Type"

    # Caching
    Header set Cache-Control "public, max-age=3600"
</Files>

<IfModule mod_headers.c>
    # Handle preflight requests for .well-known/ucp
    <LocationMatch "^/.well-known/ucp$">
        Header always set Access-Control-Allow-Origin "*"
        Header always set Access-Control-Allow-Methods "GET, OPTIONS"
    </LocationMatch>
</IfModule>
`;

  return {
    filename: '.htaccess',
    content,
    contentType: 'apache',
    description: 'Apache configuration for UCP profile',
  };
}

/**
 * Vercel configuration
 */
function generateVercelConfig(config: HostingConfig): InstallArtifact {
  const content = JSON.stringify({
    rewrites: [
      { source: '/.well-known/ucp', destination: '/ucp.json' }
    ],
    headers: [
      {
        source: '/.well-known/ucp',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Cache-Control', value: 'public, max-age=3600' }
        ]
      },
      {
        source: '/ucp.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600' }
        ]
      }
    ]
  }, null, 2);

  return {
    filename: 'vercel.json',
    content,
    contentType: 'json',
    description: 'Vercel configuration for UCP profile routing',
  };
}

/**
 * Netlify configuration
 */
function generateNetlifyConfig(config: HostingConfig): InstallArtifact {
  const redirects = `# Netlify redirects for UCP profile
/.well-known/ucp  /ucp.json  200
`;

  const headers = `# Netlify headers
/.well-known/ucp
  Content-Type: application/json
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, OPTIONS
  Cache-Control: public, max-age=3600

/ucp.json
  Content-Type: application/json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600
`;

  return {
    filename: '_redirects',
    content: redirects + '\n' + headers.replace(/^/gm, '# '),
    contentType: 'markdown',
    description: 'Netlify redirects and headers (also create _headers file)',
  };
}

/**
 * Cloudflare Pages Functions
 */
function generateCloudflarePagesFunctions(config: HostingConfig): InstallArtifact {
  const content = `// Cloudflare Pages Function for /.well-known/ucp
// Place this file at: functions/.well-known/ucp.js

export async function onRequest(context) {
  // Import the profile JSON (place ucp.json in your public folder)
  const profileUrl = new URL('/ucp.json', context.request.url);

  const response = await fetch(profileUrl);
  const profile = await response.text();

  return new Response(profile, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
`;

  return {
    filename: 'functions/.well-known/ucp.js',
    content,
    contentType: 'javascript',
    description: 'Cloudflare Pages Function for UCP endpoint',
  };
}

/**
 * Cloudflare Worker for edge hosting
 */
function generateCloudflareWorker(config: HostingConfig): InstallArtifact {
  const hostedUrl = config.hostedProfileUrl ||
    `${HOSTED_PROFILE_BASE_URL}/${config.merchantId}/ucp.json`;

  const content = `// Cloudflare Worker for UCP Profile Proxy
// Route: ${config.merchantDomain}/.well-known/ucp*

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only handle /.well-known/ucp path
    if (url.pathname !== '/.well-known/ucp') {
      return new Response('Not Found', { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Accept, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Fetch profile from hosted service
    const profileUrl = '${hostedUrl}';

    try {
      const response = await fetch(profileUrl, {
        cf: {
          cacheTtl: 3600,        // Cache for 1 hour
          cacheEverything: true,
        },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const profile = await response.text();

      return new Response(profile, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': 'public, max-age=3600',
          'X-UCP-Profile-Source': 'hosted',
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
};
`;

  return {
    filename: 'worker.js',
    content,
    contentType: 'javascript',
    description: 'Cloudflare Worker for proxying UCP profile from hosted service',
  };
}

/**
 * Wrangler configuration for Cloudflare Worker
 */
function generateWranglerConfig(config: HostingConfig): InstallArtifact {
  const content = `# Cloudflare Worker configuration
# Run: npx wrangler deploy

name = "ucp-profile-${config.merchantId}"
main = "worker.js"
compatibility_date = "2024-01-01"

# Route configuration
# Update this with your actual domain
routes = [
  { pattern = "${config.merchantDomain}/.well-known/ucp*", zone_name = "${config.merchantDomain}" }
]

# Optional: Environment variables
# [vars]
# PROFILE_URL = "${config.hostedProfileUrl || `${HOSTED_PROFILE_BASE_URL}/${config.merchantId}/ucp.json`}"
`;

  return {
    filename: 'wrangler.toml',
    content,
    contentType: 'markdown',
    description: 'Wrangler configuration for deploying Cloudflare Worker',
  };
}

/**
 * Nginx reverse proxy configuration
 */
function generateNginxProxyConfig(config: HostingConfig): InstallArtifact {
  const hostedUrl = config.hostedProfileUrl ||
    `${HOSTED_PROFILE_BASE_URL}/${config.merchantId}/ucp.json`;

  const content = `# Nginx reverse proxy configuration for UCP profile
# Add this to your server block

location = /.well-known/ucp {
    # Proxy to hosted profile service
    proxy_pass ${hostedUrl};
    proxy_set_header Host profiles.ucp.tools;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Caching
    proxy_cache_valid 200 1h;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;

    # CORS headers
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Cache-Control "public, max-age=3600" always;

    # Handle preflight requests
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
        add_header Access-Control-Max-Age 86400;
        return 204;
    }
}
`;

  return {
    filename: 'nginx-proxy.conf',
    content,
    contentType: 'nginx',
    description: 'Nginx reverse proxy configuration for hosted UCP profile',
  };
}

/**
 * S3 + CloudFront instructions
 */
function generateS3Instructions(config: HostingConfig): InstallArtifact {
  const content = `# AWS S3 + CloudFront Setup for UCP Profile

## 1. Upload Profile to S3

\`\`\`bash
# Create bucket (if needed)
aws s3 mb s3://${config.merchantDomain}-ucp

# Upload profile
aws s3 cp ucp.json s3://${config.merchantDomain}-ucp/ucp.json \\
  --content-type "application/json" \\
  --cache-control "public, max-age=3600"
\`\`\`

## 2. Configure CloudFront

Create a CloudFront distribution with:

- Origin: S3 bucket \`${config.merchantDomain}-ucp\`
- Alternate domain: \`${config.merchantDomain}\`
- Behavior for \`/.well-known/ucp\`:
  - Origin path: \`/ucp.json\`
  - Allowed methods: GET, HEAD, OPTIONS
  - Response headers policy: Add CORS headers

## 3. CloudFront Function (for path rewrite)

\`\`\`javascript
function handler(event) {
    var request = event.request;
    if (request.uri === '/.well-known/ucp') {
        request.uri = '/ucp.json';
    }
    return request;
}
\`\`\`

## 4. CORS Configuration (S3 bucket policy)

\`\`\`json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": []
        }
    ]
}
\`\`\`

## 5. Verification

\`\`\`bash
curl -I https://${config.merchantDomain}/.well-known/ucp
\`\`\`

Expected: HTTP 200 with Content-Type: application/json
`;

  return {
    filename: 'aws-setup.md',
    content,
    contentType: 'markdown',
    description: 'AWS S3 + CloudFront setup instructions',
  };
}

/**
 * Generic static hosting instructions
 */
function generateGenericStaticInstructions(config: HostingConfig): InstallArtifact {
  const content = `# UCP Profile Static Hosting Instructions

## Requirements

Your web server must serve the \`ucp.json\` file at:
\`\`\`
https://${config.merchantDomain}/.well-known/ucp
\`\`\`

## Configuration Checklist

1. **File Location**: Place \`ucp.json\` in your web root's \`.well-known\` directory
   or configure a rewrite rule from \`/.well-known/ucp\` to your file location.

2. **Content-Type**: Ensure the response has \`Content-Type: application/json\`

3. **CORS Headers**: Add these headers for cross-origin discovery:
   \`\`\`
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, OPTIONS
   Access-Control-Allow-Headers: Accept, Content-Type
   \`\`\`

4. **Caching**: Recommended cache headers:
   \`\`\`
   Cache-Control: public, max-age=3600
   \`\`\`

5. **HTTPS**: The endpoint MUST be served over HTTPS.

## Verification

\`\`\`bash
# Test the endpoint
curl -I https://${config.merchantDomain}/.well-known/ucp

# Fetch and validate
curl https://${config.merchantDomain}/.well-known/ucp | jq .
\`\`\`

## Validation

Run the UCP validator to check your deployment:
\`\`\`bash
ucp-validate --remote ${config.merchantDomain}
\`\`\`
`;

  return {
    filename: 'setup-instructions.md',
    content,
    contentType: 'markdown',
    description: 'Generic static hosting setup instructions',
  };
}

/**
 * Generate README with all options
 */
function generateReadme(config: HostingConfig): InstallArtifact {
  const content = `# UCP Profile Installation - ${config.merchantDomain}

## Profile Information

- **Merchant ID**: ${config.merchantId}
- **Domain**: ${config.merchantDomain}
- **Hosting Mode**: ${config.mode}
${config.platform ? `- **Platform**: ${config.platform}` : ''}

## Quick Start

Your UCP Business Profile must be accessible at:
\`\`\`
https://${config.merchantDomain}/.well-known/ucp
\`\`\`

## Files Included

- \`ucp.json\` - Your UCP Business Profile
- Platform-specific configuration files (see below)

## Installation Steps

${getInstallationSteps(config)}

## Verification

After installation, verify your profile is accessible:

\`\`\`bash
# Check endpoint responds
curl -I https://${config.merchantDomain}/.well-known/ucp

# Validate response content
curl https://${config.merchantDomain}/.well-known/ucp | jq .

# Run full validation
npx ucp-profile-manager validate --remote ${config.merchantDomain}
\`\`\`

## Troubleshooting

### Common Issues

1. **404 Not Found**: Check file location and rewrite rules
2. **CORS Errors**: Ensure Access-Control-Allow-Origin header is set
3. **SSL Errors**: Profile must be served over HTTPS
4. **Invalid JSON**: Validate JSON syntax with \`jq\`

### Support

For assistance, contact: hello@ucp.tools

---
Generated by UCP Profile Manager v1.0
`;

  return {
    filename: 'README.md',
    content,
    contentType: 'markdown',
    description: 'Installation guide and documentation',
  };
}

/**
 * Get installation steps based on hosting config
 */
function getInstallationSteps(config: HostingConfig): string {
  switch (config.mode) {
    case 'static':
      return `### Static File Hosting

1. Copy \`ucp.json\` to your web server
2. Apply the configuration from the platform-specific config file
3. Restart your web server if needed
4. Test the endpoint`;

    case 'edge-worker':
      return `### Edge Worker Deployment

1. Install Wrangler CLI: \`npm install -g wrangler\`
2. Authenticate: \`wrangler login\`
3. Update \`wrangler.toml\` with your zone settings
4. Deploy: \`npx wrangler deploy\`
5. Verify the route is active in Cloudflare dashboard`;

    case 'reverse-proxy':
      return `### Reverse Proxy Setup

1. Add the nginx configuration snippet to your server block
2. Test configuration: \`nginx -t\`
3. Reload nginx: \`sudo systemctl reload nginx\`
4. Verify the endpoint proxies correctly`;

    default:
      return `See the included configuration files for setup instructions.`;
  }
}
