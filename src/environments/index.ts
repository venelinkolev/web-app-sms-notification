// Export main environment configuration
export { environment } from './environment';

// Export all interfaces
export type {
    Environment,
    SMSApiConfig,
    AppConfig,
    ErrorHandlingConfig,
    DevelopmentConfig,
    ProductionSpecificConfig // Updated name
} from './environment.interface';