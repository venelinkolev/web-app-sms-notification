// src/environments/environment.prod.ts
import type { Environment } from './environment.interface';

export const environment: Environment = {
    production: true,

    // SMS API Configuration (SMSApi.bg)
    smsApi: {
        baseUrl: 'https://api.smsapi.bg/',
        token: '', // TODO: Set via environment variables (process.env['SMS_API_TOKEN'])
        sender: 'YanakSoft', // Production sender name (must be verified)
        rateLimitPerSecond: 100,
        retryAttempts: 5,
        timeoutMs: 30000,
        batchSize: 1000,

        // Character limits
        characterLimits: {
            standard: 160,
            unicode: 70,
            concat: {
                standard: 153,
                unicode: 67
            }
        },

        // Production configuration
        testMode: false,
        testPhoneNumber: '' // No test numbers in production
    },

    // Application Settings
    app: {
        name: 'SMS Notification Application',
        version: '1.0.0',
        description: 'Personal SMS notification system for contract expiry alerts',

        // Feature flags
        features: {
            bulkSend: true,
            templateEditor: true,
            progressTracking: true,
            errorReporting: true,
            fileValidation: true
        },

        // UI Configuration
        ui: {
            maxFileSize: 10485760, // 10MB in bytes
            tablePageSize: 100, // More items per page in production
            animationDuration: 200 // Faster animations in production
        }
    },

    // Error Handling & Logging
    errorHandling: {
        enableConsoleLogging: false,      // Disable in production
        enableErrorReporting: true,       // Enable error reporting
        maxRetries: 5,                    // More retries in production
        retryDelay: 2000,                 // Longer delays

        // ===== NEW: Production Retry Strategies =====
        retryStrategies: {
            // Rate limit: More patient in production
            rateLimitStrategy: {
                name: 'Rate Limit Strategy',
                maxAttempts: 8,            // More attempts
                baseDelay: 3000,           // Start with 3 seconds
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 120000,          // Max 2 minutes
                errorCodes: [429]
            },

            // Server errors: More aggressive retry
            serverErrorStrategy: {
                name: 'Server Error Strategy',
                maxAttempts: 5,            // More attempts
                baseDelay: 2000,           // Longer initial delay
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 30000,           // Max 30 seconds
                errorCodes: [500, 502, 503, 504]
            },

            // Overload: Patient retry
            overloadStrategy: {
                name: 'Overload Strategy',
                maxAttempts: 6,            // More attempts
                baseDelay: 1000,           // 1 second
                useExponentialBackoff: false,
                maxDelay: 5000,            // Max 5 seconds
                errorCodes: [201, 202]
            },

            // Default: Conservative
            defaultStrategy: {
                name: 'Default Strategy',
                maxAttempts: 5,
                baseDelay: 2000,
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 30000,
                errorCodes: []
            }
        },

        // ===== Production Circuit Breaker =====
        circuitBreaker: {
            enabled: true,
            failureThreshold: 10,          // More tolerant in production
            resetTimeout: 60000,           // Wait 1 minute
            successThreshold: 3,           // Need 3 successes
            logStateChanges: true
        },

        // ===== Production Retry Queue =====
        retryQueue: {
            enabled: true,
            maxSize: 500,                  // Larger queue
            processingInterval: 2000,      // Check every 2s
            prioritizeBySeverity: true
        }
    },

    // Production specific settings (renamed from 'production' to avoid conflict)
    productionSettings: {
        enableDebugMode: false,
        mockApiResponses: false,
        showDetailedErrors: false, // Hide detailed errors from users

        // Security settings
        security: {
            tokenRotationDays: 30,
            ipWhitelisting: true,
            rateLimitStrict: true
        },

        // Performance settings
        performance: {
            enableCaching: true,
            cacheTimeout: 300000, // 5 minutes
            enableCompression: true
        }
    }
};