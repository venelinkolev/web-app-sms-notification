// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

// Services
import { EnvironmentService } from './core/services/environment.service';
import { NotificationService } from './core/services/notification.service';
import { DataService } from './core/services/data.service';

// Components
import { FileUploadComponent } from './features/file-upload/file-upload.component';
import { ClientListComponent } from './features/client-list/client-list.component';
import { NotificationComponent } from './shared/components/notification/notification.component';

// Models
import { ClientDataImport, NotificationType } from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    FileUploadComponent,
    ClientListComponent,
    NotificationComponent
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
    "End_Data": "31/12/24 23:59:59",
    "Model": "AlarmSystem Pro",
    "Number_EKA": "EKA-789",
    "Phone": "359888123456",
    "Ime_Firma": "Тест Компания ЕООД",
    "bulst": "BG1234567890",
    
    // Optional полета (могат да липсват):
    "Ime_Obekt": "Офис Център София",
    "Adres_Obekt": "ул. Витоша 1, София",
    "Dan_Number": "1234567890"
  }
]`;

  constructor(
    private environmentService: EnvironmentService,
    private notificationService: NotificationService,
    private dataService: DataService
  ) { }

  ngOnInit(): void {
    this.loadEnvironmentData();
    this.showWelcomeMessage();
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
      'File Upload тестване',
      'Готово за тестване на JSON файлова обработка 🚀',
      4000
    );
  }

  /**
   * Handle file imported event
   */
  onFileImported(importResult: ClientDataImport): void {
    console.log('File imported:', importResult);
    // Данните са обработени, но потребителят още не е потвърдил
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
   * Start SMS preview (placeholder)
   */
  startSMSPreview(): void {
    this.notificationService.info(
      'SMS Preview',
      'Тази функционалност ще бъде достъпна в следващата под-задача',
      3000
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
   * Show test notifications
   */
  showTestNotifications(): void {
    // Test all notification types
    setTimeout(() => {
      this.notificationService.success('Test Success', 'Това е success notification');
    }, 100);

    setTimeout(() => {
      this.notificationService.info('Test Info', 'Това е info notification');
    }, 600);

    setTimeout(() => {
      this.notificationService.warning('Test Warning', 'Това е warning notification');
    }, 1100);

    setTimeout(() => {
      this.notificationService.error('Test Error', 'Това е error notification');
    }, 1600);

    // Test notification with actions
    setTimeout(() => {
      this.notificationService.showNotification({
        type: NotificationType.INFO,
        title: 'Test Actions',
        message: 'Notification с действия',
        timeout: 10000,
        actions: [
          {
            label: 'OK',
            handler: () => this.notificationService.success('Action', 'OK pressed!'),
            style: 'primary'
          },
          {
            label: 'Cancel',
            handler: () => this.notificationService.info('Action', 'Cancel pressed!'),
            style: 'secondary'
          }
        ]
      });
    }, 2100);
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
}