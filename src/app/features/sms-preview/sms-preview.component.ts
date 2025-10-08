import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { DataService } from '../../core/services/data.service';
import { SMSTemplateService } from '../../core/services/sms-template.service';
import { SMSService } from '../../core/services/sms.service';
import { NotificationService } from '../../core/services/notification.service';

import {
    ParsedClientRecord,
    SMSTemplate,
    PersonalizedSMS,
    SMSEncoding
} from '../../core/models';

@Component({
    selector: 'app-sms-preview',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './sms-preview.component.html',
    styleUrl: './sms-preview.component.scss'
})
export class SMSPreviewComponent implements OnInit, OnDestroy {

    // Selected records
    selectedRecords: ParsedClientRecord[] = [];

    // Templates
    availableTemplates: SMSTemplate[] = [];
    currentTemplate: SMSTemplate | null = null;
    isEditingTemplate = false;
    editedTemplateContent = '';

    // Personalized SMS previews
    personalizedSMS: PersonalizedSMS[] = [];
    previewLimit = 5;

    // Statistics
    stats = {
        totalRecords: 0,
        totalSMS: 0,
        totalCost: 0,
        averageChars: 0,
        encoding: SMSEncoding.STANDARD
    };

    // Character count for template
    templateCharCount = {
        count: 0,
        encoding: SMSEncoding.STANDARD,
        estimatedParts: 1,
        estimatedCost: 0
    };

    // Loading states
    isGenerating = false;
    isSending = false;

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: DataService,
        private templateService: SMSTemplateService,
        private smsService: SMSService,
        private notificationService: NotificationService
    ) { }

    ngOnInit(): void {
        this.loadTemplates();
        this.loadSelectedRecords();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Load available templates
     */
    private loadTemplates(): void {
        this.templateService.getTemplates()
            .pipe(takeUntil(this.destroy$))
            .subscribe(templates => {
                this.availableTemplates = templates;
                this.currentTemplate = this.templateService.getCurrentTemplate();
                this.editedTemplateContent = this.currentTemplate.content;
                this.updateTemplateCharCount();
            });
    }

    /**
     * Load selected records and generate previews
     */
    private loadSelectedRecords(): void {
        // Listen for selection changes
        this.dataService.selection
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.selectedRecords = this.dataService.getSelectedRecords();
                if (this.currentTemplate && this.selectedRecords.length > 0) {
                    this.generatePreviews();
                }
            });
    }

    /**
     * Generate personalized SMS previews
     */
    generatePreviews(): void {
        if (!this.currentTemplate || this.selectedRecords.length === 0) {
            this.personalizedSMS = [];
            this.updateStatistics();
            return;
        }

        this.isGenerating = true;

        try {
            // Generate all personalized SMS
            this.personalizedSMS = this.templateService.generateBatchSMS(
                this.currentTemplate,
                this.selectedRecords
            );

            // Update statistics
            this.updateStatistics();

            this.notificationService.success(
                'Preview готов',
                `Генерирани ${this.personalizedSMS.length} SMS съобщения`
            );
        } catch (error) {
            this.notificationService.error(
                'Грешка при генериране',
                error instanceof Error ? error.message : 'Неизвестна грешка'
            );
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Update statistics
     */
    private updateStatistics(): void {
        if (this.personalizedSMS.length === 0) {
            this.stats = {
                totalRecords: 0,
                totalSMS: 0,
                totalCost: 0,
                averageChars: 0,
                encoding: SMSEncoding.STANDARD
            };
            return;
        }

        const totalCost = this.personalizedSMS.reduce((sum, sms) => sum + sms.estimatedCost, 0);
        const totalChars = this.personalizedSMS.reduce((sum, sms) => sum + sms.characterCount, 0);
        const unicodeCount = this.personalizedSMS.filter(sms => sms.encoding === SMSEncoding.UNICODE).length;

        this.stats = {
            totalRecords: this.selectedRecords.length,
            totalSMS: this.personalizedSMS.length,
            totalCost: totalCost,
            averageChars: Math.round(totalChars / this.personalizedSMS.length),
            encoding: unicodeCount > this.personalizedSMS.length / 2
                ? SMSEncoding.UNICODE
                : SMSEncoding.STANDARD
        };
    }

    /**
     * Update template character count
     */
    updateTemplateCharCount(): void {
        if (!this.editedTemplateContent) {
            this.templateCharCount = {
                count: 0,
                encoding: SMSEncoding.STANDARD,
                estimatedParts: 0,
                estimatedCost: 0
            };
            return;
        }

        this.templateCharCount = this.templateService.calculateCharacterCount(
            this.editedTemplateContent
        );
    }

    /**
     * Get character count color
     */
    getCharCountColor(charCount: number, encoding: SMSEncoding): string {
        const limit = encoding === SMSEncoding.UNICODE ? 70 : 160;
        const doubleLim = encoding === SMSEncoding.UNICODE ? 140 : 300;

        if (charCount <= limit) return 'success'; // Green
        if (charCount <= doubleLim) return 'warning'; // Yellow
        return 'error'; // Red
    }

    /**
     * Get progress percentage
     */
    getCharProgressPercentage(charCount: number, encoding: SMSEncoding): number {
        const limit = encoding === SMSEncoding.UNICODE ? 70 : 160;
        return Math.min((charCount / limit) * 100, 100);
    }

    /**
     * Toggle template editing
     */
    toggleTemplateEdit(): void {
        this.isEditingTemplate = !this.isEditingTemplate;
    }

    /**
     * Save template changes
     */
    saveTemplateChanges(): void {
        if (!this.currentTemplate) return;

        // Validate template
        const validation = this.templateService.validateTemplate(this.editedTemplateContent);

        if (!validation.isValid) {
            this.notificationService.error(
                'Невалиден шаблон',
                validation.errors.map(e => e.message).join('\n')
            );
            return;
        }

        // Show warnings
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                this.notificationService.warning('Внимание', warning.message);
            });
        }

        // Update template
        this.templateService.updateTemplate(this.currentTemplate.id, {
            content: this.editedTemplateContent
        });

        this.isEditingTemplate = false;
        this.generatePreviews();
    }

    /**
     * Cancel template editing
     */
    cancelTemplateEdit(): void {
        if (this.currentTemplate) {
            this.editedTemplateContent = this.currentTemplate.content;
        }
        this.isEditingTemplate = false;
        this.updateTemplateCharCount();
    }

    /**
     * Template content change handler
     */
    onTemplateContentChange(): void {
        this.updateTemplateCharCount();
    }

    /**
     * Send SMS to all selected clients
     */
    async sendSMS(): Promise<void> {
        // Validation 1: Check if there are selected records
        if (this.selectedRecords.length === 0) {
            this.notificationService.warning(
                'Няма избрани записи',
                'Моля изберете поне един клиент за изпращане на SMS'
            );
            return;
        }

        // Validation 2: Check phone selections (CRITICAL!)
        const phoneValidation = this.dataService.validatePhoneSelections();
        if (!phoneValidation.isValid) {
            this.notificationService.error(
                '⚠️ Изберете телефони за SMS',
                phoneValidation.errors.join('\n\n')
            );
            return;
        }

        // Validation 3: Check if there are valid personalized SMS
        const validSMS = this.personalizedSMS.filter(sms => sms.isValid);
        if (validSMS.length === 0) {
            this.notificationService.error(
                'Няма валидни SMS',
                'Всички генерирани SMS съобщения са невалидни'
            );
            return;
        }

        // Confirmation dialog
        const confirmed = confirm(
            `Изпращане на ${validSMS.length} SMS съобщения?\n\n` +
            `Общ разход: ${this.stats.totalCost.toFixed(2)} credits\n\n` +
            `Сигурни ли сте?`
        );

        if (!confirmed) return;

        // Start sending
        this.isSending = true;

        try {
            this.notificationService.info(
                'Изпращане започна',
                `Изпращам ${validSMS.length} SMS съобщения...`,
                3000
            );

            // Prepare batch send
            // TODO: Phase 5 - Implement proper batch sending with progress
            // For now, just show notification

            this.notificationService.success(
                'SMS изпратени! (Demo)',
                `${validSMS.length} съобщения са изпратени успешно!\n` +
                `(Реално изпращане ще бъде имплементирано в Phase 5 - Send Operations)`,
                7000
            );

            console.log('📨 SMS Preview - Ready to send:', {
                totalSMS: validSMS.length,
                totalCost: this.stats.totalCost,
                recipients: validSMS.map(sms => ({
                    clientId: sms.clientId,
                    phone: sms.phoneNumber,
                    content: sms.content,
                    cost: sms.estimatedCost
                }))
            });

        } catch (error) {
            this.notificationService.error(
                'Грешка при изпращане',
                error instanceof Error ? error.message : 'Неизвестна грешка'
            );
        } finally {
            this.isSending = false;
        }
    }

    /**
     * Get preview SMS (limited)
     */
    get previewSMS(): PersonalizedSMS[] {
        return this.personalizedSMS.slice(0, this.previewLimit);
    }

    /**
     * Check if there are more SMS than preview limit
     */
    get hasMoreSMS(): boolean {
        return this.personalizedSMS.length > this.previewLimit;
    }

    /**
     * Get encoding display text
     */
    getEncodingText(encoding: SMSEncoding): string {
        return encoding === SMSEncoding.UNICODE ? 'Unicode (Cyrillic)' : 'Standard (Latin)';
    }

    /**
     * Get encoding icon
     */
    getEncodingIcon(encoding: SMSEncoding): string {
        return encoding === SMSEncoding.UNICODE ? '🔤' : '🔡';
    }

    /**
     * Get client name by ID
     */
    getClientName(clientId: string): string {
        const record = this.selectedRecords.find(r => r.id === clientId);
        return record?.Ime_Firma || 'Unknown Client';
    }

    /**
     * Show all available placeholders
     */
    showPlaceholderHelp(): void {
        const placeholders = this.templateService.getPlaceholderDescriptions();
        const helpText = placeholders.map(p =>
            `{${p.key}} - ${p.description}\nПример: ${p.example}`
        ).join('\n\n');

        alert(`Налични placeholders:\n\n${helpText}`);
    }
}