// src/environments/environment.interface.ts

export interface SMSApiConfig {
    baseUrl: string;
    token: string;
    sender: string;
    rateLimitPerSecond: number;
    retryAttempts: number;
    timeoutMs: number;
    batchSize: number;

    characterLimits: {
        standard: number;
        unicode: number;
        concat: {
            standard: number;
            unicode: number;
        };
    };

    testMode: boolean;
    testPhoneNumber?: string;
}

export interface AppConfig {
    name: string;
    version: string;
    description: string;

    features: {
        bulkSend: boolean;
        templateEditor: boolean;
        progressTracking: boolean;
        errorReporting: boolean;
        fileValidation: boolean;
    };

    ui: {
        maxFileSize: number;
        tablePageSize: number;
        animationDuration: number;
    };
}

/**
 * Retry strategy configuration per error type
 */
export interface RetryStrategyConfig {
    /** Strategy name/identifier */
    name: string;

    /** Maximum retry attempts for this strategy */
    maxAttempts: number;

    /** Base delay in milliseconds */
    baseDelay: number;

    /** Whether to use exponential backoff */
    useExponentialBackoff: boolean;

    /** Backoff multiplier (default: 2) */
    backoffMultiplier?: number;

    /** Maximum delay cap in milliseconds */
    maxDelay: number;

    /** Error codes that use this strategy */
    errorCodes: number[];
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    /** Enable circuit breaker */
    enabled: boolean;

    /** Number of consecutive failures before opening circuit */
    failureThreshold: number;

    /** Time to wait before attempting half-open state (ms) */
    resetTimeout: number;

    /** Number of successful requests needed to close circuit */
    successThreshold: number;

    /** Whether to log circuit breaker state changes */
    logStateChanges: boolean;
}

/**
 * Retry queue configuration
 */
export interface RetryQueueConfig {
    /** Enable retry queue */
    enabled: boolean;

    /** Maximum queue size */
    maxSize: number;

    /** Queue processing interval (ms) */
    processingInterval: number;

    /** Whether to prioritize by error severity */
    prioritizeBySeverity: boolean;
}

// UPDATE the ErrorHandlingConfig interface:
export interface ErrorHandlingConfig {
    enableConsoleLogging: boolean;
    enableErrorReporting: boolean;
    maxRetries: number;
    retryDelay: number;

    /** Retry strategies per error type (NEW) */
    retryStrategies?: {
        rateLimitStrategy: RetryStrategyConfig;
        serverErrorStrategy: RetryStrategyConfig;
        overloadStrategy: RetryStrategyConfig;
        defaultStrategy: RetryStrategyConfig;
    };

    /** Circuit breaker settings (NEW) */
    circuitBreaker?: CircuitBreakerConfig;

    /** Retry queue settings (NEW) */
    retryQueue?: RetryQueueConfig;
}

export interface DevelopmentConfig {
    enableDebugMode: boolean;
    mockApiResponses: boolean;
    showDetailedErrors: boolean;
}

export interface ProductionSpecificConfig {
    enableDebugMode: boolean;
    mockApiResponses: boolean;
    showDetailedErrors: boolean;

    security: {
        tokenRotationDays: number;
        ipWhitelisting: boolean;
        rateLimitStrict: boolean;
    };

    performance: {
        enableCaching: boolean;
        cacheTimeout: number;
        enableCompression: boolean;
    };
}

export interface Environment {
    production: boolean;
    smsApi: SMSApiConfig;
    app: AppConfig;
    errorHandling: ErrorHandlingConfig;
    development?: DevelopmentConfig;
    productionSettings?: ProductionSpecificConfig; // Renamed to avoid conflict
}