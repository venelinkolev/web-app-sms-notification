import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationState, NotificationType } from '../../../core/models';

@Component({
    selector: 'app-notification',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notification.component.html',
    styleUrl: './notification.component.scss',
})
export class NotificationComponent implements OnInit, OnDestroy {

    notifications$: Observable<NotificationState[]>;

    constructor(private notificationService: NotificationService) {
        this.notifications$ = this.notificationService.notifications;
    }

    ngOnInit(): void {
        // Компонентът е готов
    }

    ngOnDestroy(): void {
        // Cleanup ако е необходимо
    }

    /**
     * Получаване на CSS класа за типа уведомление
     */
    getNotificationClass(type: NotificationType): string {
        const typeClasses = {
            [NotificationType.SUCCESS]: 'success',
            [NotificationType.INFO]: 'info',
            [NotificationType.WARNING]: 'warning',
            [NotificationType.ERROR]: 'error'
        };

        return `notification-${typeClasses[type]}`;
    }

    /**
     * Получаване на иконата за типа уведомление
     */
    getNotificationIcon(type: NotificationType): string {
        const icons = {
            [NotificationType.SUCCESS]: '✅',
            [NotificationType.INFO]: 'ℹ️',
            [NotificationType.WARNING]: '⚠️',
            [NotificationType.ERROR]: '❌'
        };

        return icons[type];
    }

    /**
     * Скриване на уведомление
     */
    dismiss(notificationId: string): void {
        this.notificationService.hide(notificationId);
    }

    /**
     * Обработка на action бутон
     */
    handleAction(action: { label: string; handler: () => void }, notificationId: string): void {
        action.handler();
        this.dismiss(notificationId);
    }
}