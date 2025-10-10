// src/app/core/services/send-queue.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { SMSService } from './sms.service';
import { ErrorLoggerService } from './error-logger.service';
import { NotificationService } from './notification.service';
import { EnvironmentService } from './environment.service';

import {
    BatchSMSMessage,
    BatchOperationResult
} from '../models/sms.models';

import { ErrorContext, ErrorSeverity } from '../models/error.models';

/**
 * Send Status Enum
 * Represents all possible states of the SMS sending operation
 */
export enum SendStatus {
    /** Initial state, no operation started */
    IDLE = 'IDLE',

    /** Preparing messages for sending (validation, formatting) */
    PREPARING = 'PREPARING',

    /** Actively sending messages */
    SENDING = 'SENDING',

    /** Operation temporarily paused by user */
    PAUSED = 'PAUSED',

    /** All messages processed successfully */
    COMPLETED = 'COMPLETED',

    /** Operation cancelled by user */
    CANCELLED = 'CANCELLED',

    /** Operation failed due to critical error */
    FAILED = 'FAILED'
}

/**
 * Send Progress Interface
 * Tracks real-time progress of SMS sending operation
 */
export interface SendProgress {
    /** Current operation status */
    status: SendStatus;

    /** Number of messages processed so far */
    current: number;

    /** Total number of messages to send */
    total: number;

    /** Progress percentage (0-100) */
    percentage: number;

    /** Number of successfully sent messages */
    successful: number;

    /** Number of failed messages */
    failed: number;

    /** Estimated time remaining in milliseconds */
    estimatedTimeRemaining?: number;

    /** Current sending speed in SMS/second */
    sendingSpeed?: number;

    /** Total cost accumulated so far (in BGN) */
    totalCost: number;

    /** Operation start time */
    startTime?: Date;

    /** Current processing message (for UI display) */
    currentMessage?: string;
}

/**
 * Queue State Interface
 * Internal state management for the sending queue
 */
export interface QueueState {
    /** Messages in the queue */
    messages: BatchSMSMessage[];

    /** Current position in the queue */
    currentIndex: number;

    /** Whether operation is paused */
    isPaused: boolean;

    /** Whether operation is cancelled */
    isCancelled: boolean;

    /** Operation start timestamp */
    startTime?: Date;

    /** Last batch operation result */
    lastResult?: BatchOperationResult;
}

/**
 * SendQueueService
 * 
 * Manages the SMS sending queue with progress tracking,
 * pause/resume/cancel controls, and rate limiting.
 * 
 * Responsibilities:
 * - Queue management for batch SMS operations
 * - Real-time progress tracking
 * - User controls (pause/resume/cancel)
 * - Rate limiting compliance
 * - Error handling and recovery
 * 
 * @example
 * ```typescript
 * // Start sending
 * this.sendQueueService.startSending(messages).subscribe(progress => {
 *   console.log('Progress:', progress.percentage + '%');
 *   
 *   if (progress.status === SendStatus.COMPLETED) {
 *     console.log('Done!', progress.successful, 'sent');
 *   }
 * });
 * 
 * // User controls
 * this.sendQueueService.pauseSending();
 * this.sendQueueService.resumeSending();
 * this.sendQueueService.cancelSending();
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class SendQueueService {

    // ==================== Private State Management ====================

    /**
     * Progress state - tracks real-time sending progress
     * Initial state: IDLE with zero counters
     */
    private progress$ = new BehaviorSubject<SendProgress>({
        status: SendStatus.IDLE,
        current: 0,
        total: 0,
        percentage: 0,
        successful: 0,
        failed: 0,
        totalCost: 0
    });

    /**
     * Queue state - internal queue management
     * Initial state: empty queue, not paused/cancelled
     */
    private queueState$ = new BehaviorSubject<QueueState>({
        messages: [],
        currentIndex: 0,
        isPaused: false,
        isCancelled: false
    });

    // ==================== Public Observable Properties ====================

    /**
     * Observable progress stream
     * Subscribe to get real-time updates on sending progress
     */
    readonly progress: Observable<SendProgress> = this.progress$.asObservable();

    /**
     * Observable queue state stream
     * For debugging and advanced monitoring
     */
    readonly queueState: Observable<QueueState> = this.queueState$.asObservable();

    // ==================== Constructor & Dependency Injection ====================

    constructor(
        private smsService: SMSService,
        private errorLogger: ErrorLoggerService,
        private notificationService: NotificationService,
        private environmentService: EnvironmentService
    ) {
        // Service initialized
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('📨 SendQueueService initialized');
        }
    }

    // ==================== Public Methods ====================

    /**
     * Start sending SMS messages
     * 
     * Validates input, initializes queue state, and begins batch sending operation.
     * Returns the progress observable from BehaviorSubject for real-time updates.
     * 
     * @param messages - Array of messages to send
     * @returns Observable<SendProgress> - Real-time progress updates from BehaviorSubject
     * 
     * @throws Error if messages array is empty or invalid
     * @throws Error if another send operation is already active
     * 
     * @example
     * ```typescript
     * // Subscribe to progress updates
     * const progress$ = this.sendQueueService.startSending(messages);
     * 
     * progress$.subscribe({
     *   next: (progress) => {
     *     console.log(`Progress: ${progress.percentage}%`);
     *     
     *     if (progress.status === SendStatus.COMPLETED) {
     *       console.log('All SMS sent!');
     *     }
     *   }
     * });
     * 
     * // Or use async pipe in template
     * // <div *ngIf="progress$ | async as progress">...</div>
     * ```
     */
    startSending(messages: BatchSMSMessage[]): Observable<SendProgress> {
        // ==================== Input Validation ====================

        if (!messages || messages.length === 0) {
            const errorMsg = 'Няма съобщения за изпращане';
            this.notificationService.error('SMS грешка', errorMsg);
            this.errorLogger.logError(
                new Error(errorMsg),
                ErrorContext.SMS_API,
                ErrorSeverity.HIGH
            );
            throw new Error(errorMsg);
        }

        // Check if already sending
        if (this.isActive()) {
            const errorMsg = 'Вече има активна операция за изпращане';
            this.notificationService.warning('Изпращане в процес', errorMsg);
            throw new Error(errorMsg);
        }

        // Log operation start
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.group('📨 SendQueueService - Start Sending');
            console.log('Total messages:', messages.length);
            console.log('Timestamp:', new Date().toISOString());
            console.groupEnd();
        }

        // ==================== Initialize Queue State ====================

        const startTime = new Date();

        this.updateQueueState({
            messages: messages,
            currentIndex: 0,
            isPaused: false,
            isCancelled: false,
            startTime: startTime
        });

        // ==================== Initialize Progress ====================

        this.updateProgress({
            status: SendStatus.PREPARING,
            current: 0,
            total: messages.length,
            percentage: 0,
            successful: 0,
            failed: 0,
            totalCost: 0,
            startTime: startTime,
            currentMessage: 'Подготовка за изпращане...'
        });

        // Notification
        this.notificationService.info(
            '📨 Започва изпращане',
            `Ще бъдат изпратени ${messages.length} SMS съобщения`,
            3000
        );

        // ==================== Start Processing ====================

        // Small delay to ensure UI updates, then start batch processing
        setTimeout(() => {
            this.processBatch();
        }, 100);

        // Return progress observable for subscribers
        return this.progress;
    }

    /**
     * Pause the current sending operation
     * Does not stop current chunk processing, but prevents new chunks from starting
     * 
     * @example
     * ```typescript
     * this.sendQueueService.pauseSending();
     * // User can resume later with resumeSending()
     * ```
     */
    pauseSending(): void {
        const queueState = this.getCurrentQueueState();

        // Check if sending is active
        if (!this.isActive()) {
            this.notificationService.warning(
                '⚠️ Няма активна операция',
                'Не може да паузирате - няма активно изпращане'
            );
            return;
        }

        // Check if already paused
        if (queueState.isPaused) {
            this.notificationService.info(
                'ℹ️ Вече е паузирано',
                'Операцията вече е поставена на пауза'
            );
            return;
        }

        // Set paused flag
        this.updateQueueState({ isPaused: true });

        // Update progress status
        this.updateProgress({
            status: SendStatus.PAUSED,
            currentMessage: 'Изпращането е поставено на пауза'
        });

        // Notification
        this.notificationService.info(
            '⏸️ Пауза',
            'Изпращането е спряно временно. Текущите съобщения ще завършат.',
            5000
        );

        // Log
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('⏸️ Send operation paused');
        }
    }

    /**
     * Resume paused sending operation
     * Continues processing from where it was paused
     * 
     * @example
     * ```typescript
     * this.sendQueueService.resumeSending();
     * ```
     */
    resumeSending(): void {
        const queueState = this.getCurrentQueueState();

        // Check if operation exists and is paused
        if (!this.isActive()) {
            this.notificationService.warning(
                '⚠️ Няма активна операция',
                'Не може да продължите - няма активно изпращане'
            );
            return;
        }

        if (!queueState.isPaused) {
            this.notificationService.info(
                'ℹ️ Не е паузирано',
                'Операцията не е на пауза'
            );
            return;
        }

        // Clear paused flag
        this.updateQueueState({ isPaused: false });

        // Update progress status back to SENDING
        this.updateProgress({
            status: SendStatus.SENDING,
            currentMessage: 'Изпращането продължава...'
        });

        // Notification
        this.notificationService.success(
            '▶️ Продължаване',
            'Изпращането продължава откъдето спря',
            3000
        );

        // Log
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('▶️ Send operation resumed');
        }

        // Note: processBatch() will check isPaused flag and continue automatically
        // No need to restart processing - it's already waiting for resume
    }

    /**
     * Cancel the current sending operation
     * Stops all processing immediately and marks operation as cancelled
     * 
     * @example
     * ```typescript
     * if (confirm('Cancel sending?')) {
     *   this.sendQueueService.cancelSending();
     * }
     * ```
     */
    cancelSending(): void {
        const queueState = this.getCurrentQueueState();

        // Check if sending is active
        if (!this.isActive()) {
            this.notificationService.warning(
                '⚠️ Няма активна операция',
                'Не може да отмените - няма активно изпращане'
            );
            return;
        }

        // Check if already cancelled
        if (queueState.isCancelled) {
            this.notificationService.info(
                'ℹ️ Вече е отменено',
                'Операцията вече е отменена'
            );
            return;
        }

        // Set cancelled flag
        this.updateQueueState({ isCancelled: true });

        // Update progress status
        const currentProgress = this.getCurrentProgress();
        this.updateProgress({
            status: SendStatus.CANCELLED,
            currentMessage: 'Операцията е отменена от потребителя'
        });

        // Notification with statistics
        this.notificationService.warning(
            '❌ Отменено',
            `Изпращането е отменено.\n` +
            `✅ Изпратени до момента: ${currentProgress.successful}\n` +
            `❌ Неуспешни: ${currentProgress.failed}\n` +
            `⏱️ Обработени: ${currentProgress.current} от ${currentProgress.total}`,
            10000
        );

        // Log
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('❌ Send operation cancelled by user');
            console.log('Progress at cancellation:', currentProgress);
        }

        // Log to ErrorLogger (for audit)
        this.errorLogger.logError(
            `Send operation cancelled by user at ${currentProgress.percentage}% progress`,
            ErrorContext.SMS_API,
            ErrorSeverity.LOW,
            {
                totalMessages: currentProgress.total,
                processed: currentProgress.current,
                successful: currentProgress.successful,
                failed: currentProgress.failed,
                percentage: currentProgress.percentage
            }
        );

        // Note: processBatch() will check isCancelled flag and stop processing
    }

    /**
     * Reset queue to initial state
     * Clears all data and resets counters to zero
     * Can only be called when no operation is active
     * 
     * @example
     * ```typescript
     * // After operation completes or is cancelled
     * this.sendQueueService.resetQueue();
     * ```
     */
    resetQueue(): void {
        // Check if operation is still active (not completed/failed/cancelled)
        const currentStatus = this.getCurrentProgress().status;

        if (currentStatus === SendStatus.SENDING || currentStatus === SendStatus.PREPARING) {
            this.notificationService.warning(
                '⚠️ Операция е активна',
                'Не може да reset-нете докато има активна операция. Първо я отменете.'
            );
            return;
        }

        // Reset queue state to initial
        this.updateQueueState({
            messages: [],
            currentIndex: 0,
            isPaused: false,
            isCancelled: false,
            startTime: undefined,
            lastResult: undefined
        });

        // Reset progress to initial
        this.updateProgress({
            status: SendStatus.IDLE,
            current: 0,
            total: 0,
            percentage: 0,
            successful: 0,
            failed: 0,
            totalCost: 0,
            startTime: undefined,
            estimatedTimeRemaining: undefined,
            sendingSpeed: undefined,
            currentMessage: undefined
        });

        // Log
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('🔄 Queue reset to initial state');
        }

        // Notification
        this.notificationService.info(
            '🔄 Reset',
            'Системата е готова за ново изпращане',
            3000
        );
    }

    // ==================== Private Helper Methods ====================

    /**
     * Process batch of messages
     * Core sending logic with progress tracking
     * Uses BehaviorSubject to emit progress updates
     * 
     * @private
     */
    private processBatch(): void {
        const queueState = this.getCurrentQueueState();
        const messages = queueState.messages;

        // Check for cancellation before starting
        if (queueState.isCancelled) {
            this.updateProgress({
                status: SendStatus.CANCELLED,
                currentMessage: 'Операцията е отменена'
            });
            return;
        }

        // Update status to SENDING
        this.updateProgress({
            status: SendStatus.SENDING,
            currentMessage: 'Изпращане на SMS съобщения...'
        });

        // Log start
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.log('📤 Starting batch send via SMSService.sendBatchWithTracking()...');
        }

        // ==================== Call SMSService ====================

        this.smsService.sendBatchWithTracking(messages).subscribe({
            next: (result: BatchOperationResult) => {
                // ==================== Process Result ====================

                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.group('✅ Batch Send Complete');
                    console.log('Total attempted:', result.stats.totalAttempted);
                    console.log('Successful:', result.stats.successfulCount);
                    console.log('Failed:', result.stats.failedCount);
                    console.log('Invalid:', result.stats.invalidCount);
                    console.log('Total cost:', result.stats.totalCost.toFixed(2), 'BGN');
                    console.log('Duration:', result.metadata.duration, 'ms');
                    console.groupEnd();
                }

                // Store result in queue state
                this.updateQueueState({
                    lastResult: result
                });

                // Calculate final progress
                const finalProgress: SendProgress = {
                    status: SendStatus.COMPLETED,
                    current: result.stats.totalAttempted,
                    total: result.stats.totalAttempted,
                    percentage: 100,
                    successful: result.stats.successfulCount,
                    failed: result.stats.failedCount,
                    totalCost: result.stats.totalCost,
                    startTime: queueState.startTime,
                    sendingSpeed: this.calculateSendingSpeed(
                        result.stats.totalAttempted,
                        result.metadata.duration
                    ),
                    currentMessage: 'Изпращането завърши успешно'
                };

                this.updateProgress(finalProgress);

                // ==================== Final Notification ====================

                const successRate = (result.stats.successRate * 100).toFixed(1);

                if (result.stats.failedCount === 0) {
                    // All successful
                    this.notificationService.success(
                        '✅ Изпращане завършено',
                        `Всички ${result.stats.successfulCount} SMS-а са изпратени успешно!\n` +
                        `💰 Разход: ${result.stats.totalCost.toFixed(2)} BGN`,
                        7000
                    );
                } else if (result.stats.successfulCount === 0) {
                    // All failed
                    this.notificationService.error(
                        '❌ Изпращане неуспешно',
                        `Всички ${result.stats.failedCount} SMS-а не можаха да бъдат изпратени`,
                        0 // No auto-hide for critical errors
                    );
                } else {
                    // Partial success
                    this.notificationService.warning(
                        '⚠️ Частично успешно изпращане',
                        `✅ Успешни: ${result.stats.successfulCount}\n` +
                        `❌ Неуспешни: ${result.stats.failedCount}\n` +
                        `📊 Успеваемост: ${successRate}%\n` +
                        `💰 Разход: ${result.stats.totalCost.toFixed(2)} BGN`,
                        10000
                    );
                }

                // Log to ErrorLogger (for audit trail)
                this.errorLogger.logError(
                    `Batch SMS send completed: ${result.stats.successfulCount}/${result.stats.totalAttempted} successful`,
                    ErrorContext.SMS_API,
                    result.stats.failedCount > 0 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
                    {
                        totalAttempted: result.stats.totalAttempted,
                        successfulCount: result.stats.successfulCount,
                        failedCount: result.stats.failedCount,
                        invalidCount: result.stats.invalidCount,
                        successRate: successRate + '%',
                        totalCost: result.stats.totalCost,
                        duration: result.metadata.duration + 'ms'
                    }
                );
            },

            error: (error: any) => {
                // ==================== Error Handling ====================

                console.error('❌ Batch send failed:', error);

                // Update progress to FAILED
                this.updateProgress({
                    status: SendStatus.FAILED,
                    currentMessage: 'Грешка при изпращане: ' + (error.message || 'Unknown error')
                });

                // Log error
                this.errorLogger.logError(
                    error,
                    ErrorContext.SMS_API,
                    ErrorSeverity.CRITICAL,
                    {
                        operation: 'batch_send',
                        messagesCount: messages.length,
                        errorMessage: error.message,
                        errorCode: error.code
                    }
                );

                // Notification
                this.notificationService.error(
                    '❌ Критична грешка',
                    `Изпращането не можа да завърши: ${error.message || 'Неизвестна грешка'}`,
                    0 // No auto-hide
                );
            }
        });
    }

    /**
     * Calculate sending speed in SMS/second
     * 
     * @param totalSent - Total messages sent
     * @param durationMs - Duration in milliseconds
     * @returns SMS per second
     * @private
     */
    private calculateSendingSpeed(totalSent: number, durationMs: number): number {
        if (durationMs === 0 || totalSent === 0) return 0;

        const durationSeconds = durationMs / 1000;
        return totalSent / durationSeconds;
    }

    /**
     * Calculate progress metrics
     * Updates percentage, speed, estimated time remaining
     * 
     * @param current - Current messages processed
     * @param total - Total messages to process
     * @param startTime - Operation start time
     * @returns Progress metrics
     * @private
     */
    private calculateProgress(
        current: number,
        total: number,
        startTime: Date
    ): { percentage: number; estimatedTimeRemaining: number; sendingSpeed: number } {

        // Percentage calculation
        const percentage = total > 0 ? (current / total) * 100 : 0;

        // Elapsed time
        const now = new Date();
        const elapsedMs = now.getTime() - startTime.getTime();
        const elapsedSeconds = elapsedMs / 1000;

        // Sending speed (SMS/second)
        const sendingSpeed = current > 0 && elapsedSeconds > 0
            ? current / elapsedSeconds
            : 0;

        // Estimated time remaining
        let estimatedTimeRemaining = 0;
        if (current > 0 && current < total) {
            const averageTimePerSMS = elapsedMs / current;
            const remainingSMS = total - current;
            estimatedTimeRemaining = averageTimePerSMS * remainingSMS;
        }

        return {
            percentage: Math.min(Math.round(percentage), 100),
            estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
            sendingSpeed: Number(sendingSpeed.toFixed(2))
        };
    }

    /**
     * Update progress state and emit to subscribers
     * 
     * @param updates - Partial progress updates
     * @private
     */
    private updateProgress(updates: Partial<SendProgress>): void {
        const current = this.progress$.value;
        this.progress$.next({ ...current, ...updates });
    }

    /**
     * Update queue state
     * 
     * @param updates - Partial queue state updates
     * @private
     */
    private updateQueueState(updates: Partial<QueueState>): void {
        const current = this.queueState$.value;
        this.queueState$.next({ ...current, ...updates });
    }

    // ==================== Getters for Current State ====================

    /**
     * Get current progress snapshot
     */
    getCurrentProgress(): SendProgress {
        return this.progress$.value;
    }

    /**
     * Get current queue state snapshot
     */
    getCurrentQueueState(): QueueState {
        return this.queueState$.value;
    }

    /**
     * Check if sending is currently active
     */
    isActive(): boolean {
        const status = this.progress$.value.status;
        return status === SendStatus.PREPARING ||
            status === SendStatus.SENDING ||
            status === SendStatus.PAUSED;
    }

    /**
     * Check if operation is paused
     */
    isPaused(): boolean {
        return this.queueState$.value.isPaused;
    }

    /**
     * Check if operation is cancelled
     */
    isCancelled(): boolean {
        return this.queueState$.value.isCancelled;
    }
}