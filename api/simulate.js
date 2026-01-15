/**
 * Vercel Serverless Function: AI Agent Simulation
 * POST /api/simulate
 *
 * Simulates how an AI agent would interact with a UCP-enabled merchant.
 * Tests real-world functionality, not just spec compliance.
 *
 * Request body:
 *   { "domain": "example.com", "options"?: { ... } }
 *
 * Response:
 *   Complete simulation result including discovery, capabilities,
 *   services, checkout flow, and payment readiness.
 */

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Use POST to simulate AI agent interaction',
        });
    }

    try {
        const { domain, options = {} } = req.body || {};

        if (!domain) {
            return res.status(400).json({
                error: 'Missing domain',
                message: 'Please provide a domain to simulate',
            });
        }

        // Clean domain
        const cleanDomain = domain
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
            .toLowerCase()
            .trim();

        if (!cleanDomain) {
            return res.status(400).json({
                error: 'Invalid domain',
                message: 'Please provide a valid domain',
            });
        }

        // Dynamic import of the simulator
        const { simulateAgentInteraction } = await import('../src/simulator/index.js');

        // Run simulation with timeout
        const simulationOptions = {
            timeoutMs: options.timeoutMs || 30000,
            skipRestApiTest: options.skipRestApiTest || false,
            skipSchemaValidation: options.skipSchemaValidation || false,
            testCheckoutFlow: options.testCheckoutFlow !== false,
            verbose: options.verbose || false,
        };

        const result = await simulateAgentInteraction(cleanDomain, simulationOptions);

        // Build response
        const response = {
            ok: result.ok,
            domain: result.domain,
            simulated_at: result.simulatedAt,
            duration_ms: result.durationMs,

            // Score and grade
            score: result.overallScore,
            grade: getGrade(result.overallScore),

            // Summary
            summary: {
                total_steps: result.summary.totalSteps,
                passed: result.summary.passedSteps,
                failed: result.summary.failedSteps,
                warnings: result.summary.warningSteps,
                skipped: result.summary.skippedSteps,
            },

            // Discovery
            discovery: {
                success: result.discovery.success,
                profile_url: result.discovery.profileUrl,
                services: result.discovery.services,
                capabilities: result.discovery.capabilities,
                transports: result.discovery.transports,
                steps: result.discovery.steps,
            },

            // Capabilities
            capabilities: result.capabilities.map(cap => ({
                name: cap.name,
                version: cap.version,
                schema_accessible: cap.schemaAccessible,
                spec_accessible: cap.specAccessible,
                is_extension: cap.isExtension,
                parent: cap.parentCapability,
            })),

            // Services
            services: result.services.map(svc => ({
                name: svc.name,
                version: svc.version,
                transports: svc.transports,
            })),

            // REST API (if tested)
            rest_api: result.restApi ? {
                success: result.restApi.success,
                schema_loaded: result.restApi.schemaLoaded,
                endpoint_accessible: result.restApi.endpointAccessible,
                steps: result.restApi.steps,
            } : null,

            // Checkout flow (if tested)
            checkout: result.checkout ? {
                success: result.checkout.success,
                can_create_checkout: result.checkout.canCreateCheckout,
                checkout_schema_valid: result.checkout.checkoutSchemaValid,
                order_flow_supported: result.checkout.orderFlowSupported,
                fulfillment_supported: result.checkout.fulfillmentSupported,
                steps: result.checkout.steps,
            } : null,

            // Payment readiness
            payment: result.payment ? {
                success: result.payment.success,
                handlers_found: result.payment.handlersFound,
                webhook_verifiable: result.payment.webhookVerifiable,
                signing_key_valid: result.payment.signingKeyValid,
                steps: result.payment.steps,
            } : null,

            // Recommendations
            recommendations: result.recommendations,

            // Badge
            badge: {
                text: `AI Agent Ready: ${getGrade(result.overallScore)} (${result.overallScore}/100)`,
                color: getBadgeColor(result.overallScore),
            },
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Simulation error:', error);
        return res.status(500).json({
            error: 'Simulation failed',
            message: error.message || 'An unexpected error occurred',
        });
    }
}

/**
 * Get letter grade from score
 */
function getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

/**
 * Get badge color from score
 */
function getBadgeColor(score) {
    if (score >= 90) return 'brightgreen';
    if (score >= 80) return 'green';
    if (score >= 70) return 'yellowgreen';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
}
