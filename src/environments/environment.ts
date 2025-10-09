export const environment = {
    production: false,

    // SMS API Configuration (SMSApi.bg)
    smsApi: {
        baseUrl: 'https://api.smsapi.bg/',
        token: '', // TODO: Add your test SMS API token here
        sender: 'Test', // Default sender name
        rateLimitPerSecond: 100,
        retryAttempts: 5,
        timeoutMs: 30000,
        batchSize: 1000, // Max recipients per batch

        // Character limits
        characterLimits: {
            standard: 160, // Standard SMS (GSM 7-bit)
            unicode: 70,   // Unicode SMS (UTF-8, Cyrillic)
            concat: {
                standard: 153, // Per part in concatenated SMS
                unicode: 67    // Per part in concatenated Unicode SMS
            }
        },

        // Test configuration
        testMode: true,
        testPhoneNumber: '359887378504' // Safe test number
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
            tablePageSize: 50,
            animationDuration: 300
        }
    },

    // Error Handling & Logging
    errorHandling: {
        enableConsoleLogging: true,
        enableErrorReporting: false,
        maxRetries: 3,
        retryDelay: 1000,

        // ===== NEW: Retry Strategies =====
        retryStrategies: {
            // Strategy for rate limit errors (429)
            rateLimitStrategy: {
                name: 'Rate Limit Strategy',
                maxAttempts: 5,
                baseDelay: 2000,           // Start with 2 seconds
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 60000,           // Max 60 seconds
                errorCodes: [429]
            },

            // Strategy for server errors (500+)
            serverErrorStrategy: {
                name: 'Server Error Strategy',
                maxAttempts: 3,
                baseDelay: 1000,           // Start with 1 second
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 10000,           // Max 10 seconds
                errorCodes: [500, 502, 503, 504]
            },

            // Strategy for overload errors (201, 202)
            overloadStrategy: {
                name: 'Overload Strategy',
                maxAttempts: 4,
                baseDelay: 500,            // Start with 500ms
                useExponentialBackoff: false,  // Linear backoff
                maxDelay: 3000,            // Max 3 seconds
                errorCodes: [201, 202]
            },

            // Default strategy for unknown retryable errors
            defaultStrategy: {
                name: 'Default Strategy',
                maxAttempts: 3,
                baseDelay: 1000,
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 15000,
                errorCodes: []
            }
        },

        // ===== NEW: Circuit Breaker =====
        circuitBreaker: {
            enabled: true,
            failureThreshold: 5,           // Open after 5 consecutive failures
            resetTimeout: 30000,           // Wait 30s before trying again
            successThreshold: 2,           // Close after 2 consecutive successes
            logStateChanges: true
        },

        // ===== NEW: Retry Queue =====
        retryQueue: {
            enabled: true,
            maxSize: 100,                  // Max 100 pending retries
            processingInterval: 1000,      // Check queue every 1s
            prioritizeBySeverity: true
        }
    },

    // Development specific settings
    development: {
        enableDebugMode: true,
        mockApiResponses: false,
        showDetailedErrors: true
    }
};