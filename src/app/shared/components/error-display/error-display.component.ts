import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorLog, ErrorSeverity, ErrorContext } from '../../../core/models/error.models';
import {
    getSMSErrorCodeExtended,
    getSMSErrorMessageBG,
    isSMSErrorRetryable,
    isSMSErrorRecoverable
} from '../../../core/models/sms.models';

/**
 * Error Display Component
 * Inline error display with severity colors, error details, and recovery actions
 * 
 * Features:
 * - Severity-based color coding
 * - Bulgarian error messages
 * - Recovery suggestions
 * - Retry button (if retryable)
 * - Expandable details (technical info, stack trace)
 * - Dismiss functionality
 */
@Component({
    selector: 'app-error-display',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './error-display.component.html',
    styleUrl: './error-display.component.scss'
})
export class ErrorDisplayComponent {

    /** Error log to display */
    @Input() error!: ErrorLog;

    /** Show retry button (default: true) */
    @Input() showRetryButton: boolean = true;

    /** Show dismiss button (default: true) */
    @Input() showDismissButton: boolean = true;

    /** Compact mode (smaller, less padding) */
    @Input() compact: boolean = false;

    /** Show technical details by default */
    @Input() expandedByDefault: boolean = false;

    /** Retry button clicked */
    @Output() retry = new EventEmitter<ErrorLog>();

    /** Dismiss button clicked */
    @Output() dismiss = new EventEmitter<string>();

    /** Resolve button clicked */
    @Output() resolve = new EventEmitter<string>();

    /** Details expanded state */
    detailsExpanded: boolean = false;

    /** Error Severity enum for template */
    ErrorSeverity = ErrorSeverity;

    /** Error Context enum for template */
    ErrorContext = ErrorContext;

    ngOnInit(): void {
        this.detailsExpanded = this.expandedByDefault;
    }

    /**
     * Get CSS class based on error severity
     */
    getSeverityClass(): string {
        const severityClasses = {
            [ErrorSeverity.LOW]: 'error-low',
            [ErrorSeverity.MEDIUM]: 'error-medium',
            [ErrorSeverity.HIGH]: 'error-high',
            [ErrorSeverity.CRITICAL]: 'error-critical'
        };

        return severityClasses[this.error.severity] || 'error-medium';
    }

    /**
     * Get severity icon
     */
    getSeverityIcon(): string {
        const icons = {
            [ErrorSeverity.LOW]: 'ℹ️',
            [ErrorSeverity.MEDIUM]: '⚠️',
            [ErrorSeverity.HIGH]: '❌',
            [ErrorSeverity.CRITICAL]: '🚨'
        };

        return icons[this.error.severity] || '⚠️';
    }

    /**
     * Get severity label in Bulgarian
     */
    getSeverityLabel(): string {
        const labels = {
            [ErrorSeverity.LOW]: 'Информация',
            [ErrorSeverity.MEDIUM]: 'Предупреждение',
            [ErrorSeverity.HIGH]: 'Грешка',
            [ErrorSeverity.CRITICAL]: 'Критична грешка'
        };

        return labels[this.error.severity] || 'Грешка';
    }

    /**
     * Get context label in Bulgarian
     */
    getContextLabel(): string {
        const labels = {
            [ErrorContext.SMS_API]: 'SMS API',
            [ErrorContext.FILE_OPERATION]: 'Файлова операция',
            [ErrorContext.DATA_VALIDATION]: 'Валидация на данни',
            [ErrorContext.NETWORK]: 'Мрежа',
            [ErrorContext.APPLICATION]: 'Приложение',
            [ErrorContext.USER_INPUT]: 'Потребителски вход',
            [ErrorContext.TEMPLATE]: 'Шаблон',
            [ErrorContext.UNKNOWN]: 'Неизвестен'
        };

        return labels[this.error.context] || 'Неизвестен';
    }

    /**
     * Check if error is retryable (for SMS errors)
     */
    isRetryable(): boolean {
        if (!this.error.code || this.error.context !== ErrorContext.SMS_API) {
            return false;
        }

        return isSMSErrorRetryable(Number(this.error.code));
    }

    /**
     * Check if error is recoverable
     */
    isRecoverable(): boolean {
        if (!this.error.code || this.error.context !== ErrorContext.SMS_API) {
            return false;
        }

        return isSMSErrorRecoverable(Number(this.error.code));
    }

    /**
     * Get recovery suggestion
     */
    getRecoverySuggestion(): string | undefined {
        if (this.error.code && this.error.context === ErrorContext.SMS_API) {
            const extendedInfo = getSMSErrorCodeExtended(Number(this.error.code));
            return extendedInfo?.suggestion;
        }

        return undefined;
    }

    /**
     * Get Bulgarian error message (for SMS errors)
     */
    getBulgarianMessage(): string | undefined {
        if (this.error.code && this.error.context === ErrorContext.SMS_API) {
            return getSMSErrorMessageBG(Number(this.error.code));
        }

        return undefined;
    }

    /**
     * Toggle details expansion
     */
    toggleDetails(): void {
        this.detailsExpanded = !this.detailsExpanded;
    }

    /**
     * Handle retry button click
     */
    onRetry(): void {
        this.retry.emit(this.error);
    }

    /**
     * Handle dismiss button click
     */
    onDismiss(): void {
        this.dismiss.emit(this.error.id);
    }

    /**
     * Handle resolve button click
     */
    onResolve(): void {
        this.resolve.emit(this.error.id);
    }

    /**
     * Copy error to clipboard
     */
    copyToClipboard(): void {
        const errorText = JSON.stringify({
            id: this.error.id,
            timestamp: this.error.timestamp,
            severity: this.error.severity,
            context: this.error.context,
            message: this.error.message,
            code: this.error.code,
            technicalDetails: this.error.technicalDetails,
            stackTrace: this.error.stackTrace,
            metadata: this.error.metadata
        }, null, 2);

        navigator.clipboard.writeText(errorText).then(() => {
            // Could emit event or show notification
            console.log('Error copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy error:', err);
        });
    }

    /**
     * Format timestamp
     */
    formatTimestamp(date: Date): string {
        return new Date(date).toLocaleString('bg-BG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Format metadata for display
     */
    formatMetadata(metadata: Record<string, any> | undefined): string {
        if (!metadata) return '';
        return JSON.stringify(metadata, null, 2);
    }
}