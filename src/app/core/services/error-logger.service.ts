import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import {
    ErrorLog,
    ErrorSeverity,
    ErrorContext,
    ErrorLogFilter,
    ErrorLogStats,
    ErrorExport,
    AppError
} from '../models/error.models';

/**
 * Error Logger Service
 * Centralized error logging system with filtering, statistics, and export
 */
@Injectable({
    providedIn: 'root'
})
export class ErrorLoggerService {

    // Error logs storage (in-memory)
    private errorLogs$ = new BehaviorSubject<ErrorLog[]>([]);

    // Max logs to keep in memory (prevent memory leaks)
    private readonly maxLogs = 1000;

    // Error counter for unique IDs
    private errorCounter = 0;

    constructor(private environmentService: EnvironmentService) {
        // Log service initialization
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('🔧 ErrorLoggerService initialized');
        }
    }

    /**
     * Log an error
     */
    logError(
        error: Error | AppError | string,
        context: ErrorContext = ErrorContext.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        metadata?: Record<string, any>
    ): string {
        const errorLog = this.createErrorLog(error, context, severity, metadata);

        // Add to logs
        const currentLogs = this.errorLogs$.value;
        const updatedLogs = [errorLog, ...currentLogs];

        // Keep only last N logs
        if (updatedLogs.length > this.maxLogs) {
            updatedLogs.splice(this.maxLogs);
        }

        this.errorLogs$.next(updatedLogs);

        // Console logging (development only)
        if (this.environmentService.isConsoleLoggingEnabled()) {
            this.logToConsole(errorLog);
        }

        // Return error ID for tracking
        return errorLog.id;
    }

    /**
     * Log SMS API error
     */
    logSMSError(
        error: any,
        code?: number,
        metadata?: Record<string, any>
    ): string {
        const severity = this.getSeverityFromErrorCode(code);
        const message = this.getMessageFromError(error);

        return this.logError(
            error,
            ErrorContext.SMS_API,
            severity,
            { ...metadata, errorCode: code }
        );
    }

    /**
     * Log file operation error
     */
    logFileError(
        error: Error | string,
        fileName?: string,
        metadata?: Record<string, any>
    ): string {
        return this.logError(
            error,
            ErrorContext.FILE_OPERATION,
            ErrorSeverity.HIGH,
            { ...metadata, fileName }
        );
    }

    /**
     * Log validation error
     */
    logValidationError(
        error: Error | string,
        field?: string,
        metadata?: Record<string, any>
    ): string {
        return this.logError(
            error,
            ErrorContext.DATA_VALIDATION,
            ErrorSeverity.LOW,
            { ...metadata, field }
        );
    }

    /**
     * Log network error
     */
    logNetworkError(
        error: any,
        url?: string,
        metadata?: Record<string, any>
    ): string {
        return this.logError(
            error,
            ErrorContext.NETWORK,
            ErrorSeverity.HIGH,
            { ...metadata, url, status: error?.status }
        );
    }

    /**
     * Get all error logs
     */
    getErrorLogs(): Observable<ErrorLog[]> {
        return this.errorLogs$.asObservable();
    }

    /**
     * Get filtered error logs
     */
    getFilteredLogs(filter: ErrorLogFilter): Observable<ErrorLog[]> {
        return this.errorLogs$.pipe(
            map(logs => this.applyFilter(logs, filter))
        );
    }

    /**
     * Get error log by ID
     */
    getErrorById(id: string): ErrorLog | undefined {
        return this.errorLogs$.value.find(log => log.id === id);
    }

    /**
     * Get error log statistics
     */
    getStatistics(): Observable<ErrorLogStats> {
        return this.errorLogs$.pipe(
            map(logs => this.calculateStatistics(logs))
        );
    }

    /**
     * Mark error as resolved
     */
    resolveError(errorId: string, notes?: string): void {
        const logs = this.errorLogs$.value;
        const index = logs.findIndex(log => log.id === errorId);

        if (index !== -1) {
            const updatedLog: ErrorLog = {
                ...logs[index],
                resolved: true,
                resolutionNotes: notes,
                resolvedAt: new Date()
            };

            const updatedLogs = [...logs];
            updatedLogs[index] = updatedLog;
            this.errorLogs$.next(updatedLogs);

            if (this.environmentService.isConsoleLoggingEnabled()) {
                console.log(`✅ Error ${errorId} resolved:`, notes);
            }
        }
    }

    /**
     * Clear all error logs
     */
    clearLogs(): void {
        this.errorLogs$.next([]);

        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('🗑️ Error logs cleared');
        }
    }

    /**
     * Clear resolved errors
     */
    clearResolvedErrors(): void {
        const logs = this.errorLogs$.value.filter(log => !log.resolved);
        this.errorLogs$.next(logs);

        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('🗑️ Resolved errors cleared');
        }
    }

    /**
     * Export error logs as JSON
     */
    exportLogs(): string {
        const logs = this.errorLogs$.value;
        const stats = this.calculateStatistics(logs);

        const exportData: ErrorExport = {
            exportedAt: new Date(),
            version: '1.0',
            appVersion: this.environmentService.getAppVersion(),
            logs: logs,
            stats: stats
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Download error logs as JSON file
     */
    downloadLogs(filename: string = 'error-logs.json'): void {
        const jsonData = this.exportLogs();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);

        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('📥 Error logs downloaded:', filename);
        }
    }

    /**
     * Get error count by severity
     */
    getErrorCountBySeverity(severity: ErrorSeverity): Observable<number> {
        return this.errorLogs$.pipe(
            map(logs => logs.filter(log => log.severity === severity).length)
        );
    }

    /**
     * Get recent errors (last N)
     */
    getRecentErrors(count: number = 10): Observable<ErrorLog[]> {
        return this.errorLogs$.pipe(
            map(logs => logs.slice(0, count))
        );
    }

    /**
     * Check if there are critical errors
     */
    hasCriticalErrors(): Observable<boolean> {
        return this.errorLogs$.pipe(
            map(logs => logs.some(log =>
                log.severity === ErrorSeverity.CRITICAL && !log.resolved
            ))
        );
    }

    // ===== PRIVATE METHODS =====

    /**
     * Create error log entry
     */
    private createErrorLog(
        error: Error | AppError | string,
        context: ErrorContext,
        severity: ErrorSeverity,
        metadata?: Record<string, any>
    ): ErrorLog {
        this.errorCounter++;

        const errorLog: ErrorLog = {
            id: this.generateErrorId(),
            timestamp: new Date(),
            severity: severity,
            context: context,
            message: this.getMessageFromError(error),
            technicalDetails: this.getTechnicalDetails(error),
            code: this.getErrorCode(error),
            stackTrace: this.getStackTrace(error),
            metadata: metadata,
            resolved: false
        };

        return errorLog;
    }

    /**
     * Generate unique error ID
     */
    private generateErrorId(): string {
        const timestamp = Date.now();
        return `error-${timestamp}-${this.errorCounter}`;
    }

    /**
     * Get message from error
     */
    private getMessageFromError(error: Error | AppError | string): string {
        if (typeof error === 'string') {
            return error;
        }
        return error.message || 'Unknown error';
    }

    /**
     * Get error code
     */
    private getErrorCode(error: any): string | number | undefined {
        if (typeof error === 'object' && error !== null) {
            return error.code || error.status;
        }
        return undefined;
    }

    /**
     * Get technical details
     */
    private getTechnicalDetails(error: any): string | undefined {
        if (typeof error === 'object' && error !== null) {
            return JSON.stringify({
                name: error.name,
                message: error.message,
                code: error.code,
                status: error.status,
                statusText: error.statusText,
                url: error.url
            }, null, 2);
        }
        return undefined;
    }

    /**
     * Get stack trace
     */
    private getStackTrace(error: any): string | undefined {
        // Only in development
        if (!this.environmentService.isProduction() && error instanceof Error) {
            return error.stack;
        }
        return undefined;
    }

    /**
     * Get severity from error code
     */
    private getSeverityFromErrorCode(code?: number): ErrorSeverity {
        if (!code) return ErrorSeverity.MEDIUM;

        // Critical errors
        if (code === 1001 || code === 105 || code === 104) {
            return ErrorSeverity.CRITICAL;
        }

        // High severity
        if (code === 103 || code >= 500) {
            return ErrorSeverity.HIGH;
        }

        // Medium severity
        if (code === 429 || code === 201 || code === 202) {
            return ErrorSeverity.MEDIUM;
        }

        // Low severity
        return ErrorSeverity.LOW;
    }

    /**
     * Log to console with formatting
     */
    private logToConsole(errorLog: ErrorLog): void {
        const icon = this.getSeverityIcon(errorLog.severity);
        const style = this.getSeverityStyle(errorLog.severity);

        console.group(`${icon} Error [${errorLog.severity}] - ${errorLog.context}`);
        console.log('%c' + errorLog.message, style);

        if (errorLog.code) {
            console.log('Code:', errorLog.code);
        }

        if (errorLog.technicalDetails) {
            console.log('Technical Details:', errorLog.technicalDetails);
        }

        if (errorLog.metadata) {
            console.log('Metadata:', errorLog.metadata);
        }

        if (errorLog.stackTrace) {
            console.log('Stack Trace:', errorLog.stackTrace);
        }

        console.groupEnd();
    }

    /**
     * Get severity icon
     */
    private getSeverityIcon(severity: ErrorSeverity): string {
        const icons = {
            [ErrorSeverity.LOW]: 'ℹ️',
            [ErrorSeverity.MEDIUM]: '⚠️',
            [ErrorSeverity.HIGH]: '❌',
            [ErrorSeverity.CRITICAL]: '🚨'
        };
        return icons[severity];
    }

    /**
     * Get severity console style
     */
    private getSeverityStyle(severity: ErrorSeverity): string {
        const styles = {
            [ErrorSeverity.LOW]: 'color: #2196F3; font-weight: bold;',
            [ErrorSeverity.MEDIUM]: 'color: #FF9800; font-weight: bold;',
            [ErrorSeverity.HIGH]: 'color: #F44336; font-weight: bold;',
            [ErrorSeverity.CRITICAL]: 'color: #D32F2F; font-weight: bold; font-size: 16px;'
        };
        return styles[severity];
    }

    /**
     * Apply filter to logs
     */
    private applyFilter(logs: ErrorLog[], filter: ErrorLogFilter): ErrorLog[] {
        let filtered = [...logs];

        // Filter by severity
        if (filter.severity && filter.severity.length > 0) {
            filtered = filtered.filter(log => filter.severity!.includes(log.severity));
        }

        // Filter by context
        if (filter.context && filter.context.length > 0) {
            filtered = filtered.filter(log => filter.context!.includes(log.context));
        }

        // Filter by date range
        if (filter.dateRange) {
            filtered = filtered.filter(log =>
                log.timestamp >= filter.dateRange!.from &&
                log.timestamp <= filter.dateRange!.to
            );
        }

        // Filter by resolved status
        if (filter.resolved !== undefined) {
            filtered = filtered.filter(log => log.resolved === filter.resolved);
        }

        // Search in messages
        if (filter.searchText && filter.searchText.trim()) {
            const searchLower = filter.searchText.toLowerCase();
            filtered = filtered.filter(log =>
                log.message.toLowerCase().includes(searchLower) ||
                log.technicalDetails?.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    /**
     * Calculate statistics
     */
    private calculateStatistics(logs: ErrorLog[]): ErrorLogStats {
        const bySeverity = {
            [ErrorSeverity.LOW]: 0,
            [ErrorSeverity.MEDIUM]: 0,
            [ErrorSeverity.HIGH]: 0,
            [ErrorSeverity.CRITICAL]: 0
        };

        const byContext = {
            [ErrorContext.SMS_API]: 0,
            [ErrorContext.FILE_OPERATION]: 0,
            [ErrorContext.DATA_VALIDATION]: 0,
            [ErrorContext.NETWORK]: 0,
            [ErrorContext.APPLICATION]: 0,
            [ErrorContext.USER_INPUT]: 0,
            [ErrorContext.TEMPLATE]: 0,
            [ErrorContext.UNKNOWN]: 0
        };

        let resolved = 0;
        let last24Hours = 0;
        const messageCounts = new Map<string, number>();
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        logs.forEach(log => {
            // Count by severity
            bySeverity[log.severity]++;

            // Count by context
            byContext[log.context]++;

            // Count resolved
            if (log.resolved) resolved++;

            // Count last 24 hours
            if (now - log.timestamp.getTime() < day) {
                last24Hours++;
            }

            // Count messages
            const count = messageCounts.get(log.message) || 0;
            messageCounts.set(log.message, count + 1);
        });

        // Find most common error
        let mostCommonError: { message: string; count: number } | undefined;
        messageCounts.forEach((count, message) => {
            if (!mostCommonError || count > mostCommonError.count) {
                mostCommonError = { message, count };
            }
        });

        return {
            total: logs.length,
            bySeverity,
            byContext,
            resolved,
            unresolved: logs.length - resolved,
            last24Hours,
            mostCommonError
        };
    }
}