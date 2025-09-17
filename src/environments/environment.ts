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
        enableErrorReporting: false, // Disable in development
        maxRetries: 3,
        retryDelay: 1000 // milliseconds
    },

    // Development specific settings
    development: {
        enableDebugMode: true,
        mockApiResponses: false,
        showDetailedErrors: true
    }
};