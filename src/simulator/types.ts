/**
 * AI Agent Simulation Types
 * Types for simulating AI agent interactions with UCP merchants
 */

/**
 * Simulation step status
 */
export type SimulationStepStatus = 'passed' | 'failed' | 'skipped' | 'warning';

/**
 * Individual simulation step result
 */
export interface SimulationStepResult {
    step: string;
    status: SimulationStepStatus;
    message: string;
    details?: string;
    durationMs?: number;
    data?: Record<string, unknown>;
}

/**
 * Discovery flow simulation results
 */
export interface DiscoveryFlowResult {
    success: boolean;
    steps: SimulationStepResult[];
    profileUrl?: string;
    capabilities: string[];
    services: string[];
    transports: string[];
}

/**
 * Capability inspection result
 */
export interface CapabilityInspectionResult {
    name: string;
    version: string;
    schemaAccessible: boolean;
    specAccessible: boolean;
    isExtension: boolean;
    parentCapability?: string;
}

/**
 * Service inspection result
 */
export interface ServiceInspectionResult {
    name: string;
    version: string;
    transports: {
        rest?: {
            endpoint: string;
            schemaAccessible: boolean;
            endpointResponsive: boolean;
        };
        mcp?: {
            endpoint: string;
            schemaAccessible: boolean;
        };
        a2a?: {
            agentCard: string;
            agentCardAccessible: boolean;
        };
    };
}

/**
 * REST API simulation results
 */
export interface RestApiSimulationResult {
    success: boolean;
    steps: SimulationStepResult[];
    schemaLoaded: boolean;
    endpointAccessible: boolean;
    sampleOperations: OperationTestResult[];
}

/**
 * Operation test result from REST API
 */
export interface OperationTestResult {
    operation: string;
    method: string;
    path: string;
    status: SimulationStepStatus;
    message: string;
    responseCode?: number;
}

/**
 * Checkout simulation result
 */
export interface CheckoutSimulationResult {
    success: boolean;
    steps: SimulationStepResult[];
    canCreateCheckout: boolean;
    checkoutSchemaValid: boolean;
    orderFlowSupported: boolean;
    fulfillmentSupported: boolean;
}

/**
 * Payment readiness result
 */
export interface PaymentReadinessResult {
    success: boolean;
    steps: SimulationStepResult[];
    handlersFound: number;
    webhookVerifiable: boolean;
    signingKeyValid: boolean;
}

/**
 * Overall AI readiness simulation result
 */
export interface AgentSimulationResult {
    ok: boolean;
    domain: string;
    simulatedAt: string;
    durationMs: number;

    // Overall scores (0-100) and grade (A-F)
    overallScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';

    // Individual flow results
    discovery: DiscoveryFlowResult;
    capabilities: CapabilityInspectionResult[];
    services: ServiceInspectionResult[];
    restApi?: RestApiSimulationResult;
    checkout?: CheckoutSimulationResult;
    payment?: PaymentReadinessResult;

    // Summary
    summary: {
        totalSteps: number;
        passedSteps: number;
        failedSteps: number;
        warningSteps: number;
        skippedSteps: number;
    };

    // Recommendations
    recommendations: string[];
}

/**
 * Simulation options
 */
export interface SimulationOptions {
    timeoutMs?: number;
    skipRestApiTest?: boolean;
    skipSchemaValidation?: boolean;
    testCheckoutFlow?: boolean;
    verbose?: boolean;
}

/**
 * Default simulation options
 */
export const DEFAULT_SIMULATION_OPTIONS: Required<SimulationOptions> = {
    timeoutMs: 30000,
    skipRestApiTest: false,
    skipSchemaValidation: false,
    testCheckoutFlow: true,
    verbose: false,
};
