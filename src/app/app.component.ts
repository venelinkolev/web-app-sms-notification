// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

// Services
import { EnvironmentService } from './core/services/environment.service';
import { NotificationService } from './core/services/notification.service';
import { DataService } from './core/services/data.service';
import { SMSService } from './core/services/sms.service';
import { ErrorLoggerService } from './core/services/error-logger.service';

// Components
import { FileUploadComponent } from './features/file-upload/file-upload.component';
import { ClientListComponent } from './features/client-list/client-list.component';
import { SMSPreviewComponent } from './features/sms-preview/sms-preview.component';
import { NotificationComponent } from './shared/components/notification/notification.component';
import { ErrorLogViewerComponent } from './shared/components/error-log-viewer/error-log-viewer.component';
import { SendProgressComponent, SendResultsComponent } from './features';

// Models
import { ClientDataImport, NotificationType } from './core/models';
import { ErrorContext, ErrorSeverity } from './core/models/error.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    FileUploadComponent,
    ClientListComponent,
    SMSPreviewComponent,
    NotificationComponent,
    ErrorLogViewerComponent,
    SendProgressComponent,
    SendResultsComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'SMS Notification Application';

  // Environment data
  isProduction = false;
  maxFileSizeFormatted = '';

  // Import data
  importData: ClientDataImport | null = null;
  hasData = false;

  // Sample JSON structure for testing
  sampleJsonStructure = `[
  {
    "Number": "12345",
    "End_Data": "12/31/24 23:59:59",
    "Model": "AlarmSystem Pro",
    "Number_EKA": "EKA-789",
    "Phone": "0879961314, 0885465987",
    "Ime_Firma": "Тест Компания ЕООД",
    "bulst": "BG1234567890",
    
    // Optional полета:
    "Ime_Obekt": "Офис Център София",
    "Adres_Obekt": "ул. Витоша 1, София",
    "Dan_Number": "1234567890"
  }
]`;

  // Error log viewer toggle
  showErrorLogViewer = false;

  constructor(
    private environmentService: EnvironmentService,
    private notificationService: NotificationService,
    private dataService: DataService,
    private smsService: SMSService,
    private errorLogger: ErrorLoggerService,
  ) { }

  ngOnInit(): void {
    this.loadEnvironmentData();
    this.showWelcomeMessage();
    this.testSMSService();
    // Test sending SMS (uncomment to test)
    // this.testSendSMS();
  }

  /**
   * Load environment configuration
   */
  private loadEnvironmentData(): void {
    this.isProduction = this.environmentService.isProduction();
    this.maxFileSizeFormatted = this.formatFileSize(this.environmentService.getMaxFileSize());
  }

  /**
   * Welcome message
   */
  private showWelcomeMessage(): void {
    this.notificationService.info(
      '📝 SMS Preview Ready!',
      'Sub-task 4.3 завършена - готово за тестване! 🚀',
      5000
    );
  }

  // Test SMS Service
  private testSMSService(): void {
    const status = this.smsService.getServiceStatus();

    console.group('📱 SMS Service Status');
    console.log('Configured:', status.configured ? '✅ YES' : '❌ NO');
    console.log('Base URL:', status.baseUrl);
    console.log('Sender:', status.sender);
    console.log('Test Mode:', status.testMode ? '✅ ON' : '❌ OFF');
    console.groupEnd();

    if (!status.configured) {
      this.notificationService.warning(
        '⚠️ SMS API Token',
        'Token не е конфигуриран в environment.local.ts',
        7000
      );
    }
  }

  /**
   * Handle file imported event
   */
  onFileImported(importResult: ClientDataImport): void {
    console.log('File imported:', importResult);
  }

  /**
   * Handle import confirmed event
   */
  onImportConfirmed(importResult: ClientDataImport): void {
    this.importData = importResult;
    this.hasData = true;

    // Load data in DataService
    this.dataService.loadData(importResult);

    console.log('Import confirmed:', importResult);

    this.notificationService.success(
      'Импорт завършен',
      `${importResult.stats.validRecords} записа са готови за обработка`
    );
  }

  /**
   * Reset import
   */
  resetImport(): void {
    this.importData = null;
    this.hasData = false;
    this.dataService.reset();
    this.notificationService.info('Reset', 'Готово за нов импорт', 2000);
  }

  /**
   * Get mode icon
   */
  getModeIcon(): string {
    return this.isProduction ? '🚀' : '🛠️';
  }

  /**
   * Get mode name
   */
  getModeName(): string {
    return this.isProduction ? 'Production' : 'Development';
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(1)}KB`;
  }

  /**
   * Format date
   */
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('bg-BG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /**
   * Test SMS sending
   */
  testSendSMS(): void {
    const testPhone = this.environmentService.getSMSApiConfig().testPhoneNumber || '+359895552160';

    this.notificationService.info(
      'SMS Test',
      `Изпращам тестово SMS до ${testPhone}...`,
      3000
    );

    this.smsService.sendSMS({
      to: testPhone,
      message: 'Тестово съобщение от SMS Notification App!',
      from: '1511'
    }).subscribe({
      next: (response) => {
        console.log('✅ SMS Response:', response);

        this.notificationService.success(
          'SMS изпратен успешно!',
          `Message ID: ${response.list[0].id}\nStatus: ${response.list[0].status}`,
          7000
        );
      },
      error: (error) => {
        console.error('❌ SMS Error:', error);
      }
    });
  }

  /**
 * Toggle error log viewer
 */
  toggleErrorLogViewer(): void {
    this.showErrorLogViewer = !this.showErrorLogViewer;
  }

  /**
   * Create test errors for demonstration (OPTIONAL - for testing only)
   */
  createTestErrors(): void {
    // Test SMS API error
    this.errorLogger.logSMSError(
      'Rate limit exceeded',
      429,
      {
        phoneNumber: '+359888123456',
        timestamp: new Date()
      }
    );

    // Test validation error
    this.errorLogger.logValidationError(
      'Invalid phone format',
      'phoneNumber',
      { value: '123' }
    );

    // Test file error
    this.errorLogger.logFileError(
      'Failed to parse JSON',
      'clients.json',
      { size: 1024 }
    );

    // Test network error
    this.errorLogger.logNetworkError(
      { status: 500, message: 'Internal Server Error' },
      'https://api.example.com/sms',
      { method: 'POST' }
    );

    // Test critical error
    this.errorLogger.logError(
      new Error('System failure'),
      ErrorContext.APPLICATION,
      ErrorSeverity.CRITICAL,
      { component: 'AppComponent' }
    );

    this.notificationService.success(
      'Test грешки създадени',
      'Създадени са 5 тестови грешки за демонстрация'
    );
  }

  /**
   * Clear test errors
   */
  clearTestErrors(): void {
    this.errorLogger.clearLogs();
    this.notificationService.info('Грешки изчистени', 'Всички тестови грешки са изтрити');
  }
}