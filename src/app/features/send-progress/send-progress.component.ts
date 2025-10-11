import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// Services
import { SendQueueService } from '../../core/services/send-queue.service';
import { NotificationService } from '../../core/services/notification.service';

// Models
import { SendProgress, SendStatus } from '../../core/services/send-queue.service';

/**
 * Send Progress Component
 * 
 * Displays real-time SMS sending progress with user controls
 * 
 * Features:
 * - Animated progress bar (0-100%)
 * - Live statistics (current/total, success/failed, cost, speed)
 * - User control buttons (pause/resume/cancel)
 * - Status-based color coding
 * - Responsive design
 * 
 * @example
 * ```html
 * <app-send-progress></app-send-progress>
 * ```
 */
@Component({
    selector: 'app-send-progress',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './send-progress.component.html',
    styleUrl: './send-progress.component.scss'
})
export class SendProgressComponent implements OnInit, OnDestroy {

    // ==================== Component State ====================

    /** Current progress snapshot */
    progress: SendProgress | null = null;

    /** Whether sending operation is active */
    isActive = false;

    /** Whether operation is paused */
    isPaused = false;

    /** Whether pause button should be enabled */
    canPause = false;

    /** Whether resume button should be enabled */
    canResume = false;

    /** Whether cancel button should be enabled */
    canCancel = false;

    /** SendStatus enum for template usage */
    SendStatus = SendStatus;

    /** Subscription cleanup */
    private destroy$ = new Subject<void>();

    // ==================== Constructor & DI ====================

    constructor(
        private sendQueueService: SendQueueService,
        private notificationService: NotificationService
    ) { }

    // ==================== Lifecycle Hooks ====================

    /**
     * Component initialization
     * Subscribe to progress updates from SendQueueService
     * Setup keyboard shortcuts
     */
    ngOnInit(): void {
        this.subscribeToProgress();
        this.setupKeyboardShortcuts();
    }

    /**
     * Component cleanup
     * Unsubscribe from all observables
     * Remove keyboard listeners
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.removeKeyboardShortcuts();
    }

    // ==================== Private Methods ====================

    /**
     * Subscribe to SendQueueService progress updates
     * Updates component state based on progress changes
     */
    private subscribeToProgress(): void {
        this.sendQueueService.progress
            .pipe(takeUntil(this.destroy$))
            .subscribe(progress => {
                this.progress = progress;
                this.updateButtonStates(progress);
            });
    }

    /**
     * Setup keyboard shortcuts for user controls
     * Space = Pause/Resume
     * Escape = Cancel
     */
    private setupKeyboardShortcuts(): void {
        this.keyboardHandler = this.handleKeyboardEvent.bind(this);
        document.addEventListener('keydown', this.keyboardHandler);
    }

    /**
     * Remove keyboard shortcuts listeners
     */
    private removeKeyboardShortcuts(): void {
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
    }

    /**
     * Handle keyboard events
     */
    private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;

    private handleKeyboardEvent(event: KeyboardEvent): void {
        // Only handle shortcuts when operation is active
        if (!this.isActive) return;

        // Ignore if user is typing in input field
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        switch (event.key) {
            case ' ': // Space key
                event.preventDefault();
                if (this.canPause) {
                    this.onPause();
                } else if (this.canResume) {
                    this.onResume();
                }
                break;

            case 'Escape': // Escape key
                event.preventDefault();
                if (this.canCancel) {
                    this.onCancel();
                }
                break;
        }
    }

    /**
     * Update button states based on current progress
     * Determines which control buttons should be enabled
     * 
     * @param progress - Current progress state
     */
    private updateButtonStates(progress: SendProgress): void {
        this.isActive = this.isOperationActive(progress.status);
        this.isPaused = progress.status === SendStatus.PAUSED;

        // Pause button: enabled when SENDING (not paused)
        this.canPause = progress.status === SendStatus.SENDING && !this.isPaused;

        // Resume button: enabled when PAUSED
        this.canResume = progress.status === SendStatus.PAUSED;

        // Cancel button: enabled when active (PREPARING, SENDING, PAUSED)
        this.canCancel = this.isActive;
    }

    /**
     * Check if operation is in active state
     * 
     * @param status - Current send status
     * @returns True if operation is active
     */
    private isOperationActive(status: SendStatus): boolean {
        return status === SendStatus.PREPARING ||
            status === SendStatus.SENDING ||
            status === SendStatus.PAUSED;
    }

    // ==================== Public Methods - UI Helpers ====================

    /**
     * Get status display text in Bulgarian
     * 
     * @returns Status text for UI display
     */
    getStatusText(): string {
        if (!this.progress) return '';

        const statusTexts: Record<SendStatus, string> = {
            [SendStatus.IDLE]: 'Готов',
            [SendStatus.PREPARING]: 'Подготовка...',
            [SendStatus.SENDING]: 'Изпращане...',
            [SendStatus.PAUSED]: 'На пауза',
            [SendStatus.COMPLETED]: 'Завършено',
            [SendStatus.CANCELLED]: 'Отменено',
            [SendStatus.FAILED]: 'Грешка'
        };

        return statusTexts[this.progress.status] || '';
    }

    /**
     * Get status icon emoji
     * 
     * @returns Icon emoji for current status
     */
    getStatusIcon(): string {
        if (!this.progress) return '';

        const statusIcons: Record<SendStatus, string> = {
            [SendStatus.IDLE]: '📋',
            [SendStatus.PREPARING]: '⏳',
            [SendStatus.SENDING]: '📨',
            [SendStatus.PAUSED]: '⏸️',
            [SendStatus.COMPLETED]: '✅',
            [SendStatus.CANCELLED]: '❌',
            [SendStatus.FAILED]: '🚨'
        };

        return statusIcons[this.progress.status] || '';
    }

    /**
     * Get CSS class for status badge
     * 
     * @returns CSS class name based on status
     */
    getStatusClass(): string {
        if (!this.progress) return '';

        const statusClasses: Record<SendStatus, string> = {
            [SendStatus.IDLE]: 'status-idle',
            [SendStatus.PREPARING]: 'status-preparing',
            [SendStatus.SENDING]: 'status-sending',
            [SendStatus.PAUSED]: 'status-paused',
            [SendStatus.COMPLETED]: 'status-completed',
            [SendStatus.CANCELLED]: 'status-cancelled',
            [SendStatus.FAILED]: 'status-failed'
        };

        return statusClasses[this.progress.status] || '';
    }

    /**
     * Format time from milliseconds to readable string
     * 
     * @param milliseconds - Time in milliseconds
     * @returns Formatted time string (e.g., "2min 30sec")
     */
    formatTime(milliseconds: number): string {
        if (!milliseconds || milliseconds <= 0) return '0sec';

        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `${minutes}min ${seconds}sec`;
        }

        return `${seconds}sec`;
    }

    /**
     * Format cost to 2 decimal places with currency
     * 
     * @param cost - Cost in BGN
     * @returns Formatted cost string
     */
    formatCost(cost: number): string {
        return `${cost.toFixed(2)} BGN`;
    }

    /**
     * Format DateTime to readable string
     * 
     * @param date - Date object
     * @returns Formatted time string (HH:mm:ss)
     */
    formatDateTime(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * Get success rate percentage
     * 
     * @returns Success rate as percentage string
     */
    getSuccessRate(): string {
        if (!this.progress || this.progress.total === 0) return '0%';

        const rate = (this.progress.successful / this.progress.total) * 100;
        return `${rate.toFixed(1)}%`;
    }

    /**
     * Get failure rate percentage
     * 
     * @returns Failure rate as percentage string
     */
    getFailureRate(): string {
        if (!this.progress || this.progress.total === 0) return '0%';

        const rate = (this.progress.failed / this.progress.total) * 100;
        return `${rate.toFixed(1)}%`;
    }

    /**
     * Check if time remaining is low (less than 10 seconds)
     * Used to trigger warning animation
     * 
     * @returns True if time is low
     */
    isTimeLow(): boolean {
        if (!this.progress?.estimatedTimeRemaining) return false;
        return this.progress.estimatedTimeRemaining < 10000; // 10 seconds
    }

    // ==================== Event Handlers - User Controls ====================

    /**
     * Handle pause button click
     * Calls SendQueueService to pause operation
     */
    onPause(): void {
        if (!this.canPause) return;

        try {
            this.sendQueueService.pauseSending();
        } catch (error) {
            console.error('Error pausing send operation:', error);
        }
    }

    /**
     * Handle resume button click
     * Calls SendQueueService to resume operation
     */
    onResume(): void {
        if (!this.canResume) return;

        try {
            this.sendQueueService.resumeSending();
        } catch (error) {
            console.error('Error resuming send operation:', error);
        }
    }

    /**
     * Handle cancel button click
     * Shows enhanced confirmation dialog with current statistics
     */
    onCancel(): void {
        if (!this.canCancel || !this.progress) return;

        // Build confirmation message with current statistics
        const confirmMessage = this.buildCancelConfirmationMessage();

        // Show confirmation dialog
        const confirmed = confirm(confirmMessage);

        if (!confirmed) return;

        try {
            this.sendQueueService.cancelSending();
        } catch (error) {
            console.error('Error cancelling send operation:', error);
        }
    }

    /**
     * Build detailed confirmation message for cancel action
     * Includes current progress statistics
     * 
     * @returns Formatted confirmation message
     */
    private buildCancelConfirmationMessage(): string {
        if (!this.progress) return 'Сигурни ли сте, че искате да отмените изпращането?';

        const lines = [
            '🚨 ОТМЯНА НА ИЗПРАЩАНЕ',
            '',
            '⚠️ Сигурни ли сте, че искате да отмените операцията?',
            '',
            '📊 Текущ прогрес:',
            `   • Изпратени: ${this.progress.successful} SMS`,
            `   • Неуспешни: ${this.progress.failed} SMS`,
            `   • Обработени: ${this.progress.current} / ${this.progress.total}`,
            `   • Прогрес: ${this.progress.percentage}%`,
            '',
            '💡 Забележка:',
            '   • Изпратените SMS-си ще ОСТАНАТ изпратени',
            '   • Неизпратените съобщения ще бъдат ПРОПУСНАТИ',
            '',
            'Натиснете OK за потвърждение или Cancel за продължаване.'
        ];

        return lines.join('\n');
    }

    /**
     * Handle close button click
     * Resets queue to initial state (only when completed/cancelled/failed)
     */
    onClose(): void {
        if (!this.progress) return;

        // Only allow close when operation is finished
        if (
            this.progress.status !== SendStatus.COMPLETED &&
            this.progress.status !== SendStatus.CANCELLED &&
            this.progress.status !== SendStatus.FAILED
        ) {
            return;
        }

        try {
            this.sendQueueService.resetQueue();
            this.notificationService.info(
                'Готов за ново изпращане',
                'Може да започнете ново изпращане на SMS-си'
            );
        } catch (error) {
            console.error('Error resetting queue:', error);
        }
    }
}