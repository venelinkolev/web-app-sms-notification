import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, combineLatest } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

import { ErrorLoggerService } from '../../../core/services/error-logger.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ErrorDisplayComponent } from '../error-display/error-display.component';

import {
    ErrorLog,
    ErrorSeverity,
    ErrorContext,
    ErrorLogFilter,
    ErrorLogStats
} from '../../../core/models/error.models';

/**
 * Error Log Viewer Component
 * Comprehensive error log management interface
 */
@Component({
    selector: 'app-error-log-viewer',
    standalone: true,
    imports: [CommonModule, FormsModule, ErrorDisplayComponent],
    templateUrl: './error-log-viewer.component.html',
    styleUrl: './error-log-viewer.component.scss'
})
export class ErrorLogViewerComponent implements OnInit, OnDestroy {

    // Observables
    allErrors$!: Observable<ErrorLog[]>;
    filteredErrors$!: Observable<ErrorLog[]>;
    stats$!: Observable<ErrorLogStats>;

    // Filter state - FIXED to match ErrorLogFilter interface
    filter: ErrorLogFilter = {
        severity: undefined,
        context: undefined,
        dateRange: undefined,
        resolved: undefined,
        searchText: ''
    };

    // UI filter values (for form binding)
    selectedSeverity: ErrorSeverity | 'all' = 'all';
    selectedContext: ErrorContext | 'all' = 'all';
    dateFrom: string = '';
    dateTo: string = '';

    // Sort state
    sortField: 'timestamp' | 'severity' = 'timestamp';
    sortDirection: 'asc' | 'desc' = 'desc';

    // Selected error for details modal
    selectedError: ErrorLog | null = null;
    showDetailsModal: boolean = false;

    // Enums for template
    ErrorSeverity = ErrorSeverity;
    ErrorContext = ErrorContext;

    // Severity options
    severityOptions = [
        { value: ErrorSeverity.LOW, label: 'Информация' },
        { value: ErrorSeverity.MEDIUM, label: 'Предупреждение' },
        { value: ErrorSeverity.HIGH, label: 'Грешка' },
        { value: ErrorSeverity.CRITICAL, label: 'Критична' }
    ];

    // Context options
    contextOptions = [
        { value: ErrorContext.SMS_API, label: 'SMS API' },
        { value: ErrorContext.FILE_OPERATION, label: 'Файлова операция' },
        { value: ErrorContext.DATA_VALIDATION, label: 'Валидация' },
        { value: ErrorContext.NETWORK, label: 'Мрежа' },
        { value: ErrorContext.APPLICATION, label: 'Приложение' },
        { value: ErrorContext.USER_INPUT, label: 'Потребителски вход' },
        { value: ErrorContext.TEMPLATE, label: 'Шаблон' },
        { value: ErrorContext.UNKNOWN, label: 'Неизвестен' }
    ];

    // Component lifecycle
    private destroy$ = new Subject<void>();

    constructor(
        private errorLogger: ErrorLoggerService,
        private notificationService: NotificationService
    ) { }

    ngOnInit(): void {
        this.setupObservables();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Setup reactive data streams
     */
    private setupObservables(): void {
        // All errors
        this.allErrors$ = this.errorLogger.getErrorLogs();

        // Statistics
        this.stats$ = this.errorLogger.getStatistics();

        // Filtered and sorted errors
        this.filteredErrors$ = this.allErrors$.pipe(
            map(errors => this.applyFiltersAndSort(errors))
        );
    }

    /**
     * Apply filters and sorting to errors
     */
    private applyFiltersAndSort(errors: ErrorLog[]): ErrorLog[] {
        let filtered = [...errors];

        // Apply severity filter - FIXED: check if array includes value
        if (this.filter.severity && this.filter.severity.length > 0) {
            filtered = filtered.filter(e => this.filter.severity!.includes(e.severity));
        }

        // Apply context filter - FIXED: check if array includes value
        if (this.filter.context && this.filter.context.length > 0) {
            filtered = filtered.filter(e => this.filter.context!.includes(e.context));
        }

        // Apply resolved filter
        if (this.filter.resolved !== undefined) {
            filtered = filtered.filter(e => e.resolved === this.filter.resolved);
        }

        // Apply date range filter - FIXED: use dateRange object
        if (this.filter.dateRange) {
            const fromDate = this.filter.dateRange.from;
            const toDate = this.filter.dateRange.to;

            filtered = filtered.filter(e => {
                const errorDate = new Date(e.timestamp);
                return errorDate >= fromDate && errorDate <= toDate;
            });
        }

        // Apply search text filter
        if (this.filter.searchText && this.filter.searchText.trim() !== '') {
            const searchLower = this.filter.searchText.toLowerCase();
            filtered = filtered.filter(e =>
                e.message.toLowerCase().includes(searchLower) ||
                e.technicalDetails?.toLowerCase().includes(searchLower) ||
                String(e.code || '').toLowerCase().includes(searchLower)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;

            if (this.sortField === 'timestamp') {
                comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            } else if (this.sortField === 'severity') {
                const severityOrder = {
                    [ErrorSeverity.LOW]: 0,
                    [ErrorSeverity.MEDIUM]: 1,
                    [ErrorSeverity.HIGH]: 2,
                    [ErrorSeverity.CRITICAL]: 3
                };
                comparison = severityOrder[a.severity] - severityOrder[b.severity];
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }

    /**
     * Handle filter change - FIXED to build proper filter object
     */
    onFilterChange(): void {
        // Build severity array
        this.filter.severity = this.selectedSeverity === 'all'
            ? undefined
            : [this.selectedSeverity as ErrorSeverity];

        // Build context array
        this.filter.context = this.selectedContext === 'all'
            ? undefined
            : [this.selectedContext as ErrorContext];

        // Build dateRange object - FIXED
        if (this.dateFrom || this.dateTo) {
            this.filter.dateRange = {
                from: this.dateFrom ? new Date(this.dateFrom) : new Date(0),
                to: this.dateTo ? new Date(this.dateTo) : new Date()
            };
        } else {
            this.filter.dateRange = undefined;
        }

        // Trigger re-filter
        this.filteredErrors$ = this.allErrors$.pipe(
            map(errors => this.applyFiltersAndSort(errors))
        );
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.filter = {
            severity: undefined,
            context: undefined,
            dateRange: undefined,
            resolved: undefined,
            searchText: ''
        };

        // Reset UI values
        this.selectedSeverity = 'all';
        this.selectedContext = 'all';
        this.dateFrom = '';
        this.dateTo = '';

        this.onFilterChange();
    }

    /**
     * Toggle sort direction
     */
    toggleSortDirection(): void {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.onFilterChange();
    }

    /**
     * Change sort field
     */
    changeSortField(field: 'timestamp' | 'severity'): void {
        if (this.sortField === field) {
            this.toggleSortDirection();
        } else {
            this.sortField = field;
            this.sortDirection = 'desc';
        }
        this.onFilterChange();
    }

    /**
     * Show error details modal
     */
    showErrorDetails(error: ErrorLog): void {
        this.selectedError = error;
        this.showDetailsModal = true;
    }

    /**
     * Close details modal
     */
    closeDetailsModal(): void {
        this.showDetailsModal = false;
        this.selectedError = null;
    }

    /**
     * Handle retry action
     */
    onRetryError(error: ErrorLog): void {
        this.notificationService.info(
            'Retry функционалността',
            '',
            // 'Retry логиката ще бъде имплементирана в Phase 5'
        );
        console.log('Retry error:', error.id);
    }

    /**
     * Handle resolve action
     */
    onResolveError(errorId: string): void {
        const notes = prompt('Бележки за решението (опционално):');
        this.errorLogger.resolveError(errorId, notes || undefined);

        this.notificationService.success(
            'Грешка маркирана',
            'Грешката е маркирана като решена'
        );

        if (this.showDetailsModal && this.selectedError?.id === errorId) {
            this.closeDetailsModal();
        }
    }

    /**
     * Clear all error logs
     */
    clearAllLogs(): void {
        if (confirm('Сигурни ли сте, че искате да изтриете всички грешки?')) {
            this.errorLogger.clearLogs();
            this.notificationService.info('Грешки изчистени', 'Всички грешки са изтрити');
        }
    }

    /**
     * Clear resolved errors only
     */
    clearResolvedErrors(): void {
        if (confirm('Изтрий всички решени грешки?')) {
            this.errorLogger.clearResolvedErrors();
            this.notificationService.info('Решени грешки изчистени', 'Решените грешки са изтрити');
        }
    }

    /**
     * Export error logs
     */
    exportLogs(): void {
        const filename = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
        this.errorLogger.downloadLogs(filename);
        this.notificationService.success('Export завършен', `Грешките са експортирани в ${filename}`);
    }

    /**
     * Format timestamp
     */
    formatTimestamp(date: Date): string {
        return new Date(date).toLocaleString('bg-BG', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Get severity icon
     */
    getSeverityIcon(severity: ErrorSeverity): string {
        const icons = {
            [ErrorSeverity.LOW]: 'ℹ️',
            [ErrorSeverity.MEDIUM]: '⚠️',
            [ErrorSeverity.HIGH]: '❌',
            [ErrorSeverity.CRITICAL]: '🚨'
        };
        return icons[severity] || '⚠️';
    }

    /**
     * Get severity class
     */
    getSeverityClass(severity: ErrorSeverity): string {
        const classes = {
            [ErrorSeverity.LOW]: 'severity-low',
            [ErrorSeverity.MEDIUM]: 'severity-medium',
            [ErrorSeverity.HIGH]: 'severity-high',
            [ErrorSeverity.CRITICAL]: 'severity-critical'
        };
        return classes[severity] || 'severity-medium';
    }
}