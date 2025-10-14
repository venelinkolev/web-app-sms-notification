import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { DataService } from '../../core/services/data.service';
import { SMSTemplateService } from '../../core/services/sms-template.service';
import { SMSService } from '../../core/services/sms.service';
import { NotificationService } from '../../core/services/notification.service';
import { SendQueueService, SendStatus } from '../../core/services';

import { ErrorLoggerService } from '../../core/services/error-logger.service';
import { ErrorDisplayComponent } from '../../shared/components/error-display/error-display.component';
import { ErrorContext, ErrorSeverity } from '../../core/models/error.models';
import { BatchOperationResult, BatchSMSMessage, SMSSendResult } from '../../core/models/sms.models';

import {
    ParsedClientRecord,
    SMSTemplate,
    PersonalizedSMS,
    SMSEncoding
} from '../../core/models';

import { transliterateCyrillicToLatin, TRANSLITERATION_MAPS } from '../../core/utils';

@Component({
    selector: 'app-sms-preview',
    standalone: true,
    imports: [CommonModule, FormsModule, ErrorDisplayComponent],
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

    // Transliteration toggle state (DEFAULT: enabled = Latin)
    isTransliterationEnabled = true;

    // SMS sending results (for error tracking)
    lastSendResult: BatchOperationResult | null = null;
    smsErrors: Map<string, SMSSendResult> = new Map(); // clientId -> error result

    // Error display
    showErrorsSection = false;

    // Error details modal
    showErrorDetailsModal = false;
    selectedErrorClientId: string | null = null;

    private destroy$ = new Subject<void>();

    constructor(
        private dataService: DataService,
        private templateService: SMSTemplateService,
        private smsService: SMSService,
        private notificationService: NotificationService,
        private errorLogger: ErrorLoggerService,
        private sendQueueService: SendQueueService,
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
                this.selectedRecords,
                this.isTransliterationEnabled,
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
     * Applies transliteration if enabled before calculating
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

        // Apply transliteration if enabled (to show accurate character count)
        let content = this.editedTemplateContent;
        if (this.isTransliterationEnabled) {
            content = transliterateCyrillicToLatin(content, TRANSLITERATION_MAPS.SMS_FRIENDLY);
        }

        // Calculate character count on potentially transliterated content
        this.templateCharCount = this.templateService.calculateCharacterCount(content);
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
     * Toggle transliteration on/off
     * Switches between Cyrillic (70 chars) and Latin (160 chars) modes
     */
    toggleTransliteration(): void {
        // Regenerate previews with new transliteration setting
        this.generatePreviews();

        // Update template character count display (ВАЖНО!)
        this.updateTemplateCharCount();

        // Notification with current mode info
        const mode = this.isTransliterationEnabled ? 'латиница' : 'кирилица';
        const charLimit = this.isTransliterationEnabled ? '160' : '70';
        const icon = this.isTransliterationEnabled ? '🇬🇧' : '🇧🇬';

        this.notificationService.info(
            `${icon} Режим променен`,
            `SMS-ите ще бъдат на ${mode} (${charLimit} символа/SMS)`,
            4000
        );
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

            // Log validation error
            this.errorLogger.logValidationError(
                'Phone selection validation failed',
                'phoneNumbers',
                { errors: phoneValidation.errors }
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
        this.lastSendResult = null;
        this.smsErrors.clear();

        try {
            this.notificationService.info(
                'Изпращане започна',
                `Изпращам ${validSMS.length} SMS съобщения...`,
                3000
            );

            // Prepare batch messages with FRESH generation using current transliteration setting
            const messages: BatchSMSMessage[] = validSMS.map(sms => {
                const record = this.selectedRecords.find(r => r.id === sms.clientId);
                if (!record || !this.currentTemplate) {
                    throw new Error(`Record not found for client ${sms.clientId}`);
                }

                // Generate fresh personalized SMS with current transliteration setting
                const freshSMS = this.templateService.generatePersonalizedSMS(
                    this.currentTemplate,
                    record,
                    this.isTransliterationEnabled
                );

                return {
                    clientId: sms.clientId,
                    phoneNumber: sms.phoneNumber,
                    message: freshSMS.content,
                    customId: `preview-${sms.clientId}-${Date.now()}`
                };
            });

            // Start sending via SendQueueService
            console.log('📨 SMS Preview - Starting send operation:', {
                totalSMS: messages.length,
                totalCost: this.stats.totalCost,
                messages: messages
            });

            // Start sending and subscribe to progress
            this.sendQueueService.startSending(messages).subscribe({
                next: (progress) => {
                    // Progress updates are handled by SendProgressComponent
                    // We just log here for debugging
                    if (progress.status === SendStatus.COMPLETED) {
                        console.log('✅ Send operation completed:', progress);

                        this.notificationService.success(
                            '✅ Изпращане завършено',
                            `Успешни: ${progress.successful} | Неуспешни: ${progress.failed}`,
                            5000
                        );
                    } else if (progress.status === SendStatus.FAILED) {
                        console.error('❌ Send operation failed:', progress);

                        this.notificationService.error(
                            '❌ Изпращане неуспешно',
                            'Операцията беше прекъсната поради грешка'
                        );
                    } else if (progress.status === SendStatus.CANCELLED) {
                        console.warn('⚠️ Send operation cancelled:', progress);

                        this.notificationService.warning(
                            '⚠️ Изпращане отменено',
                            'Операцията беше отменена от потребителя'
                        );
                    }
                },
                error: (error) => {
                    console.error('❌ SendQueue error:', error);

                    this.errorLogger.logError(
                        error instanceof Error ? error : new Error(String(error)),
                        ErrorContext.SMS_API,
                        ErrorSeverity.HIGH,
                        {
                            operation: 'sendQueueStart',
                            recipientCount: validSMS.length,
                            totalCost: this.stats.totalCost
                        }
                    );

                    this.notificationService.error(
                        'Грешка при стартиране',
                        error instanceof Error ? error.message : 'Неизвестна грешка'
                    );
                }
            });

        } catch (error) {
            // Log error
            const errorId = this.errorLogger.logError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorContext.SMS_API,
                ErrorSeverity.HIGH,
                {
                    operation: 'sendBatchSMS',
                    recipientCount: validSMS.length,
                    totalCost: this.stats.totalCost
                }
            );

            this.notificationService.error(
                'Грешка при изпращане',
                error instanceof Error ? error.message : 'Неизвестна грешка'
            );

            console.error('SMS Send Error:', error);
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
 * Get displayed template content (with transliteration if enabled)
 */
    get displayedTemplateContent(): string {
        if (!this.currentTemplate) return '';

        const content = this.currentTemplate.content;

        // Apply transliteration if enabled
        if (this.isTransliterationEnabled) {
            return transliterateCyrillicToLatin(content, TRANSLITERATION_MAPS.SMS_FRIENDLY);
        }

        return content;
    }

    /**
     * Get displayed edited template content (with transliteration if enabled)
     */
    get displayedEditedTemplateContent(): string {
        if (!this.editedTemplateContent) return '';

        // Apply transliteration if enabled
        if (this.isTransliterationEnabled) {
            return transliterateCyrillicToLatin(this.editedTemplateContent, TRANSLITERATION_MAPS.SMS_FRIENDLY);
        }

        return this.editedTemplateContent;
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

    /**
     * Process batch send results and handle errors
     */
    private processSendResults(result: BatchOperationResult): void {
        // Log successful sends
        if (result.successful.length > 0) {
            console.log(`✅ Successfully sent ${result.successful.length} SMS`);
        }

        // Process failed sends
        if (result.failed.length > 0) {
            this.showErrorsSection = true;

            // Store errors for display
            result.failed.forEach(failedSms => {
                this.smsErrors.set(failedSms.clientId, failedSms);

                // Log each error
                this.errorLogger.logSMSError(
                    failedSms.error || 'Unknown error',
                    failedSms.errorCode,
                    {
                        clientId: failedSms.clientId,
                        phoneNumber: failedSms.phoneNumber,
                        timestamp: failedSms.timestamp
                    }
                );
            });

            // Show notification
            this.notificationService.warning(
                `⚠️ ${result.failed.length} грешки при изпращане`,
                `${result.successful.length} успешни, ${result.failed.length} неуспешни`
            );
        }

        // Process invalid numbers
        if (result.invalid.length > 0) {
            result.invalid.forEach(invalid => {
                this.errorLogger.logValidationError(
                    invalid.reason,
                    'phoneNumber',
                    {
                        clientId: invalid.clientId,
                        phoneNumber: invalid.phoneNumber
                    }
                );
            });
        }

        // Show final statistics
        this.notificationService.info(
            'Резултат от изпращане',
            `✅ Успешни: ${result.stats.successfulCount}\n` +
            `❌ Неуспешни: ${result.stats.failedCount}\n` +
            `⚠️ Невалидни: ${result.stats.invalidCount}\n` +
            `💰 Обща цена: ${result.stats.totalCost.toFixed(2)} credits`
        );

        // Offer retry if possible
        if (result.canRetry) {
            this.offerRetry(result);
        }
    }

    /**
     * Offer retry for failed messages
     */
    private offerRetry(result: BatchOperationResult): void {
        const retryConfirm = confirm(
            `Има ${result.retryableMessages.length} съобщения, които могат да бъдат опитани отново.\n\n` +
            `Искате ли да опитате отново?`
        );

        if (retryConfirm) {
            this.retrySending(result);
        }
    }

    /**
  * Retry failed messages
  * Made public for template access
  */
    retrySending(previousResult: BatchOperationResult): void {
        this.isSending = true;

        try {
            this.notificationService.info(
                'Retry започна',
                `Опитвам отново ${previousResult.retryableMessages.length} съобщения...`
            );

            // Retry failed messages via SMSService
            console.log('🔄 Starting retry operation:', {
                retryableCount: previousResult.retryableMessages.length,
                timestamp: new Date().toISOString()
            });

            this.smsService.retryFailedMessages(previousResult).subscribe({
                next: (retryResult: BatchOperationResult) => {
                    console.log('✅ Retry completed:', retryResult);

                    // Store result
                    this.lastSendResult = retryResult;

                    // Process results (show errors, statistics, etc.)
                    this.processSendResults(retryResult);

                    // Show success notification
                    this.notificationService.success(
                        '✅ Retry завършен',
                        `Успешни: ${retryResult.stats.successfulCount} | Неуспешни: ${retryResult.stats.failedCount}`,
                        5000
                    );

                    this.isSending = false;
                },
                error: (error) => {
                    console.error('❌ Retry error:', error);

                    this.errorLogger.logError(
                        error instanceof Error ? error : new Error(String(error)),
                        ErrorContext.SMS_API,
                        ErrorSeverity.HIGH,
                        {
                            operation: 'retrySMS',
                            retryableCount: previousResult.retryableMessages.length
                        }
                    );

                    this.notificationService.error(
                        'Грешка при retry',
                        error instanceof Error ? error.message : 'Неизвестна грешка'
                    );

                    this.isSending = false;
                }
            });

        } catch (error) {
            this.errorLogger.logError(
                error instanceof Error ? error : new Error(String(error)),
                ErrorContext.SMS_API,
                ErrorSeverity.HIGH,
                { operation: 'retrySMS' }
            );

            this.notificationService.error(
                'Грешка при retry',
                error instanceof Error ? error.message : 'Неизвестна грешка'
            );
        } finally {
            this.isSending = false;
        }
    }

    /**
     * Check if SMS has error
     */
    hasSMSError(clientId: string): boolean {
        return this.smsErrors.has(clientId);
    }

    /**
     * Get SMS error
     */
    getSMSError(clientId: string): SMSSendResult | undefined {
        return this.smsErrors.get(clientId);
    }

    /**
     * Clear all errors
     */
    clearErrors(): void {
        this.smsErrors.clear();
        this.showErrorsSection = false;
        this.lastSendResult = null;
    }

    /**
     * Get errors count
     */
    get errorsCount(): number {
        return this.smsErrors.size;
    }

    /**
 * Show error details modal for specific SMS
 */
    showErrorDetails(clientId: string): void {
        const error = this.getSMSError(clientId);
        if (!error) {
            console.warn('No error found for client:', clientId);
            return;
        }

        this.selectedErrorClientId = clientId;
        this.showErrorDetailsModal = true;

        console.log('Showing error details for:', clientId, error);
    }

    /**
     * Close error details modal
     */
    closeErrorDetailsModal(): void {
        this.showErrorDetailsModal = false;
        this.selectedErrorClientId = null;
    }

    /**
     * Get selected error for modal display
     */
    get selectedError(): SMSSendResult | undefined {
        if (!this.selectedErrorClientId) return undefined;
        return this.getSMSError(this.selectedErrorClientId);
    }

    /**
     * Convert SMS error to ErrorLog format for ErrorDisplayComponent
     */
    convertSMSErrorToErrorLog(smsError: SMSSendResult): any {
        // Import ErrorLog type if needed
        return {
            id: `sms-error-${smsError.clientId}-${smsError.timestamp.getTime()}`,
            timestamp: smsError.timestamp,
            severity: this.getSMSErrorSeverity(smsError.errorCode),
            context: 'SMS_API' as any, // ErrorContext.SMS_API
            message: smsError.error || 'Неизвестна грешка',
            code: smsError.errorCode,
            technicalDetails: JSON.stringify({
                clientId: smsError.clientId,
                phoneNumber: smsError.phoneNumber,
                message: smsError.message,
                cost: smsError.cost,
                timestamp: smsError.timestamp
            }, null, 2),
            metadata: {
                clientId: smsError.clientId,
                phoneNumber: smsError.phoneNumber
            },
            resolved: false
        };
    }

    /**
     * Get error severity from error code (helper)
     */
    private getSMSErrorSeverity(errorCode: number | undefined): any {
        if (!errorCode) return 'MEDIUM'; // ErrorSeverity.MEDIUM

        // Critical errors
        if ([104, 1001].includes(errorCode)) return 'CRITICAL'; // ErrorSeverity.CRITICAL

        // High severity errors
        if ([11, 103, 105].includes(errorCode)) return 'HIGH'; // ErrorSeverity.HIGH

        // Medium severity errors
        if ([13, 14, 15, 201, 202, 429].includes(errorCode)) return 'MEDIUM'; // ErrorSeverity.MEDIUM

        return 'MEDIUM'; // Default
    }

    /**
     * Handle retry from error display
     */
    onRetryErrorFromDisplay(errorLog: any): void {
        if (!this.lastSendResult) {
            this.notificationService.warning(
                'Няма резултат',
                'Няма запазен резултат от предишно изпращане'
            );
            return;
        }

        this.closeErrorDetailsModal();
        this.retrySending(this.lastSendResult);
    }

    /**
     * Handle resolve from error display
     */
    onResolveErrorFromDisplay(errorId: string): void {
        // Mark error as resolved in local tracking
        if (this.selectedErrorClientId) {
            this.smsErrors.delete(this.selectedErrorClientId);

            this.notificationService.success(
                'Грешка маркирана',
                'Грешката е маркирана като решена'
            );
        }

        this.closeErrorDetailsModal();

        // Update error count
        if (this.smsErrors.size === 0) {
            this.showErrorsSection = false;
        }
    }
}