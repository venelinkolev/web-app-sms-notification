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

export interface ErrorHandlingConfig {
    enableConsoleLogging: boolean;
    enableErrorReporting: boolean;
    maxRetries: number;
    retryDelay: number;
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