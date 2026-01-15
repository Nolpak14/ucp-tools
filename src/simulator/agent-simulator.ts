/**
 * AI Agent Simulator
 * Simulates how an AI agent discovers and interacts with UCP-enabled merchants
 * 
 * The goal is to test real-world functionality, not just spec compliance.
 * This proves that a UCP implementation actually works for AI agent commerce.
 */

import type { UcpProfile, UcpCapability, UcpService } from '../types/ucp-profile.js';
import type {
    AgentSimulationResult,
    SimulationOptions,
    SimulationStepResult,
    SimulationStepStatus,
    DiscoveryFlowResult,
    CapabilityInspectionResult,
    ServiceInspectionResult,
    RestApiSimulationResult,
    CheckoutSimulationResult,
    PaymentReadinessResult,
    OperationTestResult,
    DEFAULT_SIMULATION_OPTIONS,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_FETCH_TIMEOUT_MS = 10000;

/**
 * Step builder helper
 */
function createStep(
    step: string,
    status: SimulationStepStatus,
    message: string,
    details?: string,
    durationMs?: number,
    data?: Record<string, unknown>
): SimulationStepResult {
    return { step, status, message, details, durationMs, data };
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
    url: string,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'UCP-Agent-Simulator/1.0',
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return { ok: false, status: response.status, error: `HTTP ${response.status}` };
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return { ok: true, status: response.status, data };
        }

        return { ok: true, status: response.status };
    } catch (error) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { ok: false, error: message };
    }
}

/**
 * HEAD request to check endpoint responsiveness
 */
async function checkEndpointResponsive(
    url: string,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<{ ok: boolean; status?: number; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'UCP-Agent-Simulator/1.0',
            },
        });

        clearTimeout(timeoutId);
        // Accept various success codes - we just want to know endpoint exists
        return { ok: response.status < 500, status: response.status };
    } catch (error) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { ok: false, error: message };
    }
}

/**
 * Simulate discovery flow - how an AI agent discovers a UCP merchant
 */
export async function simulateDiscoveryFlow(
    domain: string,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<DiscoveryFlowResult> {
    const steps: SimulationStepResult[] = [];
    let profileUrl: string | undefined;
    let profile: UcpProfile | null = null;
    const capabilities: string[] = [];
    const services: string[] = [];
    const transports: string[] = [];

    // Step 1: Try to fetch /.well-known/ucp
    const startTime = Date.now();
    const urls = [
        `https://${domain}/.well-known/ucp`,
        `https://${domain}/.well-known/ucp.json`,
    ];

    let foundProfile = false;
    for (const url of urls) {
        const fetchStart = Date.now();
        const result = await fetchWithTimeout(url, timeoutMs);
        const fetchDuration = Date.now() - fetchStart;

        if (result.ok && result.data && typeof result.data === 'object') {
            const data = result.data as Record<string, unknown>;
            if (data.ucp) {
                profile = data as UcpProfile;
                profileUrl = url;
                foundProfile = true;
                steps.push(createStep(
                    'discover_profile',
                    'passed',
                    `Found UCP profile at ${url}`,
                    `Response time: ${fetchDuration}ms`,
                    fetchDuration,
                    { url, responseTime: fetchDuration }
                ));
                break;
            }
        }
    }

    if (!foundProfile) {
        steps.push(createStep(
            'discover_profile',
            'failed',
            'Could not find UCP profile',
            `Tried: ${urls.join(', ')}`
        ));
        return { success: false, steps, capabilities, services, transports };
    }

    // Step 2: Parse UCP version
    if (profile?.ucp?.version) {
        steps.push(createStep(
            'parse_version',
            'passed',
            `UCP version: ${profile.ucp.version}`,
            undefined,
            undefined,
            { version: profile.ucp.version }
        ));
    } else {
        steps.push(createStep(
            'parse_version',
            'failed',
            'Missing UCP version',
            'AI agent cannot determine protocol version'
        ));
    }

    // Step 3: Enumerate services
    const serviceEntries = Object.entries(profile?.ucp?.services || {});
    if (serviceEntries.length > 0) {
        for (const [serviceName, service] of serviceEntries) {
            services.push(serviceName);

            // Track transports
            if ((service as UcpService).rest) transports.push('rest');
            if ((service as UcpService).mcp) transports.push('mcp');
            if ((service as UcpService).a2a) transports.push('a2a');
            if ((service as UcpService).embedded) transports.push('embedded');
        }

        steps.push(createStep(
            'enumerate_services',
            'passed',
            `Found ${serviceEntries.length} service(s): ${services.join(', ')}`,
            `Available transports: ${[...new Set(transports)].join(', ')}`,
            undefined,
            { services, transports: [...new Set(transports)] }
        ));
    } else {
        steps.push(createStep(
            'enumerate_services',
            'failed',
            'No services found',
            'AI agent has no entry point for commerce operations'
        ));
    }

    // Step 4: Enumerate capabilities
    const capList = profile?.ucp?.capabilities || [];
    if (capList.length > 0) {
        for (const cap of capList) {
            capabilities.push(cap.name);
        }

        // Check for required checkout capability
        const hasCheckout = capabilities.some(c => c.includes('checkout'));
        const hasOrder = capabilities.some(c => c.includes('order'));

        steps.push(createStep(
            'enumerate_capabilities',
            'passed',
            `Found ${capList.length} capability/ies: ${capabilities.join(', ')}`,
            hasCheckout ? 'Checkout capability present - commerce ready' : 'No checkout capability - limited commerce support',
            undefined,
            { capabilities, hasCheckout, hasOrder }
        ));
    } else {
        steps.push(createStep(
            'enumerate_capabilities',
            'warning',
            'No capabilities declared',
            'AI agent cannot determine supported operations'
        ));
    }

    const totalDuration = Date.now() - startTime;

    return {
        success: foundProfile && serviceEntries.length > 0,
        steps,
        profileUrl,
        capabilities,
        services,
        transports: [...new Set(transports)],
    };
}

/**
 * Inspect capabilities in detail
 */
export async function inspectCapabilities(
    profile: UcpProfile,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<CapabilityInspectionResult[]> {
    const results: CapabilityInspectionResult[] = [];
    const capList = profile.ucp?.capabilities || [];

    for (const cap of capList) {
        let schemaAccessible = false;
        let specAccessible = false;

        // Check schema URL
        if (cap.schema) {
            const schemaResult = await fetchWithTimeout(cap.schema, timeoutMs);
            schemaAccessible = schemaResult.ok;
        }

        // Check spec URL
        if (cap.spec) {
            const specResult = await checkEndpointResponsive(cap.spec, timeoutMs);
            specAccessible = specResult.ok;
        }

        results.push({
            name: cap.name,
            version: cap.version,
            schemaAccessible,
            specAccessible,
            isExtension: !!cap.extends,
            parentCapability: cap.extends,
        });
    }

    return results;
}

/**
 * Inspect services and their transports
 */
export async function inspectServices(
    profile: UcpProfile,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<ServiceInspectionResult[]> {
    const results: ServiceInspectionResult[] = [];
    const serviceEntries = Object.entries(profile.ucp?.services || {});

    for (const [name, service] of serviceEntries) {
        const svc = service as UcpService;
        const result: ServiceInspectionResult = {
            name,
            version: svc.version,
            transports: {},
        };

        // Check REST transport
        if (svc.rest) {
            const schemaCheck = svc.rest.schema
                ? await fetchWithTimeout(svc.rest.schema, timeoutMs)
                : { ok: false };
            const endpointCheck = await checkEndpointResponsive(svc.rest.endpoint, timeoutMs);

            result.transports.rest = {
                endpoint: svc.rest.endpoint,
                schemaAccessible: schemaCheck.ok,
                endpointResponsive: endpointCheck.ok,
            };
        }

        // Check MCP transport
        if (svc.mcp) {
            const schemaCheck = svc.mcp.schema
                ? await fetchWithTimeout(svc.mcp.schema, timeoutMs)
                : { ok: false };

            result.transports.mcp = {
                endpoint: svc.mcp.endpoint,
                schemaAccessible: schemaCheck.ok,
            };
        }

        // Check A2A transport
        if (svc.a2a) {
            const agentCardCheck = await fetchWithTimeout(svc.a2a.agentCard, timeoutMs);

            result.transports.a2a = {
                agentCard: svc.a2a.agentCard,
                agentCardAccessible: agentCardCheck.ok,
            };
        }

        results.push(result);
    }

    return results;
}

/**
 * Simulate REST API interaction
 */
export async function simulateRestApi(
    profile: UcpProfile,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<RestApiSimulationResult> {
    const steps: SimulationStepResult[] = [];
    const sampleOperations: OperationTestResult[] = [];
    let schemaLoaded = false;
    let endpointAccessible = false;

    // Find REST service
    const shoppingService = profile.ucp?.services?.['dev.ucp.shopping'] as UcpService | undefined;
    if (!shoppingService?.rest) {
        steps.push(createStep(
            'find_rest_service',
            'skipped',
            'No REST service configured',
            'Merchant may use MCP or A2A transport instead'
        ));
        return { success: false, steps, schemaLoaded, endpointAccessible, sampleOperations };
    }

    // Step 1: Load OpenAPI schema
    if (shoppingService.rest.schema) {
        const schemaStart = Date.now();
        const schemaResult = await fetchWithTimeout(shoppingService.rest.schema, timeoutMs);
        const schemaDuration = Date.now() - schemaStart;

        if (schemaResult.ok && schemaResult.data) {
            schemaLoaded = true;
            const schema = schemaResult.data as Record<string, unknown>;

            steps.push(createStep(
                'load_openapi_schema',
                'passed',
                `Loaded OpenAPI schema from ${shoppingService.rest.schema}`,
                `Response time: ${schemaDuration}ms`,
                schemaDuration,
                { schemaUrl: shoppingService.rest.schema }
            ));

            // Check for expected paths in schema
            const paths = schema.paths as Record<string, unknown> | undefined;
            if (paths) {
                const pathCount = Object.keys(paths).length;
                steps.push(createStep(
                    'analyze_schema_paths',
                    pathCount > 0 ? 'passed' : 'warning',
                    `Schema defines ${pathCount} operation path(s)`,
                    pathCount > 0 ? `Paths: ${Object.keys(paths).slice(0, 5).join(', ')}${pathCount > 5 ? '...' : ''}` : undefined
                ));
            }
        } else {
            steps.push(createStep(
                'load_openapi_schema',
                'failed',
                'Could not load OpenAPI schema',
                schemaResult.error || 'Unknown error'
            ));
        }
    } else {
        steps.push(createStep(
            'load_openapi_schema',
            'warning',
            'No schema URL provided',
            'AI agent cannot discover available operations'
        ));
    }

    // Step 2: Check endpoint responsiveness
    const endpointStart = Date.now();
    const endpointResult = await checkEndpointResponsive(shoppingService.rest.endpoint, timeoutMs);
    const endpointDuration = Date.now() - endpointStart;

    if (endpointResult.ok) {
        endpointAccessible = true;
        steps.push(createStep(
            'check_endpoint',
            'passed',
            `REST endpoint responsive: ${shoppingService.rest.endpoint}`,
            `Status: ${endpointResult.status}, Response time: ${endpointDuration}ms`,
            endpointDuration
        ));
    } else {
        steps.push(createStep(
            'check_endpoint',
            'failed',
            `REST endpoint not accessible: ${shoppingService.rest.endpoint}`,
            endpointResult.error || `Status: ${endpointResult.status}`
        ));
    }

    return {
        success: schemaLoaded && endpointAccessible,
        steps,
        schemaLoaded,
        endpointAccessible,
        sampleOperations,
    };
}

/**
 * Simulate checkout flow capability
 */
export async function simulateCheckoutFlow(
    profile: UcpProfile,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<CheckoutSimulationResult> {
    const steps: SimulationStepResult[] = [];
    let canCreateCheckout = false;
    let checkoutSchemaValid = false;
    let orderFlowSupported = false;
    let fulfillmentSupported = false;

    const capabilities = profile.ucp?.capabilities || [];

    // Check for checkout capability
    const checkoutCap = capabilities.find(c => c.name.includes('checkout'));
    if (checkoutCap) {
        canCreateCheckout = true;
        steps.push(createStep(
            'find_checkout_capability',
            'passed',
            `Found checkout capability: ${checkoutCap.name}`,
            `Version: ${checkoutCap.version}`
        ));

        // Validate checkout schema
        if (checkoutCap.schema) {
            const schemaResult = await fetchWithTimeout(checkoutCap.schema, timeoutMs);
            if (schemaResult.ok && schemaResult.data) {
                checkoutSchemaValid = true;
                const schema = schemaResult.data as Record<string, unknown>;

                // Check for required checkout properties
                const properties = (schema.properties || schema.$defs) as Record<string, unknown> | undefined;
                const hasCheckoutProps = properties && (
                    properties.checkout_id ||
                    properties.items ||
                    properties.CheckoutSession
                );

                steps.push(createStep(
                    'validate_checkout_schema',
                    hasCheckoutProps ? 'passed' : 'warning',
                    `Checkout schema ${hasCheckoutProps ? 'has expected structure' : 'loaded but structure unclear'}`,
                    hasCheckoutProps ? 'AI agent can create checkout sessions' : 'Schema may need review'
                ));
            } else {
                steps.push(createStep(
                    'validate_checkout_schema',
                    'failed',
                    'Could not load checkout schema',
                    schemaResult.error || 'Unknown error'
                ));
            }
        }
    } else {
        steps.push(createStep(
            'find_checkout_capability',
            'failed',
            'No checkout capability found',
            'AI agent cannot create checkout sessions'
        ));
    }

    // Check for order capability
    const orderCap = capabilities.find(c => c.name.includes('order'));
    if (orderCap) {
        orderFlowSupported = true;
        steps.push(createStep(
            'find_order_capability',
            'passed',
            `Found order capability: ${orderCap.name}`,
            'AI agent can track order status'
        ));
    } else {
        steps.push(createStep(
            'find_order_capability',
            'warning',
            'No order capability found',
            'Order tracking may not be available'
        ));
    }

    // Check for fulfillment capability
    const fulfillmentCap = capabilities.find(c => c.name.includes('fulfillment'));
    if (fulfillmentCap) {
        fulfillmentSupported = true;
        steps.push(createStep(
            'find_fulfillment_capability',
            'passed',
            `Found fulfillment capability: ${fulfillmentCap.name}`,
            'AI agent can track shipping and delivery'
        ));
    } else {
        steps.push(createStep(
            'find_fulfillment_capability',
            'info' as SimulationStepStatus,
            'No fulfillment capability found',
            'Fulfillment tracking not available via UCP'
        ));
    }

    return {
        success: canCreateCheckout && checkoutSchemaValid,
        steps,
        canCreateCheckout,
        checkoutSchemaValid,
        orderFlowSupported,
        fulfillmentSupported,
    };
}

/**
 * Check payment readiness
 */
export async function simulatePaymentReadiness(
    profile: UcpProfile,
    timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<PaymentReadinessResult> {
    const steps: SimulationStepResult[] = [];
    let handlersFound = 0;
    let webhookVerifiable = false;
    let signingKeyValid = false;

    // Check payment handlers
    const handlers = profile.payment?.handlers || [];
    handlersFound = handlers.length;

    if (handlersFound > 0) {
        const handlerNames = handlers.map(h => h.name).join(', ');
        steps.push(createStep(
            'find_payment_handlers',
            'passed',
            `Found ${handlersFound} payment handler(s): ${handlerNames}`,
            'AI agent can initiate payments'
        ));

        // Check handler configs
        for (const handler of handlers) {
            if (handler.config_schema) {
                const schemaResult = await checkEndpointResponsive(handler.config_schema, timeoutMs);
                steps.push(createStep(
                    `check_handler_${handler.id}`,
                    schemaResult.ok ? 'passed' : 'warning',
                    `Payment handler "${handler.name}" config schema ${schemaResult.ok ? 'accessible' : 'not accessible'}`,
                    handler.config_schema
                ));
            }
        }
    } else {
        steps.push(createStep(
            'find_payment_handlers',
            'warning',
            'No payment handlers configured',
            'Payment processing may use external flow'
        ));
    }

    // Check signing keys for webhook verification
    const signingKeys = profile.signing_keys;
    if (signingKeys && Array.isArray(signingKeys) && signingKeys.length > 0) {
        webhookVerifiable = true;

        // Validate key structure
        const validKeys = signingKeys.filter(key =>
            key.kty && key.kid && (
                (key.kty === 'EC' && key.crv && key.x && key.y) ||
                (key.kty === 'RSA' && key.n && key.e)
            )
        );

        signingKeyValid = validKeys.length > 0;

        steps.push(createStep(
            'check_signing_keys',
            signingKeyValid ? 'passed' : 'warning',
            `Found ${signingKeys.length} signing key(s), ${validKeys.length} valid`,
            signingKeyValid
                ? 'AI agent can verify webhook signatures'
                : 'Signing keys present but may be incomplete'
        ));
    } else {
        steps.push(createStep(
            'check_signing_keys',
            'warning',
            'No signing keys found',
            'Webhook verification not available'
        ));
    }

    return {
        success: handlersFound > 0 || webhookVerifiable,
        steps,
        handlersFound,
        webhookVerifiable,
        signingKeyValid,
    };
}

/**
 * Generate recommendations based on simulation results
 */
function generateRecommendations(
    discovery: DiscoveryFlowResult,
    capabilities: CapabilityInspectionResult[],
    services: ServiceInspectionResult[],
    restApi?: RestApiSimulationResult,
    checkout?: CheckoutSimulationResult,
    payment?: PaymentReadinessResult
): string[] {
    const recommendations: string[] = [];

    // Discovery issues
    if (!discovery.success) {
        recommendations.push('Ensure UCP profile is accessible at /.well-known/ucp');
    }

    // Service issues
    if (discovery.services.length === 0) {
        recommendations.push('Add at least one service (e.g., dev.ucp.shopping) to enable commerce');
    }

    // Transport issues
    if (discovery.transports.length === 0) {
        recommendations.push('Configure at least one transport binding (REST, MCP, or A2A)');
    }

    // Capability issues
    const inaccessibleSchemas = capabilities.filter(c => !c.schemaAccessible);
    if (inaccessibleSchemas.length > 0) {
        recommendations.push(`Fix inaccessible capability schemas: ${inaccessibleSchemas.map(c => c.name).join(', ')}`);
    }

    // REST API issues
    if (restApi && !restApi.schemaLoaded) {
        recommendations.push('Provide accessible OpenAPI schema for REST service');
    }
    if (restApi && !restApi.endpointAccessible) {
        recommendations.push('Ensure REST endpoint is publicly accessible');
    }

    // Checkout issues
    if (checkout && !checkout.canCreateCheckout) {
        recommendations.push('Add checkout capability (dev.ucp.shopping.checkout) to enable purchases');
    }
    if (checkout && checkout.canCreateCheckout && !checkout.checkoutSchemaValid) {
        recommendations.push('Ensure checkout schema is accessible and valid');
    }

    // Payment issues
    if (payment && payment.handlersFound === 0) {
        recommendations.push('Configure payment handlers in the profile');
    }
    if (payment && !payment.signingKeyValid) {
        recommendations.push('Add valid signing keys (EC or RSA JWK) for webhook verification');
    }

    // Add positive note if everything looks good
    if (recommendations.length === 0) {
        recommendations.push('Profile is well-configured for AI agent commerce!');
    }

    return recommendations;
}

/**
 * Calculate overall AI readiness score
 */
function calculateScore(
    discovery: DiscoveryFlowResult,
    capabilities: CapabilityInspectionResult[],
    services: ServiceInspectionResult[],
    restApi?: RestApiSimulationResult,
    checkout?: CheckoutSimulationResult,
    payment?: PaymentReadinessResult
): number {
    let score = 0;
    const maxScore = 100;

    // Discovery (25 points)
    if (discovery.success) score += 15;
    if (discovery.services.length > 0) score += 5;
    if (discovery.capabilities.length > 0) score += 5;

    // Capabilities (25 points)
    const accessibleCapabilities = capabilities.filter(c => c.schemaAccessible);
    if (capabilities.length > 0) {
        score += Math.round((accessibleCapabilities.length / capabilities.length) * 15);
    }
    // Bonus for having checkout
    if (capabilities.some(c => c.name.includes('checkout'))) score += 10;

    // Services & Transport (25 points)
    for (const service of services) {
        if (service.transports.rest?.endpointResponsive) score += 10;
        if (service.transports.rest?.schemaAccessible) score += 5;
        if (service.transports.mcp) score += 5;
        if (service.transports.a2a?.agentCardAccessible) score += 5;
    }
    // Cap at 25
    score = Math.min(score, 75);

    // Checkout (15 points)
    if (checkout?.canCreateCheckout) score += 8;
    if (checkout?.checkoutSchemaValid) score += 4;
    if (checkout?.orderFlowSupported) score += 3;

    // Payment (10 points)
    if (payment?.handlersFound || 0 > 0) score += 5;
    if (payment?.signingKeyValid) score += 5;

    return Math.min(score, maxScore);
}

/**
 * Main simulation entry point
 * Simulates a complete AI agent interaction with a UCP-enabled merchant
 */
export async function simulateAgentInteraction(
    domain: string,
    options: SimulationOptions = {}
): Promise<AgentSimulationResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const fetchTimeout = Math.min(timeoutMs / 3, DEFAULT_FETCH_TIMEOUT_MS);

    // Step 1: Discovery flow
    const discovery = await simulateDiscoveryFlow(domain, fetchTimeout);

    // Early exit if discovery failed
    if (!discovery.success || !discovery.profileUrl) {
        const durationMs = Date.now() - startTime;
        return {
            ok: false,
            domain,
            simulatedAt: new Date().toISOString(),
            durationMs,
            overallScore: 0,
            discovery,
            capabilities: [],
            services: [],
            summary: {
                totalSteps: discovery.steps.length,
                passedSteps: discovery.steps.filter(s => s.status === 'passed').length,
                failedSteps: discovery.steps.filter(s => s.status === 'failed').length,
                warningSteps: discovery.steps.filter(s => s.status === 'warning').length,
                skippedSteps: discovery.steps.filter(s => s.status === 'skipped').length,
            },
            recommendations: ['Ensure UCP profile is accessible at /.well-known/ucp or /.well-known/ucp.json'],
        };
    }

    // Fetch full profile for detailed inspection
    const profileResult = await fetchWithTimeout(discovery.profileUrl, fetchTimeout);
    const profile = profileResult.data as UcpProfile;

    // Step 2: Inspect capabilities
    const capabilities = await inspectCapabilities(profile, fetchTimeout);

    // Step 3: Inspect services
    const services = await inspectServices(profile, fetchTimeout);

    // Step 4: REST API simulation (if applicable)
    let restApi: RestApiSimulationResult | undefined;
    if (!options.skipRestApiTest) {
        restApi = await simulateRestApi(profile, fetchTimeout);
    }

    // Step 5: Checkout flow simulation
    let checkout: CheckoutSimulationResult | undefined;
    if (options.testCheckoutFlow !== false) {
        checkout = await simulateCheckoutFlow(profile, fetchTimeout);
    }

    // Step 6: Payment readiness check
    const payment = await simulatePaymentReadiness(profile, fetchTimeout);

    // Collect all steps
    const allSteps = [
        ...discovery.steps,
        ...(restApi?.steps || []),
        ...(checkout?.steps || []),
        ...payment.steps,
    ];

    const durationMs = Date.now() - startTime;

    // Generate recommendations
    const recommendations = generateRecommendations(
        discovery, capabilities, services, restApi, checkout, payment
    );

    // Calculate score
    const overallScore = calculateScore(
        discovery, capabilities, services, restApi, checkout, payment
    );

    return {
        ok: discovery.success && (checkout?.success ?? true),
        domain,
        simulatedAt: new Date().toISOString(),
        durationMs,
        overallScore,
        discovery,
        capabilities,
        services,
        restApi,
        checkout,
        payment,
        summary: {
            totalSteps: allSteps.length,
            passedSteps: allSteps.filter(s => s.status === 'passed').length,
            failedSteps: allSteps.filter(s => s.status === 'failed').length,
            warningSteps: allSteps.filter(s => s.status === 'warning').length,
            skippedSteps: allSteps.filter(s => s.status === 'skipped').length,
        },
        recommendations,
    };
}

// Export helper functions for testing
export {
    fetchWithTimeout,
    checkEndpointResponsive,
    generateRecommendations,
    calculateScore,
};
