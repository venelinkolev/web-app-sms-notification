// src/app/core/services/sms.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, of } from 'rxjs';
import { catchError, retry, retryWhen, mergeMap, finalize, tap, map } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import { NotificationService } from './notification.service';
import {
    SendSMSParams,
    SMSResponse,
    BulkSMSOptions,
    BulkSMSResponse,
    SMSErrorResponse,
    SMS_ERROR_CODES,
    SMSErrorCode,
    SMSMessageResult,
    SMSSendResult,
    BatchSMSCompleteResult,
    InvalidNumber
} from '../models';
import { ErrorLoggerService } from './error-logger.service';
import { ErrorContext, ErrorSeverity } from '../models/error.models';

/**
 * SMS Service for SMSApi.bg integration
 * Handles all SMS sending operations with error handling and retry logic
 */
@Injectable({
    providedIn: 'root'
})
export class SMSService {

    private readonly baseUrl: string;
    private readonly token: string;
    private readonly defaultSender: string;
    private readonly maxRetries: number;
    private readonly retryDelay: number;


    constructor(
        private http: HttpClient,
        private environmentService: EnvironmentService,
        private notificationService: NotificationService,
        private errorLogger: ErrorLoggerService
    ) {
        // Load configuration from environment
        const smsConfig = this.environmentService.getSMSApiConfig();
        this.baseUrl = smsConfig.baseUrl;
        this.token = smsConfig.token;
        this.defaultSender = smsConfig.sender;

        const retryConfig = this.environmentService.getRetryConfig();
        this.maxRetries = retryConfig.maxRetries;
        this.retryDelay = retryConfig.retryDelay;

        // Validation check
        if (!this.token || this.token.trim() === '') {
            console.warn('⚠️ SMS API token is not configured! Add token to environment.ts');
        }
    }

    /**
     * Send single SMS or to multiple recipients
     */
    sendSMS(params: SendSMSParams): Observable<SMSResponse> {
        // Validation
        if (!this.token || this.token.trim() === '') {
            this.notificationService.error(
                'SMS API грешка',
                'API token не е конфигуриран! Проверете environment.ts'
            );
            return throwError(() => new Error('SMS API token not configured'));
        }

        // Build request body
        const body = this.buildFormData({
            to: Array.isArray(params.to) ? params.to.join(',') : params.to,
            message: params.message,
            from: params.from || this.defaultSender,
            format: 'json',
            fast: params.priority ? '1' : '0',
            date: params.scheduledDate ? Math.floor(params.scheduledDate.getTime() / 1000) : undefined,
            idx: params.customId,
            encoding: params.hasSpecialChars ? 'utf-8' : undefined
        });

        const url = `${this.baseUrl}sms.do`;

        return this.http.post<SMSResponse>(url, body, this.getHttpOptions()).pipe(
            // Retry logic for temporary errors
            retryWhen(errors =>
                errors.pipe(
                    mergeMap((error, index) => {
                        if (index >= this.maxRetries || !this.shouldRetry(error)) {
                            return throwError(() => error);
                        }
                        const delay = this.exponentialBackoff(index);
                        console.log(`🔄 Retry ${index + 1}/${this.maxRetries} after ${delay}ms...`);
                        return timer(delay);
                    })
                )
            ),
            // Error handling
            catchError(error => this.handleSMSError(error)),
            // Success notification
            tap(response => {
                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.log('✅ SMS sent successfully:', response);
                }

                // Log successful sends (optional - LOW severity)
                this.errorLogger.logError(
                    `SMS sent successfully: ${response.count} messages`,
                    ErrorContext.SMS_API,
                    ErrorSeverity.LOW,
                    {
                        messageCount: response.count,
                        recipients: params.to
                    }
                );
            })
        );
    }

    /**
     * Send bulk SMS to multiple recipients
     */
    sendBulkSMS(
        recipients: string[],
        message: string,
        options?: BulkSMSOptions
    ): Observable<BulkSMSResponse> {
        // Validation
        if (!recipients || recipients.length === 0) {
            this.notificationService.error('SMS грешка', 'Няма получатели за SMS');
            return throwError(() => new Error('No recipients provided'));
        }

        if (recipients.length > 10000) {
            this.notificationService.warning(
                'Твърде много получатели',
                `Максимум 10,000 получатели на заявка. Текущо: ${recipients.length}`
            );
            return throwError(() => new Error('Too many recipients (max 10,000)'));
        }

        // Build request
        const body = this.buildFormData({
            to: recipients.join(','),
            message: message,
            from: options?.from || this.defaultSender,
            format: 'json',
            fast: options?.priority ? '1' : '0',
            date: options?.scheduledDate ? Math.floor(options.scheduledDate.getTime() / 1000) : undefined,
            idx: options?.batchId,
            encoding: options?.encoding === 'unicode' ? 'utf-8' : undefined
        });

        const url = `${this.baseUrl}sms.do`;

        return this.http.post<BulkSMSResponse>(url, body, this.getHttpOptions()).pipe(
            retryWhen(errors =>
                errors.pipe(
                    mergeMap((error, index) => {
                        if (index >= this.maxRetries || !this.shouldRetry(error)) {
                            return throwError(() => error);
                        }
                        const delay = this.exponentialBackoff(index);
                        return timer(delay);
                    })
                )
            ),
            catchError(error => this.handleSMSError(error)),
            map(response => this.processBulkResponse(response)),
            tap(response => {
                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.log('✅ Bulk SMS sent:', {
                        total: response.count,
                        successful: response.successful_count,
                        failed: response.failed_count,
                        cost: response.total_cost
                    });
                }
            })
        );
    }

    /**
     * Send SMS to contact groups
     */
    sendToGroups(groupNames: string[], message: string, options?: BulkSMSOptions): Observable<SMSResponse> {
        if (!groupNames || groupNames.length === 0) {
            return throwError(() => new Error('No groups provided'));
        }

        const body = this.buildFormData({
            group: groupNames.join(','),
            message: message,
            from: options?.from || this.defaultSender,
            format: 'json',
            fast: options?.priority ? '1' : '0'
        });

        const url = `${this.baseUrl}sms.do`;

        return this.http.post<SMSResponse>(url, body, this.getHttpOptions()).pipe(
            retryWhen(errors =>
                errors.pipe(
                    mergeMap((error, index) => {
                        if (index >= this.maxRetries || !this.shouldRetry(error)) {
                            return throwError(() => error);
                        }
                        return timer(this.exponentialBackoff(index));
                    })
                )
            ),
            catchError(error => this.handleSMSError(error))
        );
    }

    /**
     * Check account balance (helper method)
     */
    checkBalance(): Observable<{ balance: number; currency: string }> {
        // TODO: Implement if SMSApi.bg provides balance endpoint
        // For now, return mock data
        return of({ balance: 100, currency: 'BGN' });
    }

    /**
     * Get HTTP options with authentication
     */
    private getHttpOptions() {
        return {
            headers: new HttpHeaders({
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            })
        };
    }

    /**
     * Build form-urlencoded body
     */
    private buildFormData(params: Record<string, any>): string {
        const formData = new URLSearchParams();

        Object.keys(params).forEach(key => {
            const value = params[key];
            if (value !== undefined && value !== null && value !== '') {
                formData.append(key, value.toString());
            }
        });

        return formData.toString();
    }

    /**
     * Process bulk SMS response
     */
    private processBulkResponse(response: any): BulkSMSResponse {
        const successful = response.list?.filter((msg: SMSMessageResult) =>
            msg.status === 'QUEUE' || msg.status === 'SENT'
        ) || [];

        const failed = response.list?.filter((msg: SMSMessageResult) =>
            msg.status === 'UNDELIVERED'
        ) || [];

        const totalCost = response.list?.reduce(
            (sum: number, msg: SMSMessageResult) => sum + (msg.points || 0),
            0
        ) || 0;

        return {
            ...response,
            successful_count: successful.length,
            failed_count: failed.length,
            total_cost: totalCost,
            invalid_numbers: response.invalid_numbers || []
        };
    }

    /**
     * Handle SMS API errors
     */
    private handleSMSError(error: any): Observable<never> {
        let errorMessage = 'Неизвестна грешка при изпращане на SMS';
        let errorCode: number | undefined;

        if (error instanceof HttpErrorResponse) {
            // HTTP errors
            if (error.status === 401) {
                errorMessage = 'Невалиден API token или липсва оторизация';
                errorCode = 1001;
            } else if (error.status === 403) {
                errorMessage = 'Достъпът е отказан. Проверете IP whitelist и credits';
                errorCode = 105;
            } else if (error.status === 429) {
                errorMessage = 'Rate limit exceeded (100 req/sec). Опитайте отново след малко';
                errorCode = 429;
            } else if (error.status >= 500) {
                errorMessage = 'SMS API сървърна грешка. Опитайте отново по-късно';
                errorCode = 201;
            } else if (error.error) {
                // API error response
                const apiError = error.error as SMSErrorResponse;
                if (apiError.error && SMS_ERROR_CODES[apiError.error as SMSErrorCode]) {
                    errorCode = apiError.error;
                    errorMessage = SMS_ERROR_CODES[apiError.error as SMSErrorCode];
                } else if (apiError.message) {
                    errorMessage = apiError.message;
                }
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        // ✅ NEW: Log error with ErrorLoggerService
        this.errorLogger.logSMSError(error, errorCode, {
            message: errorMessage,
            httpStatus: error.status,
            url: error.url
        });

        // Log error (existing)
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.error('❌ SMS API Error:', {
                code: errorCode,
                message: errorMessage,
                details: error
            });
        }

        // Show notification
        this.notificationService.error(
            `SMS грешка ${errorCode ? `(${errorCode})` : ''}`,
            errorMessage
        );

        return throwError(() => ({
            code: errorCode,
            message: errorMessage,
            details: error
        }));
    }

    /**
     * Determine if error should be retried
     */
    private shouldRetry(error: any): boolean {
        if (error instanceof HttpErrorResponse) {
            // Retry on rate limit and server errors
            return error.status === 429 || error.status >= 500;
        }

        // Check API error codes
        if (error.error?.error) {
            const errorCode = error.error.error;
            // Retry on system overload and queue capacity exceeded
            return errorCode === 201 || errorCode === 202;
        }

        return false;
    }

    /**
     * Exponential backoff delay calculation
     */
    private exponentialBackoff(retryIndex: number): number {
        // 1s, 2s, 4s, 8s, 16s...
        const delay = Math.pow(2, retryIndex) * 1000;
        const maxDelay = 30000; // 30 seconds max
        return Math.min(delay, maxDelay);
    }

    /**
     * Get service status (for debugging)
     */
    getServiceStatus(): {
        configured: boolean;
        baseUrl: string;
        sender: string;
        testMode: boolean;
    } {
        const config = this.environmentService.getSMSApiConfig();
        return {
            configured: !!this.token && this.token.trim() !== '',
            baseUrl: this.baseUrl,
            sender: this.defaultSender,
            testMode: config.testMode
        };
    }
}