import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EnvironmentService } from './core/services/environment.service';
import type { Environment } from '../environments/environment.interface';

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

  constructor(private environmentService: EnvironmentService) { }

  ngOnInit(): void {
    this.loadEnvironmentData();
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
}