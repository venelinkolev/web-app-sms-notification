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
    // Will be implemented in Task 5.3.4

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
     * Retry all failed messages (placeholder)
     */
    retryAllFailed(): void {
        // Will be implemented in Task 5.3.4
        console.log('Retry all failed - to be implemented');
    }

    /**
     * Retry individual message (placeholder)
     */
    retryIndividual(message: SMSSendResult): void {
        // Will be implemented in Task 5.3.4
        console.log('Retry individual message:', message.clientId);
    }

    // ==================== Export Functionality ====================
    // Will be implemented in Task 5.3.5

    /**
     * Export results to CSV (placeholder)
     */
    exportToCSV(): void {
        // Will be implemented in Task 5.3.5
        console.log('Export to CSV - to be implemented');
    }

    /**
     * Export results to JSON (placeholder)
     */
    exportToJSON(): void {
        // Will be implemented in Task 5.3.5
        console.log('Export to JSON - to be implemented');
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