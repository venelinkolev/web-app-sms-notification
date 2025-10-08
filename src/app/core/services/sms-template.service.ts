// src/app/core/services/sms-template.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import { NotificationService } from './notification.service';
import {
    SMSTemplate,
    PersonalizedSMS,
    SMSEncoding,
    ParsedClientRecord,
    ValidationResult,
    ValidationError,
    ValidationErrorCode
} from '../models';

/**
 * SMS Template Service
 * Manages SMS templates with dynamic field substitution and character counting
 */
@Injectable({
    providedIn: 'root'
})
export class SMSTemplateService {

    // Template storage (in-memory)
    private templates$ = new BehaviorSubject<SMSTemplate[]>([]);

    // Default template
    private defaultTemplate: SMSTemplate = {
        id: 'default',
        name: 'Напомняне за изтичащ договор',
        content: 'Уважаеми {Ime_Firma},\n' +
            'Договорът Ви №{Number} за {Model} изтича на {End_Data}.\n' +
            'За повече информация: {Phone}',
        placeholders: [
            { key: 'Ime_Firma', description: 'Име на фирма', example: 'Софтуер България ЕООД' },
            { key: 'Number', description: 'Номер на договор', example: '12345' },
            { key: 'Model', description: 'Модел на оборудване', example: 'AlarmSystem Pro' },
            { key: 'End_Data', description: 'Дата на изтичане', example: '30.10.2025' },
            { key: 'Phone', description: 'Телефон за контакт', example: '+359888123456' }
        ],
        characterInfo: {
            baseLength: 0,
            encoding: SMSEncoding.UNICODE,
            estimatedParts: 1
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };

    constructor(
        private environmentService: EnvironmentService,
        private notificationService: NotificationService
    ) {
        // Initialize with default template
        this.templates$.next([this.defaultTemplate]);
        this.updateTemplateCharacterInfo(this.defaultTemplate);
    }

    /**
     * Get all templates
     */
    getTemplates(): Observable<SMSTemplate[]> {
        return this.templates$.asObservable();
    }

    /**
     * Get template by ID
     */
    getTemplateById(id: string): SMSTemplate | undefined {
        return this.templates$.value.find(t => t.id === id);
    }

    /**
     * Get current template (first one, or default)
     */
    getCurrentTemplate(): SMSTemplate {
        const templates = this.templates$.value;
        return templates.length > 0 ? templates[0] : this.defaultTemplate;
    }

    /**
     * Create new template
     */
    createTemplate(template: Omit<SMSTemplate, 'id' | 'createdAt' | 'updatedAt'>): SMSTemplate {
        const newTemplate: SMSTemplate = {
            ...template,
            id: this.generateId(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Update character info
        this.updateTemplateCharacterInfo(newTemplate);

        // Validate
        const validation = this.validateTemplate(newTemplate.content);
        if (!validation.isValid) {
            const errorMsg = validation.errors.map(e => e.message).join(', ');
            this.notificationService.error('Невалиден шаблон', errorMsg);
            throw new Error('Invalid template: ' + errorMsg);
        }

        // Add to storage
        const current = this.templates$.value;
        this.templates$.next([...current, newTemplate]);

        this.notificationService.success(
            'Шаблон създаден',
            `"${newTemplate.name}" е добавен успешно`
        );

        return newTemplate;
    }

    /**
     * Update existing template
     */
    updateTemplate(id: string, updates: Partial<SMSTemplate>): void {
        const current = this.templates$.value;
        const index = current.findIndex(t => t.id === id);

        if (index === -1) {
            this.notificationService.error('Грешка', 'Шаблонът не е намерен');
            return;
        }

        const updated: SMSTemplate = {
            ...current[index],
            ...updates,
            id: current[index].id, // Preserve ID
            createdAt: current[index].createdAt, // Preserve creation date
            updatedAt: new Date()
        };

        // Update character info if content changed
        if (updates.content) {
            this.updateTemplateCharacterInfo(updated);
        }

        // Validate if content changed
        if (updates.content) {
            const validation = this.validateTemplate(updated.content);
            if (!validation.isValid) {
                const errorMsg = validation.errors.map(e => e.message).join(', ');
                this.notificationService.error('Невалиден шаблон', errorMsg);
                return;
            }
        }

        // Update storage
        const newTemplates = [...current];
        newTemplates[index] = updated;
        this.templates$.next(newTemplates);

        this.notificationService.success(
            'Шаблон обновен',
            `"${updated.name}" е променен успешно`
        );
    }

    /**
     * Delete template
     */
    deleteTemplate(id: string): void {
        const current = this.templates$.value;
        const template = current.find(t => t.id === id);

        if (!template) {
            this.notificationService.error('Грешка', 'Шаблонът не е намерен');
            return;
        }

        // Prevent deleting last template
        if (current.length === 1) {
            this.notificationService.warning(
                'Внимание',
                'Не можете да изтриете последния шаблон'
            );
            return;
        }

        const filtered = current.filter(t => t.id !== id);
        this.templates$.next(filtered);

        this.notificationService.info(
            'Шаблон изтрит',
            `"${template.name}" е премахнат`
        );
    }

    /**
     * Generate personalized SMS for single client
     */
    generatePersonalizedSMS(
        template: SMSTemplate,
        record: ParsedClientRecord
    ): PersonalizedSMS {
        // Replace placeholders with actual data
        const content = this.replacePlaceholders(template.content, record);

        // Calculate character count
        const { count, encoding, estimatedParts, estimatedCost } = this.calculateCharacterCount(content);

        // Validate phone selection
        const hasValidPhone = record.phoneNumbers.some(p => p.selected && p.isValid);

        return {
            clientId: record.id,
            phoneNumber: this.getSelectedPhoneNumber(record),
            content: content,
            characterCount: count,
            estimatedParts: estimatedParts,
            encoding: encoding,
            estimatedCost: estimatedCost,
            templateId: template.id,
            isValid: hasValidPhone && count > 0,
            validationErrors: hasValidPhone ? [] : ['Няма избран валиден телефонен номер']
        };
    }

    /**
     * Generate batch personalized SMS for multiple clients
     */
    generateBatchSMS(
        template: SMSTemplate,
        records: ParsedClientRecord[]
    ): PersonalizedSMS[] {
        return records.map(record => this.generatePersonalizedSMS(template, record));
    }

    /**
     * Validate template content
     */
    validateTemplate(content: string): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Check if empty
        if (!content || content.trim().length === 0) {
            errors.push({
                field: 'content' as any,
                message: 'Шаблонът не може да бъде празен',
                code: ValidationErrorCode.REQUIRED,
                value: content
            });
        }

        // Extract placeholders
        const placeholders = this.extractPlaceholders(content);
        const validPlaceholders = this.getAvailablePlaceholders();

        // Check for invalid placeholders
        placeholders.forEach(placeholder => {
            if (!validPlaceholders.includes(placeholder)) {
                warnings.push({
                    field: 'content' as any,
                    message: `Непознат placeholder: {${placeholder}}. Възможни: ${validPlaceholders.join(', ')}`,
                    code: ValidationErrorCode.INVALID_FORMAT,
                    value: placeholder
                });
            }
        });

        // Check character count
        const { count, encoding } = this.calculateCharacterCount(content);
        const limit = encoding === SMSEncoding.UNICODE ? 70 : 160;

        if (count > limit * 6) {
            warnings.push({
                field: 'content' as any,
                message: `Шаблонът е твърде дълъг (${count} chars). Ще се раздели на повече от 6 SMS-а`,
                code: ValidationErrorCode.TOO_LONG,
                value: count
            });
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    /**
     * Calculate character count and encoding
     */
    calculateCharacterCount(message: string): {
        count: number;
        encoding: SMSEncoding;
        estimatedParts: number;
        estimatedCost: number;
    } {
        const encoding = this.detectEncoding(message);
        const count = message.length;

        // Get limits from environment
        const limits = this.environmentService.getSMSApiConfig().characterLimits;
        const singleLimit = encoding === SMSEncoding.UNICODE ? limits.unicode : limits.standard;
        const concatLimit = encoding === SMSEncoding.UNICODE ? limits.concat.unicode : limits.concat.standard;

        let estimatedParts = 1;
        if (count > singleLimit) {
            estimatedParts = Math.ceil(count / concatLimit);
        }

        // Cost estimation (0.16 points per SMS part)
        const estimatedCost = estimatedParts * 0.16;

        return {
            count,
            encoding,
            estimatedParts,
            estimatedCost
        };
    }

    /**
     * Detect encoding based on content
     */
    detectEncoding(message: string): SMSEncoding {
        // Check for Cyrillic characters
        const cyrillicRegex = /[А-Яа-яЁё]/;
        if (cyrillicRegex.test(message)) {
            return SMSEncoding.UNICODE;
        }

        // Check for special Unicode characters
        const specialCharsRegex = /[^\x00-\x7F]/;
        if (specialCharsRegex.test(message)) {
            return SMSEncoding.UNICODE;
        }

        return SMSEncoding.STANDARD;
    }

    /**
     * Get available placeholders for templates
     */
    getAvailablePlaceholders(): string[] {
        return [
            'Number',           // Client record number
            'End_Data',         // Contract end date
            'Model',            // Equipment model
            'Number_EKA',       // EKA equipment number
            'Ime_Obekt',        // Object name
            'Adres_Obekt',      // Object address
            'Dan_Number',       // Tax number
            'Phone',            // Phone number
            'Ime_Firma',        // Company name
            'bulst'             // Bulgarian tax identifier
        ];
    }

    /**
     * Get placeholder descriptions
     */
    getPlaceholderDescriptions(): Array<{ key: string; description: string; example: string }> {
        return [
            { key: 'Number', description: 'Номер на договор', example: '12345' },
            { key: 'End_Data', description: 'Дата на изтичане', example: '30.10.2025' },
            { key: 'Model', description: 'Модел на оборудване', example: 'AlarmSystem Pro' },
            { key: 'Number_EKA', description: 'ЕКА номер', example: 'EKA-789' },
            { key: 'Ime_Obekt', description: 'Име на обект', example: 'Офис Център София' },
            { key: 'Adres_Obekt', description: 'Адрес на обект', example: 'ул. Витоша 1' },
            { key: 'Dan_Number', description: 'Данъчен номер', example: '1234567890' },
            { key: 'Phone', description: 'Телефон', example: '+359888123456' },
            { key: 'Ime_Firma', description: 'Име на фирма', example: 'Софтуер ЕООД' },
            { key: 'bulst', description: 'Булстат', example: 'BG1234567890' }
        ];
    }

    /**
     * Replace placeholders in template with actual data
     */
    private replacePlaceholders(template: string, record: ParsedClientRecord): string {
        let result = template;

        // Replace each placeholder
        const placeholders = this.getAvailablePlaceholders();

        placeholders.forEach(placeholder => {
            const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
            let value: any = record[placeholder as keyof ParsedClientRecord];

            // Special handling for dates
            if (placeholder === 'End_Data' && record.parsedEndDate) {
                value = this.formatDate(record.parsedEndDate);
            }

            // Special handling for phone (use selected phone)
            if (placeholder === 'Phone') {
                value = this.getSelectedPhoneNumber(record);
            }

            // Replace with value or empty string if undefined
            result = result.replace(regex, value?.toString() || '');
        });

        return result;
    }

    /**
     * Extract placeholders from template content
     */
    private extractPlaceholders(content: string): string[] {
        const regex = /\{([^}]+)\}/g;
        const matches: string[] = [];
        let match;

        while ((match = regex.exec(content)) !== null) {
            matches.push(match[1]);
        }

        return matches;
    }

    /**
     * Get selected phone number for client
     */
    private getSelectedPhoneNumber(record: ParsedClientRecord): string {
        const selectedPhone = record.phoneNumbers.find(p => p.selected && p.isValid);
        return selectedPhone?.formatted || record.phoneNumbers[0]?.formatted || '';
    }

    /**
     * Format date for SMS
     */
    private formatDate(date: Date): string {
        return new Intl.DateTimeFormat('bg-BG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    }

    /**
     * Update template character info
     */
    private updateTemplateCharacterInfo(template: SMSTemplate): void {
        const { count, encoding, estimatedParts } = this.calculateCharacterCount(template.content);

        template.characterInfo = {
            baseLength: count,
            encoding: encoding,
            estimatedParts: estimatedParts
        };
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Get template statistics
     */
    getTemplateStatistics(template: SMSTemplate): {
        totalPlaceholders: number;
        uniquePlaceholders: number;
        encoding: SMSEncoding;
        baseLength: number;
        estimatedParts: number;
    } {
        const placeholders = this.extractPlaceholders(template.content);
        const uniquePlaceholders = new Set(placeholders);

        return {
            totalPlaceholders: placeholders.length,
            uniquePlaceholders: uniquePlaceholders.size,
            encoding: template.characterInfo.encoding,
            baseLength: template.characterInfo.baseLength,
            estimatedParts: template.characterInfo.estimatedParts
        };
    }

    /**
     * Preview template with sample data
     */
    previewTemplate(template: SMSTemplate): string {
        const sampleData: ParsedClientRecord = {
            // Required ClientRecord fields
            Number: '12345',
            End_Data: '30/10/25 00:00:00',
            Model: 'AlarmSystem Pro',
            Number_EKA: 'EKA-789',
            Phone: '+359888123456',
            Ime_Firma: 'Софтуер България ЕООД',
            bulst: 'BG1234567890',

            // Optional ClientRecord fields
            Ime_Obekt: 'Офис Център София',
            Adres_Obekt: 'ул. Витоша 1, София',
            Dan_Number: '1234567890',

            // ParsedClientRecord specific fields
            id: 'sample',
            parsedEndDate: new Date(2025, 9, 30),
            phoneNumbers: [{
                original: '359888123456',
                formatted: '+359888123456',
                selected: true,
                isValid: true,
                id: 'phone-1'
            }],
            hasMultiplePhones: false,
            selectedPhoneCount: 1,
            requiresPhoneSelection: false,
            isValid: true,
            validationErrors: [],
            selected: false
        };

        return this.replacePlaceholders(template.content, sampleData);
    }

    /**
     * Reset to default template
     */
    resetToDefault(): void {
        this.templates$.next([this.defaultTemplate]);
        this.notificationService.info(
            'Шаблон възстановен',
            'Върнат е шаблонът по подразбиране'
        );
    }
}