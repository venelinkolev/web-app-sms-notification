// src/app/features/file-upload/file-upload.component.ts
import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FileSizePipe } from '../../shared/pipes/file-size.pipe';
import { FileService } from '../../core/services/file.service';
import { NotificationService } from '../../core/services/notification.service';
import { EnvironmentService } from '../../core/services/environment.service';
import {
    ClientDataImport,
    ValidationResult,
    LoadingState
} from '../../core/models';

@Component({
    selector: 'app-file-upload',
    standalone: true,
    imports: [CommonModule, FileSizePipe],
    templateUrl: './file-upload.component.html',
    styleUrl: './file-upload.component.scss',
})
export class FileUploadComponent implements OnDestroy {

    @Output() fileImported = new EventEmitter<ClientDataImport>();
    @Output() importConfirmed = new EventEmitter<ClientDataImport>();

    isDragging = false;
    hasError = false;
    errorMessage = '';
    importResult: ClientDataImport | null = null;
    maxFileSizeFormatted = '';

    loadingState: LoadingState = {
        isLoading: false,
        message: '',
        progress: undefined,
        cancellable: false
    };

    private destroy$ = new Subject<void>();

    constructor(
        private fileService: FileService,
        private notificationService: NotificationService,
        private environmentService: EnvironmentService
    ) {
        this.maxFileSizeFormatted = this.formatFileSize(this.environmentService.getMaxFileSize());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Drag over event
     */
    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
    }

    /**
     * Drag leave event
     */
    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    }

    /**
     * Drop event
     */
    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Отваряне на file dialog
     */
    openFileDialog(): void {
        if (this.loadingState.isLoading) return;

        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fileInput?.click();
    }

    /**
     * File selected event
     */
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this.processFile(input.files[0]);
        }
    }

    /**
     * Обработка на избран файл
     */
    private processFile(file: File): void {
        this.clearError();

        // Валидация на файла
        const validation = this.fileService.validateFile(file);
        if (!validation.isValid) {
            this.showError(validation.errors[0].message);
            return;
        }

        // Показване на warnings ако има
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                this.notificationService.warning('Внимание', warning.message);
            });
        }

        // Започване на обработката
        this.startProcessing('Четене на файл...');

        this.fileService.parseJsonFile(file)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result) => {
                    this.handleImportSuccess(result);
                },
                error: (error) => {
                    this.handleImportError(error);
                }
            });
    }

    /**
     * Успешен импорт
     */
    private handleImportSuccess(result: ClientDataImport): void {
        this.loadingState.isLoading = false;
        this.importResult = result;

        // Уведомления
        this.notificationService.validationResult(
            result.stats.validRecords,
            result.stats.invalidRecords,
            result.fileInfo.name
        );

        if (result.stats.validRecords === 0) {
            this.notificationService.emptyFile(result.fileInfo.name);
        } else if (result.stats.totalRecords > 100) {
            this.notificationService.largeFile(result.fileInfo.name, result.stats.totalRecords);
        }

        // Emit событие
        this.fileImported.emit(result);
    }

    /**
     * Грешка при импорт
     */
    private handleImportError(error: any): void {
        this.loadingState.isLoading = false;
        this.showError(error?.message || 'Неизвестна грешка при обработка на файла');

        this.notificationService.error(
            'Грешка при файла',
            error?.message || 'Неизвестна грешка при обработка'
        );
    }

    /**
     * Започване на обработка
     */
    private startProcessing(message: string): void {
        this.loadingState = {
            isLoading: true,
            message,
            progress: undefined,
            cancellable: false
        };
    }

    /**
     * Показване на грешка
     */
    private showError(message: string): void {
        this.hasError = true;
        this.errorMessage = message;
    }

    /**
     * Изчистване на грешка
     */
    clearError(): void {
        this.hasError = false;
        this.errorMessage = '';
    }

    /**
     * Reset на компонента
     */
    reset(): void {
        this.importResult = null;
        this.clearError();
        this.loadingState.isLoading = false;
    }

    /**
     * Потвърждаване на импорта
     */
    confirmImport(): void {
        if (this.importResult) {
            this.importConfirmed.emit(this.importResult);
            this.notificationService.success(
                'Данните са готови',
                'Можете да продължите към избор на клиенти'
            );
        }
    }

    /**
     * Форматиране на размер на файл
     */
    private formatFileSize(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(1)}KB`;
    }
}