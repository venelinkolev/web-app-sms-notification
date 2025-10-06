import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import {
    ClientRecord,
    ParsedClientRecord,
    ClientDataImport,
    ValidationResult,
    ValidationError,
    ValidationErrorCode
} from '../models';

@Injectable({
    providedIn: 'root'
})
export class FileService {

    constructor(private environmentService: EnvironmentService) { }

    /**
     * Четене и парсване на JSON файл
     */
    parseJsonFile(file: File): Observable<ClientDataImport> {
        return from(this.readFileAsText(file)).pipe(
            map(content => this.processJsonContent(content, file)),
            catchError(error => throwError(() => this.createFileError(error, file)))
        );
    }

    /**
     * Валидация на файл преди четене
     */
    validateFile(file: File): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Проверка на размера
        const maxSize = this.environmentService.getMaxFileSize();
        if (file.size > maxSize) {
            errors.push({
                field: 'size' as keyof ClientRecord,
                message: `Файлът е прекалено голям. Максимум: ${this.formatFileSize(maxSize)}`,
                code: ValidationErrorCode.TOO_LONG,
                value: file.size
            });
        }

        // Проверка на типа
        if (!file.name.toLowerCase().endsWith('.json')) {
            errors.push({
                field: 'Number' as keyof ClientRecord,
                message: 'Позволени са само JSON файлове',
                code: ValidationErrorCode.INVALID_FORMAT,
                value: file.name
            });
        }

        // Проверка на MIME типа
        if (file.type && !file.type.includes('json') && !file.type.includes('text')) {
            warnings.push({
                field: 'Number' as keyof ClientRecord,
                message: 'Файлът може да не е валиден JSON',
                code: ValidationErrorCode.INVALID_FORMAT,
                value: file.type
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Четене на файл като текст
     */
    private readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Грешка при четене на файла'));
                }
            };

            reader.onerror = () => {
                reject(new Error('Грешка при четене на файла'));
            };

            reader.readAsText(file, 'UTF-8');
        });
    }

    /**
     * Обработка на JSON съдържанието
     */
    private processJsonContent(content: string, file: File): ClientDataImport {
        try {
            // Парсване на JSON
            const rawData = JSON.parse(content);

            // Проверка дали е масив
            if (!Array.isArray(rawData)) {
                throw new Error('JSON файлът трябва да съдържа масив от записи');
            }

            // Обработка на записите
            const validRecords: ParsedClientRecord[] = [];
            const invalidRecords: ClientDataImport['invalidRecords'] = [];
            const seenNumbers = new Set<string>();

            rawData.forEach((record, index) => {
                const validationResult = this.validateClientRecord(record);

                if (validationResult.isValid) {
                    // Проверка за дублирани записи
                    const recordNumber = record.Number;
                    if (seenNumbers.has(recordNumber)) {
                        invalidRecords.push({
                            record,
                            errors: ['Дублиран номер на запис'],
                            lineNumber: index + 1
                        });
                        return;
                    }

                    seenNumbers.add(recordNumber);

                    // Създаване на ParsedClientRecord
                    const parsedRecord: ParsedClientRecord = {
                        ...record,
                        id: `client-${Date.now()}-${index}`,
                        parsedEndDate: this.parseEndDate(record.End_Data),
                        formattedPhone: this.formatPhoneNumber(record.Phone),
                        isValid: true,
                        validationErrors: [],
                        selected: false
                    };

                    validRecords.push(parsedRecord);
                } else {
                    invalidRecords.push({
                        record,
                        errors: validationResult.errors.map(e => e.message),
                        lineNumber: index + 1
                    });
                }
            });

            // Статистики
            const stats = {
                totalRecords: rawData.length,
                validRecords: validRecords.length,
                invalidRecords: invalidRecords.length,
                duplicateRecords: rawData.length - validRecords.length - invalidRecords.length
            };

            return {
                validRecords,
                invalidRecords,
                stats,
                importedAt: new Date(),
                fileInfo: {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'application/json'
                }
            };

        } catch (error) {
            throw new Error(`Грешка при парсване на JSON: ${error instanceof Error ? error.message : 'Неизвестна грешка'}`);
        }
    }

    /**
     * Валидация на един ClientRecord
     */
    private validateClientRecord(record: any): ValidationResult {
        const errors: ValidationError[] = [];
        // Задължителни полета (Ime_Obekt, Adres_Obekt, Dan_Number са optional)
        const requiredFields: (keyof ClientRecord)[] = [
            'Number', 'End_Data', 'Model', 'Number_EKA',
            'Phone', 'Ime_Firma', 'bulst'
        ];

        // Проверка за задължителни полета
        requiredFields.forEach(field => {
            if (!record[field] || record[field].toString().trim() === '') {
                errors.push({
                    field,
                    message: `Полето "${field}" е задължително`,
                    code: ValidationErrorCode.REQUIRED,
                    value: record[field]
                });
            }
        });

        // Валидация на дата
        if (record.End_Data && !this.isValidDate(record.End_Data)) {
            errors.push({
                field: 'End_Data',
                message: 'Невалиден формат на дата (очакван: dd/mm/yy HH:mm:ss)',
                code: ValidationErrorCode.INVALID_DATE,
                value: record.End_Data
            });
        }

        // Валидация на телефон
        if (record.Phone && !this.isValidPhone(record.Phone)) {
            errors.push({
                field: 'Phone',
                message: 'Невалиден формат на телефонен номер',
                code: ValidationErrorCode.INVALID_PHONE,
                value: record.Phone
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings: []
        };
    }

    /**
     * Парсване на End_Data към Date обект
     */
    private parseEndDate(dateString: string): Date | undefined {
        try {
            // Формат: dd/mm/yy HH:mm:ss
            const parts = dateString.split(' ');
            if (parts.length !== 2) return undefined;

            const [datePart, timePart] = parts;
            const [day, month, year] = datePart.split('/').map(Number);
            const [hours, minutes, seconds] = timePart.split(':').map(Number);

            // Превръщане на 2-цифрена година в 4-цифрена
            const fullYear = year < 50 ? 2000 + year : 1900 + year;

            return new Date(fullYear, month - 1, day, hours, minutes, seconds);
        } catch {
            return undefined;
        }
    }

    /**
     * Форматиране на телефонен номер към международен формат
     */
    private formatPhoneNumber(phone: string): string {
        // Премахване на всички не-цифри
        const digits = phone.replace(/\D/g, '');

        // Ако започва с 359, добавяме +
        if (digits.startsWith('359')) {
            return '+' + digits;
        }

        // Ако започва с 0, заменяме с +359
        if (digits.startsWith('0')) {
            return '+359' + digits.substring(1);
        }

        // В противен случай, добавяме +359
        return '+359' + digits;
    }

    /**
     * Проверка за валидна дата
     */
    private isValidDate(dateString: string): boolean {
        const parsedDate = this.parseEndDate(dateString);
        return parsedDate instanceof Date && !isNaN(parsedDate.getTime());
    }

    /**
     * Проверка за валиден телефон
     */
    private isValidPhone(phone: string): boolean {
        // Приемаме формати: +359888123456, 359888123456, 0888123456, 888123456
        const phoneRegex = /^(\+?359|0)?[0-9]{8,9}$/;
        const cleanPhone = phone.replace(/\s/g, '');
        return phoneRegex.test(cleanPhone);
    }

    /**
     * Форматиране на размер на файл
     */
    private formatFileSize(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(1)}KB`;
    }

    /**
     * Създаване на грешка за файл
     */
    private createFileError(error: any, file: File): Error {
        const baseMessage = `Грешка при обработка на файл "${file.name}": `;

        if (error instanceof Error) {
            return new Error(baseMessage + error.message);
        }

        return new Error(baseMessage + 'Неизвестна грешка');
    }
}