import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EnvironmentService } from './core/services/environment.service';
import type { Environment } from '../environments/environment.interface';

// Import new TypeScript models for testing
import {
  ClientRecord,
  ParsedClientRecord,
  ValidationErrorCode,
  SMSStatus,
  SMSEncoding,
  NotificationType,
  AppView
} from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'SMS Notification Application';

  // Environment data for testing
  environmentData: any = {};
  isProduction = false;
  isDebugMode = false;

  // Typed features array for template
  featuresArray: Array<{ key: string, value: boolean }> = [];

  // TypeScript models testing data
  modelsTestData: any = {};

  constructor(private environmentService: EnvironmentService) { }

  ngOnInit(): void {
    this.loadEnvironmentData();
    this.loadModelsTestData();
  }

  private loadEnvironmentData(): void {
    const appConfig = this.environmentService.getAppConfig();

    this.environmentData = {
      app: appConfig,
      smsApi: {
        baseUrl: this.environmentService.getSMSApiBaseUrl(),
        hasToken: !!this.environmentService.getSMSApiToken(),
        testMode: this.environmentService.isSMSTestMode(),
        characterLimits: {
          standard: this.environmentService.getSMSCharacterLimit('standard'),
          unicode: this.environmentService.getSMSCharacterLimit('unicode')
        }
      },
      ui: {
        maxFileSize: this.formatFileSize(this.environmentService.getMaxFileSize()),
        tablePageSize: this.environmentService.getTablePageSize(),
        animationDuration: this.environmentService.getAnimationDuration()
      }
    };

    // Convert features object to typed array
    this.featuresArray = Object.entries(appConfig.features).map(([key, value]) => ({
      key,
      value: Boolean(value)
    }));

    this.isProduction = this.environmentService.isProduction();
    this.isDebugMode = this.environmentService.isDebugMode();
  }

  private loadModelsTestData(): void {
    // Example ClientRecord (matches the JSON structure)
    const sampleClient: ClientRecord = {
      Number: "12345",
      End_Data: "31/12/24 23:59:59",
      Model: "AlarmSystem Pro",
      Number_EKA: "EKA-789",
      Ime_Obekt: "Офис Център София",
      Adres_Obekt: "ул. Витоша 1, София",
      Dan_Number: "1234567890",
      Phone: "359888123456",
      Ime_Firma: "Тест Компания ЕООД",
      bulst: "BG1234567890"
    };

    // Example ParsedClientRecord (extended with validation)
    const parsedClient: ParsedClientRecord = {
      ...sampleClient,
      id: "client-001",
      parsedEndDate: new Date('2024-12-31T23:59:59'),
      formattedPhone: "+359888123456",
      isValid: true,
      validationErrors: [],
      selected: false
    };

    this.modelsTestData = {
      clientModels: {
        sampleClient,
        parsedClient,
        validationStatus: this.getValidationStatus(parsedClient),
      },
      smsModels: {
        availableStatuses: Object.values(SMSStatus),
        encodingTypes: Object.values(SMSEncoding),
        sampleResponse: {
          count: 1,
          list: [{
            id: "msg-123",
            points: 0.16,
            number: "359888123456",
            date_sent: Date.now() / 1000,
            status: SMSStatus.QUEUE
          }]
        }
      },
      appState: {
        currentView: AppView.DATA_TABLE,
        notificationTypes: Object.values(NotificationType),
        sampleNotification: {
          id: "notif-001",
          type: NotificationType.SUCCESS,
          title: "TypeScript Models",
          message: "All interfaces loaded successfully!",
          timeout: 5000,
          dismissible: true,
          timestamp: new Date(),
          visible: true
        }
      },
      enums: {
        validationErrorCodes: Object.values(ValidationErrorCode),
        smsStatuses: Object.values(SMSStatus),
        appViews: Object.values(AppView),
        notificationTypes: Object.values(NotificationType)
      }
    };
  }

  private getValidationStatus(client: ParsedClientRecord): string {
    return client.isValid ? 'Valid ✅' : 'Invalid ❌';
  }

  private formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb}MB`;
  }

  getFeatureIcon(enabled: boolean): string {
    return enabled ? '✅' : '❌';
  }

  getModeIcon(): string {
    return this.isProduction ? '🚀' : '🛠️';
  }

  getModeName(): string {
    return this.isProduction ? 'Production' : 'Development';
  }

  // Helper methods for template
  getEnumValues(enumObj: any): string[] {
    return Object.values(enumObj) as string[];
  }

  formatJSON(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }
}