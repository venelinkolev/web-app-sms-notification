import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

// Services
import { SendQueueService } from '../../core/services/send-queue.service';
import { SMSService } from '../../core/services/sms.service';
import { NotificationService } from '../../core/services/notification.service';

// Models
import { BatchOperationResult, SMSSendResult } from '../../core/models/sms.models';

/**
 * Send Results Component
 * 
 * Displays comprehensive results from batch SMS sending operation
 * 
 * Features:
 * - Summary statistics panel (total, success, failed, cost)
 * - Success/Failed message lists
 * - Retry failed messages functionality
 * - Export results to CSV/JSON
 * - Search and filtering capabilities
 * 
 * @example
 * ```html
 * <app-send-results></app-send-results>
 * ```
 */
@Component({
    selector: 'app-send-results',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './send-results.component.html',
    styleUrl: './send-results.component.scss',
    animations: [
        // List container animation
        trigger('listAnimation', [
            transition(':enter', [
                style({ opacity: 0, height: 0 }),
                animate('300ms ease-out', style({ opacity: 1, height: '*' }))
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0, height: 0 }))
            ])
        ]),
        // Individual item animation with stagger
        trigger('itemAnimation', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateX(-10px)' }),
                animate('200ms {{delay}}ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
            ], { params: { delay: 0 } })
        ])
    ]
})
export class SendResultsComponent implements OnInit, OnDestroy {

    // ==================== Component State ====================

    /** Batch operation result from last send */
    result: BatchOperationResult | null = null;

    /** Whether results are available */
    hasResults = false;

    /** Overall operation status */
    operationStatus: 'success' | 'partial' | 'failed' | null = null;

    /** Lists for display */
    successfulList: SMSSendResult[] = [];
    failedList: SMSSendResult[] = [];
    invalidList: Array<{ clientId: string; phoneNumber: string; reason: string }> = [];

    /** Filtered lists (based on search/filters) */
    filteredSuccessList: SMSSendResult[] = [];
    filteredFailedList: SMSSendResult[] = [];

    /** Filter state */
    filterStatus: 'all' | 'success' | 'failed' = 'all';
    searchText = '';

    /** Sort state */
    sortField: 'client' | 'phone' | 'error' = 'client';
    sortDirection: 'asc' | 'desc' = 'asc';

    /** UI state */
    showSuccessList = true;
    showFailedList = true;
    isRetrying = false;

    /** Subscription cleanup */
    private destroy$ = new Subject<void>();

    // ==================== Constructor & DI ====================

    constructor(
        private sendQueueService: SendQueueService,
        private smsService: SMSService,
        private notificationService: NotificationService
    ) { }

    // ==================== Lifecycle Hooks ====================

    /**
     * Component initialization
     * Subscribe to queue state to get last result
     */
    ngOnInit(): void {
        this.subscribeToQueueState();
    }

    /**
     * Component cleanup
     * Unsubscribe from all observables
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ==================== Subscription Management ====================

    /**
     * Subscribe to SendQueueService queue state
     * Extract lastResult when available
     */
    private subscribeToQueueState(): void {
        this.sendQueueService.queueState
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (queueState) => {
                    if (queueState.lastResult) {
                        this.result = queueState.lastResult;
                        this.processResults(queueState.lastResult);
                    } else {
                        this.clearResults();
                    }
                },
                error: (error) => {
                    console.error('Error subscribing to queue state:', error);
                    this.notificationService.error(
                        'Грешка при зареждане на резултати',
                        'Не можаха да се заредят резултатите от изпращането'
                    );
                }
            });
    }

    // ==================== Result Processing ====================

    /**
     * Process batch operation result
     * Extract lists, calculate status, setup filters
     */
    private processResults(result: BatchOperationResult): void {
        // Set flag
        this.hasResults = true;

        // Extract lists
        this.successfulList = result.successful || [];
        this.failedList = result.failed || [];
        this.invalidList = result.invalid || [];

        // Calculate operation status
        this.operationStatus = this.calculateOperationStatus(result);

        // Initialize filtered lists
        this.applyFilters();

        // Log results
        console.group('📊 Send Results Loaded');
        console.log('Total attempted:', result.stats.totalAttempted);
        console.log('Successful:', result.stats.successfulCount);
        console.log('Failed:', result.stats.failedCount);
        console.log('Invalid:', result.stats.invalidCount);
        console.log('Operation status:', this.operationStatus);
        console.groupEnd();
    }

    /**
     * Calculate overall operation status
     */
    private calculateOperationStatus(result: BatchOperationResult): 'success' | 'partial' | 'failed' {
        const successRate = result.stats.successRate;

        if (successRate === 1) {
            return 'success'; // 100% success
        } else if (successRate === 0) {
            return 'failed'; // 0% success (total failure)
        } else {
            return 'partial'; // Partial success (some failed)
        }
    }

    /**
     * Clear results state
     */
    private clearResults(): void {
        this.result = null;
        this.hasResults = false;
        this.operationStatus = null;
        this.successfulList = [];
        this.failedList = [];
        this.invalidList = [];
        this.filteredSuccessList = [];
        this.filteredFailedList = [];
    }

    // ==================== Filter & Search Logic ====================

    /**
     * Apply filters and search to lists
     */
    private applyFilters(): void {
        // Filter successful list
        this.filteredSuccessList = this.filterList(this.successfulList);

        // Filter failed list
        this.filteredFailedList = this.filterList(this.failedList);

        // Apply sorting
        this.applySorting();
    }

    /**
     * Filter a list based on search text
     */
    private filterList(list: SMSSendResult[]): SMSSendResult[] {
        if (!this.searchText || this.searchText.trim() === '') {
            return [...list];
        }

        const searchLower = this.searchText.toLowerCase();

        return list.filter(item =>
            item.clientId.toLowerCase().includes(searchLower) ||
            item.phoneNumber.toLowerCase().includes(searchLower) ||
            (item.error && item.error.toLowerCase().includes(searchLower))
        );
    }

    /**
     * Apply sorting to filtered lists
     */
    private applySorting(): void {
        // Sort successful list
        this.filteredSuccessList.sort((a, b) => this.compareFn(a, b));

        // Sort failed list
        this.filteredFailedList.sort((a, b) => this.compareFn(a, b));
    }

    /**
     * Comparison function for sorting
     */
    private compareFn(a: SMSSendResult, b: SMSSendResult): number {
        let comparison = 0;

        switch (this.sortField) {
            case 'client':
                comparison = a.clientId.localeCompare(b.clientId);
                break;
            case 'phone':
                comparison = a.phoneNumber.localeCompare(b.phoneNumber);
                break;
            case 'error':
                const errorA = a.error || '';
                const errorB = b.error || '';
                comparison = errorA.localeCompare(errorB);
                break;
        }

        return this.sortDirection === 'asc' ? comparison : -comparison;
    }

    // ==================== Event Handlers - Filters ====================

    /**
     * Handle filter status change
     * Task 5.3.3: Enhanced filtering
     */
    onFilterStatusChange(): void {
        this.applyFilters();
    }

    /**
     * Handle search text change
     * Task 5.3.3: Real-time search
     */
    onSearchChange(): void {
        this.applyFilters();
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.filterStatus = 'all';
        this.searchText = '';
        this.applyFilters();
    }

    /**
     * Handle sort field change
     */
    onSortChange(field: 'client' | 'phone' | 'error'): void {
        if (this.sortField === field) {
            // Toggle direction if same field
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to ascending
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        this.applySorting();
    }

    // ==================== Event Handlers - UI ====================

    /**
     * Toggle success list visibility
     */
    toggleSuccessList(): void {
        this.showSuccessList = !this.showSuccessList;
    }

    /**
     * Toggle failed list visibility
     */
    toggleFailedList(): void {
        this.showFailedList = !this.showFailedList;
    }

    // ==================== Retry Functionality ====================
    // Task 5.3.4: Full Implementation

    /**
     * Check if retry is available
     */
    canRetry(): boolean {
        return this.result?.canRetry || false;
    }

    /**
     * Get count of retryable messages
     */
    getRetryableCount(): number {
        return this.result?.retryableMessages.length || 0;
    }

    /**
     * Retry all failed messages
     * Task 5.3.4: Complete implementation
     */
    retryAllFailed(): void {
        if (!this.result || !this.canRetry()) {
            this.notificationService.warning(
                'Няма съобщения за retry',
                'Не са намерени съобщения, които могат да бъдат опитани отново'
            );
            return;
        }

        // Confirmation dialog
        const confirmMessage = this.buildRetryConfirmationMessage();
        const confirmed = confirm(confirmMessage);

        if (!confirmed) {
            return;
        }

        // Start retry operation
        this.isRetrying = true;

        this.smsService.retryFailedMessages(this.result).subscribe({
            next: (retryResult: BatchOperationResult) => {
                // Merge retry result with original result
                this.mergeRetryResults(retryResult);

                // Show success notification
                this.notificationService.success(
                    '✅ Retry завършен',
                    `Успешни: ${retryResult.stats.successfulCount} | Неуспешни: ${retryResult.stats.failedCount}`,
                    5000
                );

                this.isRetrying = false;
            },
            error: (error) => {
                console.error('Error retrying failed messages:', error);

                this.notificationService.error(
                    'Грешка при retry',
                    error.message || 'Неуспешно повторно изпращане'
                );

                this.isRetrying = false;
            }
        });
    }

    /**
     * Retry individual message
     * Task 5.3.4: Complete implementation
     */
    retryIndividual(message: SMSSendResult): void {
        if (!this.result || !message.errorCode) {
            return;
        }

        // Check if message is retryable
        const isRetryable = this.result.retryableMessages.some(
            rm => rm.clientId === message.clientId && rm.phoneNumber === message.phoneNumber
        );

        if (!isRetryable) {
            this.notificationService.warning(
                'Не може да се retry',
                'Това съобщение не може да бъде опитано отново'
            );
            return;
        }

        // Confirmation
        const confirmed = confirm(
            `Искате ли да опитате отново изпращането към:\n\n` +
            `Клиент: ${message.clientId}\n` +
            `Телефон: ${message.phoneNumber}\n\n` +
            `Грешка: ${message.error || 'Неизвестна'}`
        );

        if (!confirmed) {
            return;
        }

        // Create a temporary result with only this message for retry
        const singleMessageResult: BatchOperationResult = {
            successful: [],
            failed: [message],
            invalid: [],
            stats: {
                totalAttempted: 1,
                successfulCount: 0,
                failedCount: 1,
                invalidCount: 0,
                successRate: 0,
                failureRate: 1,
                totalCost: 0,
                averageCost: 0
            },
            canRetry: true,
            retryableMessages: [{
                clientId: message.clientId,
                phoneNumber: message.phoneNumber,
                message: message.message || '',
                errorCode: message.errorCode,
                errorMessage: message.error || ''
            }],
            metadata: this.result.metadata
        };

        // Start individual retry
        this.isRetrying = true;

        this.smsService.retryFailedMessages(singleMessageResult).subscribe({
            next: (retryResult: BatchOperationResult) => {
                // Update the specific message in our lists
                this.updateIndividualRetryResult(message, retryResult);

                // Show notification
                if (retryResult.stats.successfulCount > 0) {
                    this.notificationService.success(
                        '✅ SMS изпратен успешно',
                        `Съобщението до ${message.clientId} беше изпратено`
                    );
                } else {
                    this.notificationService.error(
                        '❌ Retry неуспешен',
                        `Съобщението до ${message.clientId} отново не можа да бъде изпратено`
                    );
                }

                this.isRetrying = false;
            },
            error: (error) => {
                console.error('Error retrying individual message:', error);

                this.notificationService.error(
                    'Грешка при retry',
                    error.message || 'Неуспешно повторно изпращане'
                );

                this.isRetrying = false;
            }
        });
    }

    /**
     * Build retry confirmation message
     * Task 5.3.4: Helper for user confirmation
     */
    private buildRetryConfirmationMessage(): string {
        if (!this.result) return '';

        const retryCount = this.getRetryableCount();
        const totalFailed = this.result.stats.failedCount;

        return (
            '🔄 ПОВТОРНО ИЗПРАЩАНЕ\n\n' +
            `Ще бъдат опитани отново ${retryCount} от ${totalFailed} неуспешни съобщения.\n\n` +
            `Текуща статистика:\n` +
            `✅ Успешни: ${this.result.stats.successfulCount}\n` +
            `❌ Неуспешни: ${this.result.stats.failedCount}\n\n` +
            `Сигурни ли сте, че искате да продължите?`
        );
    }

    /**
     * Merge retry results with original results
     * Task 5.3.4: Update state after retry
     */
    private mergeRetryResults(retryResult: BatchOperationResult): void {
        if (!this.result) return;

        // Remove retry-successful messages from failed list
        const retrySuccessfulPhones = new Set(
            retryResult.successful.map(s => s.phoneNumber)
        );

        this.result.failed = this.result.failed.filter(
            f => !retrySuccessfulPhones.has(f.phoneNumber)
        );

        // Add retry-successful to successful list
        this.result.successful.push(...retryResult.successful);

        // Update retry-failed in failed list (with new error info)
        retryResult.failed.forEach(retryFailed => {
            const existingIndex = this.result!.failed.findIndex(
                f => f.phoneNumber === retryFailed.phoneNumber
            );

            if (existingIndex >= 0) {
                // Update with new error info
                this.result!.failed[existingIndex] = retryFailed;
            } else {
                // Add if not found (shouldn't happen)
                this.result!.failed.push(retryFailed);
            }
        });

        // Recalculate stats
        this.result.stats = this.recalculateStats(this.result);

        // Update operation status
        this.operationStatus = this.calculateOperationStatus(this.result);

        // Refresh lists
        this.successfulList = this.result.successful;
        this.failedList = this.result.failed;
        this.applyFilters();

        // Update in SendQueueService
        // Note: We don't have direct access to update SendQueueService,
        // but the component already subscribes to it, so manual update here
    }

    /**
     * Update individual retry result
     * Task 5.3.4: Update state after single message retry
     */
    private updateIndividualRetryResult(
        originalMessage: SMSSendResult,
        retryResult: BatchOperationResult
    ): void {
        if (!this.result) return;

        if (retryResult.stats.successfulCount > 0) {
            // Retry successful - move from failed to successful
            this.result.failed = this.result.failed.filter(
                f => f.phoneNumber !== originalMessage.phoneNumber
            );

            this.result.successful.push(...retryResult.successful);
        } else {
            // Retry failed - update error info
            const failedIndex = this.result.failed.findIndex(
                f => f.phoneNumber === originalMessage.phoneNumber
            );

            if (failedIndex >= 0 && retryResult.failed.length > 0) {
                this.result.failed[failedIndex] = retryResult.failed[0];
            }
        }

        // Recalculate stats
        this.result.stats = this.recalculateStats(this.result);

        // Update operation status
        this.operationStatus = this.calculateOperationStatus(this.result);

        // Refresh lists
        this.successfulList = this.result.successful;
        this.failedList = this.result.failed;
        this.applyFilters();
    }

    /**
     * Recalculate statistics after retry
     * Task 5.3.4: Helper for stats update
     */
    private recalculateStats(result: BatchOperationResult): BatchOperationResult['stats'] {
        const totalAttempted = result.successful.length + result.failed.length;
        const successfulCount = result.successful.length;
        const failedCount = result.failed.length;
        const invalidCount = result.invalid.length;

        const totalCost = result.successful.reduce((sum, s) => sum + (s.cost || 0), 0);
        const averageCost = successfulCount > 0 ? totalCost / successfulCount : 0;

        const successRate = totalAttempted > 0 ? successfulCount / totalAttempted : 0;
        const failureRate = totalAttempted > 0 ? failedCount / totalAttempted : 0;

        return {
            totalAttempted,
            successfulCount,
            failedCount,
            invalidCount,
            successRate,
            failureRate,
            totalCost,
            averageCost
        };
    }

    // ==================== Export Functionality ====================
    // Task 5.3.5: Full Implementation

    /**
     * Export results to CSV
     * Task 5.3.5: Complete implementation
     */
    exportToCSV(): void {
        if (!this.result) {
            this.notificationService.warning(
                'Няма резултати',
                'Няма данни за експортиране'
            );
            return;
        }

        try {
            // Build CSV content
            const csvContent = this.buildCSVContent();

            // Create filename with timestamp
            const filename = this.generateFilename('csv');

            // Download file
            this.downloadFile(csvContent, filename, 'text/csv');

            // Success notification
            this.notificationService.success(
                '📄 CSV експортиран',
                `Файлът ${filename} беше изтеглен успешно`,
                4000
            );

            // Log export
            console.log('📥 CSV exported:', filename);
        } catch (error) {
            console.error('Error exporting CSV:', error);

            this.notificationService.error(
                'Грешка при експорт',
                'Не можа да се експортира CSV файлът'
            );
        }
    }

    /**
     * Export results to JSON
     * Task 5.3.5: Complete implementation
     */
    exportToJSON(): void {
        if (!this.result) {
            this.notificationService.warning(
                'Няма резултати',
                'Няма данни за експортиране'
            );
            return;
        }

        try {
            // Convert result to JSON with formatting
            const jsonContent = JSON.stringify(this.result, null, 2);

            // Create filename with timestamp
            const filename = this.generateFilename('json');

            // Download file
            this.downloadFile(jsonContent, filename, 'application/json');

            // Success notification
            this.notificationService.success(
                '📋 JSON експортиран',
                `Файлът ${filename} беше изтеглен успешно`,
                4000
            );

            // Log export
            console.log('📥 JSON exported:', filename);
        } catch (error) {
            console.error('Error exporting JSON:', error);

            this.notificationService.error(
                'Грешка при експорт',
                'Не можа да се експортира JSON файлът'
            );
        }
    }

    /**
     * Build CSV content from results
     * Task 5.3.5: CSV generation logic
     */
    private buildCSVContent(): string {
        if (!this.result) return '';

        // CSV Headers
        const headers = [
            'Клиент',
            'Телефон',
            'Статус',
            'Грешка',
            'Код на грешка',
            'Цена (BGN)',
            'Време на изпращане'
        ];

        // Build rows
        const rows: string[][] = [];

        // Add successful messages
        this.result.successful.forEach(item => {
            rows.push([
                this.escapeCSV(item.clientId),
                this.escapeCSV(item.phoneNumber),
                'Успешно',
                '',
                '',
                (item.cost || 0).toFixed(2),
                this.formatTimestamp(item.timestamp)
            ]);
        });

        // Add failed messages
        this.result.failed.forEach(item => {
            rows.push([
                this.escapeCSV(item.clientId),
                this.escapeCSV(item.phoneNumber),
                'Неуспешно',
                this.escapeCSV(item.error || 'Неизвестна грешка'),
                String(item.errorCode || ''),
                '',
                this.formatTimestamp(item.timestamp)
            ]);
        });

        // Add invalid numbers
        this.result.invalid.forEach(item => {
            rows.push([
                this.escapeCSV(item.clientId),
                this.escapeCSV(item.phoneNumber),
                'Невалиден',
                this.escapeCSV(item.reason),
                '',
                '',
                ''
            ]);
        });

        // Combine into CSV string
        const csvLines = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ];

        return csvLines.join('\n');
    }

    /**
     * Escape CSV field (handle commas, quotes, newlines)
     * Task 5.3.5: CSV escaping helper
     */
    private escapeCSV(field: string): string {
        if (!field) return '';

        // If field contains comma, quote, or newline - wrap in quotes and escape quotes
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return `"${field.replace(/"/g, '""')}"`;
        }

        return field;
    }

    /**
     * Generate filename with timestamp
     * Task 5.3.5: Filename generation
     */
    private generateFilename(extension: 'csv' | 'json'): string {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        return `sms-results-${year}-${month}-${day}-${hours}${minutes}${seconds}.${extension}`;
    }

    /**
     * Download file using Blob API
     * Task 5.3.5: File download helper
     */
    private downloadFile(content: string, filename: string, mimeType: string): void {
        // Create Blob
        const blob = new Blob([content], { type: mimeType });

        // Create download URL
        const url = window.URL.createObjectURL(blob);

        // Create temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    // ==================== Helper Methods ====================

    /**
     * Get status icon
     */
    getStatusIcon(): string {
        switch (this.operationStatus) {
            case 'success':
                return '✅';
            case 'partial':
                return '⚠️';
            case 'failed':
                return '❌';
            default:
                return '📊';
        }
    }

    /**
     * Get status text
     */
    getStatusText(): string {
        switch (this.operationStatus) {
            case 'success':
                return 'Успешно изпращане';
            case 'partial':
                return 'Частично успешно';
            case 'failed':
                return 'Неуспешно изпращане';
            default:
                return 'Няма резултати';
        }
    }

    /**
     * Get status CSS class
     */
    getStatusClass(): string {
        switch (this.operationStatus) {
            case 'success':
                return 'status-success';
            case 'partial':
                return 'status-partial';
            case 'failed':
                return 'status-failed';
            default:
                return 'status-default';
        }
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp: Date): string {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        return date.toLocaleString('bg-BG', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Format cost
     */
    formatCost(cost: number): string {
        return cost.toFixed(2) + ' BGN';
    }

    /**
     * Format duration
     */
    formatDuration(durationMs: number): string {
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        if (minutes > 0) {
            return `${minutes}м ${remainingSeconds}с`;
        } else {
            return `${remainingSeconds}с`;
        }
    }

    /**
     * Get success rate percentage
     * Task 5.3.2: For visual indicators
     */
    getSuccessRatePercentage(): number {
        if (!this.result) return 0;
        return Math.round(this.result.stats.successRate * 100);
    }

    /**
     * Get failure rate percentage
     * Task 5.3.2: For visual indicators
     */
    getFailureRatePercentage(): number {
        if (!this.result) return 0;
        return Math.round(this.result.stats.failureRate * 100);
    }

    /**
     * Get success rate color class
     * Task 5.3.2: For visual color coding
     */
    getSuccessRateColorClass(): string {
        const rate = this.getSuccessRatePercentage();
        if (rate >= 90) return 'rate-excellent';
        if (rate >= 70) return 'rate-good';
        if (rate >= 50) return 'rate-medium';
        return 'rate-poor';
    }

    /**
     * Get average cost per SMS
     * Task 5.3.2: For statistics
     */
    getAverageCost(): number {
        if (!this.result) return 0;
        return this.result.stats.averageCost || 0;
    }

    /**
     * Get SVG path for circular progress indicator
     * Task 5.3.2: For visual ring/circle chart
     */
    getCircleProgressPath(percentage: number): string {
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;
        return `${circumference} ${offset}`;
    }
}