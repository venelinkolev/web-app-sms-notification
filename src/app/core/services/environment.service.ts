// src/app/core/services/environment.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { Environment, SMSApiConfig, AppConfig } from '../../../environments/environment.interface';

@Injectable({
    providedIn: 'root'
})
export class EnvironmentService {

    private readonly config: Environment = environment;

    /**
     * Get full environment configuration
     */
    getConfig(): Environment {
        return this.config;
    }

    /**
     * Get SMS API configuration
     */
    getSMSApiConfig(): SMSApiConfig {
        return this.config.smsApi;
    }

    /**
     * Get application configuration
     */
    getAppConfig(): AppConfig {
        return this.config.app;
    }

    /**
     * Check if app is running in production mode
     */
    isProduction(): boolean {
        return this.config.production;
    }

    /**
     * Check if debug mode is enabled
     */
    isDebugMode(): boolean {
        if (this.config.production) {
            return this.config.productionSettings?.enableDebugMode ?? false;
        }
        return this.config.development?.enableDebugMode ?? false;
    }

    /**
     * Get SMS API base URL
     */
    getSMSApiBaseUrl(): string {
        return this.config.smsApi.baseUrl;
    }

    /**
     * Get SMS API token
     */
    getSMSApiToken(): string {
        return this.config.smsApi.token;
    }

    /**
     * Check if feature is enabled
     */
    isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
        return this.config.app.features[feature];
    }

    /**
     * Get character limit for SMS type
     */
    getSMSCharacterLimit(type: 'standard' | 'unicode'): number {
        return this.config.smsApi.characterLimits[type];
    }

    /**
     * Get concatenated SMS character limit
     */
    getConcatenatedSMSLimit(type: 'standard' | 'unicode'): number {
        return this.config.smsApi.characterLimits.concat[type];
    }

    /**
     * Get max file size for uploads
     */
    getMaxFileSize(): number {
        return this.config.app.ui.maxFileSize;
    }

    /**
     * Get table page size
     */
    getTablePageSize(): number {
        return this.config.app.ui.tablePageSize;
    }

    /**
     * Get animation duration
     */
    getAnimationDuration(): number {
        return this.config.app.ui.animationDuration;
    }

    /**
     * Check if SMS API is in test mode
     */
    isSMSTestMode(): boolean {
        return this.config.smsApi.testMode;
    }

    /**
     * Get test phone number (if available)
     */
    getTestPhoneNumber(): string | undefined {
        return this.config.smsApi.testPhoneNumber;
    }

    /**
     * Get retry configuration
     */
    getRetryConfig() {
        return {
            maxRetries: this.config.errorHandling.maxRetries,
            retryDelay: this.config.errorHandling.retryDelay
        };
    }

    /**
     * Check if console logging is enabled
     */
    isConsoleLoggingEnabled(): boolean {
        return this.config.errorHandling.enableConsoleLogging;
    }

    /**
     * Get app version
     */
    getAppVersion(): string {
        return this.config.app.version;
    }

    /**
     * Get app name
     */
    getAppName(): string {
        return this.config.app.name;
    }

    /**
     * Get production-specific settings (if in production mode)
     */
    getProductionSettings() {
        return this.config.productionSettings;
    }

    /**
     * Check if caching is enabled (production only)
     */
    isCachingEnabled(): boolean {
        return this.config.productionSettings?.performance?.enableCaching ?? false;
    }

    /**
     * Get cache timeout (production only)
     */
    getCacheTimeout(): number {
        return this.config.productionSettings?.performance?.cacheTimeout ?? 0;
    }
}