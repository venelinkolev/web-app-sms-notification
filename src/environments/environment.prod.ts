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
        enableConsoleLogging: false, // Disable in production
        enableErrorReporting: true,  // Enable error reporting
        maxRetries: 5, // More retries in production
        retryDelay: 2000 // Longer delay between retries
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