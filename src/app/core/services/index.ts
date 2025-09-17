// Environment configuration service
export { EnvironmentService } from './environment.service';

// Re-export environment interfaces
export type {
    Environment,
    SMSApiConfig,
    AppConfig,
    ErrorHandlingConfig,
    DevelopmentConfig,
    ProductionSpecificConfig // Updated name
} from '../../../environments/environment.interface';