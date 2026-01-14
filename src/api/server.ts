/**
 * UCP Profile Manager API Server
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { buildProfile, generateMinimalProfile } from '../generator/index.js';
import { validateProfile, validateRemote, validateQuick, validateJsonString } from '../validator/index.js';
import { generateHostingArtifacts } from '../hosting/index.js';
import type { GeneratorInput, HostingConfig } from '../types/generator.js';
import type { ValidationOptions } from '../types/validation.js';

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});

const app = express();
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = nanoid(8);
  (req as any).requestId = requestId;
  logger.info({ requestId, method: req.method, path: req.path }, 'Request received');
  next();
});

// CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// API version prefix
const api = express.Router();

/**
 * Generate a UCP profile
 * POST /v1/profiles/generate
 */
api.post('/profiles/generate', async (req: Request, res: Response) => {
  try {
    const input: GeneratorInput = req.body;

    // Validate required fields
    if (!input.merchant?.merchantId || !input.merchant?.primaryDomain) {
      return res.status(400).json({
        error: 'Missing required fields: merchant.merchantId and merchant.primaryDomain',
      });
    }

    if (!input.transport?.rest?.endpoint) {
      return res.status(400).json({
        error: 'Missing required field: transport.rest.endpoint',
      });
    }

    // Set defaults
    input.capabilities = input.capabilities || { checkout: true, order: false, fulfillment: false, discount: false };

    const result = await buildProfile(input);

    res.json({
      profile: result.profile,
      signing_key_pair: result.signingKeyPair ? {
        public_key: result.signingKeyPair.publicKey,
        private_key_pem: result.signingKeyPair.privateKey,
      } : undefined,
    });
  } catch (error) {
    logger.error({ error }, 'Profile generation failed');
    res.status(500).json({ error: 'Failed to generate profile' });
  }
});

/**
 * Generate minimal profile
 * POST /v1/profiles/generate-minimal
 */
api.post('/profiles/generate-minimal', (req: Request, res: Response) => {
  try {
    const { endpoint, version } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing required field: endpoint' });
    }

    const profile = generateMinimalProfile(endpoint, version);
    res.json({ profile });
  } catch (error) {
    logger.error({ error }, 'Minimal profile generation failed');
    res.status(500).json({ error: 'Failed to generate minimal profile' });
  }
});

/**
 * Validate a profile (from request body)
 * POST /v1/profiles/validate
 */
api.post('/profiles/validate', async (req: Request, res: Response) => {
  try {
    const { profile, options } = req.body as {
      profile: unknown;
      options?: ValidationOptions;
    };

    if (!profile) {
      return res.status(400).json({ error: 'Missing required field: profile' });
    }

    const report = await validateProfile(profile, options || {});
    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Profile validation failed');
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * Quick validate (structural + rules only)
 * POST /v1/profiles/validate-quick
 */
api.post('/profiles/validate-quick', (req: Request, res: Response) => {
  try {
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({ error: 'Missing required field: profile' });
    }

    const report = validateQuick(profile);
    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Quick validation failed');
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * Validate remote profile
 * POST /v1/profiles/validate-remote
 */
api.post('/profiles/validate-remote', async (req: Request, res: Response) => {
  try {
    const { domain, options } = req.body as {
      domain: string;
      options?: ValidationOptions;
    };

    if (!domain) {
      return res.status(400).json({ error: 'Missing required field: domain' });
    }

    const report = await validateRemote(domain, options || {});
    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Remote validation failed');
    res.status(500).json({ error: 'Remote validation failed' });
  }
});

/**
 * Validate JSON string
 * POST /v1/profiles/validate-json
 */
api.post('/profiles/validate-json', async (req: Request, res: Response) => {
  try {
    const { json, options } = req.body as {
      json: string;
      options?: ValidationOptions;
    };

    if (!json) {
      return res.status(400).json({ error: 'Missing required field: json' });
    }

    const report = await validateJsonString(json, options || {});
    res.json(report);
  } catch (error) {
    logger.error({ error }, 'JSON validation failed');
    res.status(500).json({ error: 'Validation failed' });
  }
});

/**
 * Generate hosting artifacts
 * POST /v1/hosting/artifacts
 */
api.post('/hosting/artifacts', (req: Request, res: Response) => {
  try {
    const { config, profile_json } = req.body as {
      config: HostingConfig;
      profile_json: string;
    };

    if (!config?.merchantId || !config?.merchantDomain || !config?.mode) {
      return res.status(400).json({
        error: 'Missing required config fields: merchantId, merchantDomain, mode',
      });
    }

    if (!profile_json) {
      return res.status(400).json({ error: 'Missing required field: profile_json' });
    }

    const artifacts = generateHostingArtifacts(config, profile_json);
    res.json({ artifacts });
  } catch (error) {
    logger.error({ error }, 'Artifact generation failed');
    res.status(500).json({ error: 'Failed to generate artifacts' });
  }
});

/**
 * Hosted profile endpoint (for edge worker proxying)
 * GET /hosted/:merchantId/ucp.json
 */
api.get('/hosted/:merchantId/ucp.json', async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  // TODO: Implement database lookup for stored profiles
  // For now, return 404 as this requires database integration
  res.status(404).json({
    error: 'Profile not found',
    hint: 'This endpoint requires database integration. Use /v1/profiles/generate to create profiles.',
  });
});

// Mount API routes
app.use('/v1', api);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ error: err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'UCP Profile Manager API started');
  });
}

export { app };
