// Environment configuration service
export { EnvironmentService } from './environment.service';

// File management service
export { FileService } from './file.service';

// Notification service
export { NotificationService } from './notification.service';

// Re-export environment interfaces
export type {
    Environment,
    SMSApiConfig,
    AppConfig,
    ErrorHandlingConfig,
    DevelopmentConfig,
    ProductionSpecificConfig
} from '../../../environments/environment.interface';

// Re-export all models for easy access
export * from '../models';