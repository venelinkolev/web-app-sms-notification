// Environment configuration service
export { EnvironmentService } from './environment.service';

// File management service
export { FileService } from './file.service';

// Data management service
export { DataService } from './data.service';

// Notification service
export { NotificationService } from './notification.service';

// SMS service for sending messages
export { SMSService } from './sms.service';

// SMS Template service for managing templates
export { SMSTemplateService } from './sms-template.service';

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