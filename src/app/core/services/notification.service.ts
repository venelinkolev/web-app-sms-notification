import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotificationState, NotificationType } from '../models';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {

    private notifications$ = new BehaviorSubject<NotificationState[]>([]);
    private notificationCounter = 0;

    /**
     * Observable за всички активни уведомления
     */
    get notifications(): Observable<NotificationState[]> {
        return this.notifications$.asObservable();
    }

    /**
     * Показване на success уведомление
     */
    success(title: string, message: string, timeout: number = 5000): string {
        return this.showNotification({
            type: NotificationType.SUCCESS,
            title,
            message,
            timeout,
            dismissible: true
        });
    }

    /**
     * Показване на info уведомление
     */
    info(title: string, message: string, timeout: number = 5000): string {
        return this.showNotification({
            type: NotificationType.INFO,
            title,
            message,
            timeout,
            dismissible: true
        });
    }

    /**
     * Показване на warning уведомление
     */
    warning(title: string, message: string, timeout: number = 7000): string {
        return this.showNotification({
            type: NotificationType.WARNING,
            title,
            message,
            timeout,
            dismissible: true
        });
    }

    /**
     * Показване на error уведомление
     */
    error(title: string, message: string, timeout: number = 0): string {
        return this.showNotification({
            type: NotificationType.ERROR,
            title,
            message,
            timeout, // 0 = няма auto-hide
            dismissible: true
        });
    }

    /**
     * Показване на персонализирано уведомление
     */
    showNotification(config: Partial<NotificationState>): string {
        const notification: NotificationState = {
            id: this.generateId(),
            type: config.type || NotificationType.INFO,
            title: config.title || '',
            message: config.message || '',
            timeout: config.timeout ?? 5000,
            dismissible: config.dismissible ?? true,
            actions: config.actions || [],
            timestamp: new Date(),
            visible: true
        };

        // Добавяне на уведомлението
        const current = this.notifications$.value;
        this.notifications$.next([...current, notification]);

        // Auto-hide ако има timeout
        if (notification.timeout > 0) {
            setTimeout(() => {
                this.hide(notification.id);
            }, notification.timeout);
        }

        return notification.id;
    }

    /**
     * Скриване на уведомление
     */
    hide(notificationId: string): void {
        const current = this.notifications$.value;
        const updated = current.filter(n => n.id !== notificationId);
        this.notifications$.next(updated);
    }

    /**
     * Скриване на всички уведомления
     */
    hideAll(): void {
        this.notifications$.next([]);
    }

    /**
     * Скриване на уведомления от определен тип
     */
    hideByType(type: NotificationType): void {
        const current = this.notifications$.value;
        const updated = current.filter(n => n.type !== type);
        this.notifications$.next(updated);
    }

    /**
     * Получаване на брой активни уведомления
     */
    getActiveCount(): number {
        return this.notifications$.value.length;
    }

    /**
     * Получаване на брой уведомления по тип
     */
    getCountByType(type: NotificationType): number {
        return this.notifications$.value.filter(n => n.type === type).length;
    }

    /**
     * Показване на уведомление за файлова операция
     */
    fileOperation(operation: 'upload' | 'parse' | 'validate', status: 'start' | 'success' | 'error', details?: string): string {
        const operationNames = {
            upload: 'Качване на файл',
            parse: 'Четене на файл',
            validate: 'Валидация на данни'
        };

        const operationName = operationNames[operation];

        switch (status) {
            case 'start':
                return this.info(operationName, `${operationName} започна...`, 2000);

            case 'success':
                return this.success(operationName, details || `${operationName} завърши успешно`);

            case 'error':
                return this.error(operationName, details || `Грешка при ${operationName.toLowerCase()}`);

            default:
                return '';
        }
    }

    /**
     * Показване на уведомление за валидация
     */
    validationResult(validCount: number, invalidCount: number, fileName: string): string {
        if (invalidCount === 0) {
            return this.success(
                'Валидация завършена',
                `Всички ${validCount} записа от "${fileName}" са валидни ✅`
            );
        } else {
            return this.warning(
                'Валидация завършена',
                `${validCount} валидни записа, ${invalidCount} грешки в "${fileName}" ⚠️`
            );
        }
    }

    /**
     * Показване на уведомление за празен файл
     */
    emptyFile(fileName: string): string {
        return this.warning(
            'Празен файл',
            `Файлът "${fileName}" не съдържа данни или всички записи са невалидни`
        );
    }

    /**
     * Показване на уведомление за голям файл
     */
    largeFile(fileName: string, recordCount: number): string {
        return this.info(
            'Голям файл',
            `Файлът "${fileName}" съдържа ${recordCount} записа. Обработката може да отнеме време...`,
            7000
        );
    }

    /**
     * Генериране на уникален ID
     */
    private generateId(): string {
        this.notificationCounter++;
        return `notification-${Date.now()}-${this.notificationCounter}`;
    }
}