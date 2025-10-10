import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer, of, forkJoin } from 'rxjs';
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
    SMS_ERROR_CODES_EXTENDED,
    SMSMessageResult,
    SMSSendResult,
    BatchSMSCompleteResult,
    InvalidNumber,
    getSMSErrorCodeExtended,
    getSMSErrorMessageBG,
    getSMSErrorSeverity,
    BatchOperationResult,
    isSMSErrorRetryable,
    BatchSMSMessage,
    RetryOptions
} from '../models';
import { ErrorLoggerService } from './error-logger.service';
import { ErrorContext, ErrorSeverity } from '../models/error.models';
import { CircuitBreakerService } from './circuit-breaker.service';
import type { RetryStrategyConfig } from '../../../environments/environment.interface';

/**
 * Batch Result Tracker - Private utility class for tracking batch SMS operations
 * Tracks individual message success/failure with detailed metadata
 */
class BatchResultTracker {
    private successful: SMSSendResult[] = [];
    private failed: SMSSendResult[] = [];
    private invalid: Array<{ clientId: string; phoneNumber: string; reason: string }> = [];
    private startTime: Date;
    private sender: string;
    private priority: boolean;

    constructor(sender: string, priority: boolean = false) {
        this.startTime = new Date();
        this.sender = sender;
        this.priority = priority;
    }

    /**
     * Add successful SMS result
     */
    addSuccess(result: SMSSendResult): void {
        this.successful.push(result);
    }

    /**
     * Add failed SMS result
     */
    addFailure(result: SMSSendResult): void {
        this.failed.push(result);
    }

    /**
     * Add invalid phone number
     */
    addInvalid(clientId: string, phoneNumber: string, reason: string): void {
        this.invalid.push({ clientId, phoneNumber, reason });
    }

    /**
     * Check if any failed messages can be retried
     */
    canRetry(): boolean {
        return this.failed.some(result =>
            result.errorCode && isSMSErrorRetryable(result.errorCode)
        );
    }

    /**
     * Get list of retryable failed messages
     */
    getRetryableMessages(): Array<{
        clientId: string;
        phoneNumber: string;
        message: string;
        errorCode: number;
        errorMessage: string;
    }> {
        return this.failed
            .filter(result =>
                result.errorCode &&
                isSMSErrorRetryable(result.errorCode) &&
                result.message // ✅ Само ако има message
            )
            .map(result => ({
                clientId: result.clientId,
                phoneNumber: result.phoneNumber,
                message: result.message!, // ✅ Използваме съхраненото message
                errorCode: result.errorCode!,
                errorMessage: result.error || 'Unknown error'
            }));
    }

    /**
     * Calculate statistics
     */
    private calculateStats() {
        const totalAttempted = this.successful.length + this.failed.length + this.invalid.length;
        const successfulCount = this.successful.length;
        const failedCount = this.failed.length;
        const invalidCount = this.invalid.length;

        const totalCost = this.successful.reduce((sum, result) => sum + (result.cost || 0), 0);
        const averageCost = successfulCount > 0 ? totalCost / successfulCount : 0;

        const successRate = totalAttempted > 0 ? successfulCount / totalAttempted : 0;
        const failureRate = totalAttempted > 0 ? failedCount / totalAttempted : 0;

        return {
            totalAttempted,
            successfulCount,
            failedCount,
            invalidCount,
            successRate,
            failureRate,
            totalCost,
            averageCost
        };
    }

    /**
     * Get final batch operation result
     */
    getResult(): BatchOperationResult {
        const endTime = new Date();
        const duration = endTime.getTime() - this.startTime.getTime();

        return {
            successful: this.successful,
            failed: this.failed,
            invalid: this.invalid,
            stats: this.calculateStats(),
            canRetry: this.canRetry(),
            retryableMessages: this.getRetryableMessages(),
            metadata: {
                startTime: this.startTime,
                endTime,
                duration,
                sender: this.sender,
                priority: this.priority
            }
        };
    }

    /**
     * Get current progress (for monitoring)
     */
    getProgress(): {
        processed: number;
        successful: number;
        failed: number;
        invalid: number;
    } {
        return {
            processed: this.successful.length + this.failed.length + this.invalid.length,
            successful: this.successful.length,
            failed: this.failed.length,
            invalid: this.invalid.length
        };
    }
}

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
        private errorLogger: ErrorLoggerService,
        private circuitBreaker: CircuitBreakerService,
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
        const testUrl = '/api/sms.do'; // For local testing with proxy

        // ✅ NEW: Wrap request in circuit breaker
        const request$ = this.http.post<SMSResponse>(testUrl, body, this.getHttpOptions()).pipe(
            // ✅ ENHANCED: Smart retry with strategy selection
            retryWhen(errors =>
                errors.pipe(
                    mergeMap((error, index) => {
                        // Get appropriate retry strategy for this error
                        const strategy = this.getRetryStrategy(error);

                        if (index >= strategy.maxAttempts || !this.shouldRetry(error)) {
                            return throwError(() => error);
                        }

                        // Calculate delay using strategy
                        const delay = this.calculateRetryDelay(index, strategy);

                        if (this.environmentService.isConsoleLoggingEnabled()) {
                            console.log(`🔄 Retry ${index + 1}/${strategy.maxAttempts} (${strategy.name}) after ${delay}ms...`);
                        }

                        return timer(delay);
                    })
                )
            ),
            catchError(error => this.handleSMSError(error)),
            tap(response => {
                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.log('✅ SMS sent successfully:', response);
                }

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

        // Execute through circuit breaker
        return this.circuitBreaker.execute(request$, 'SMS Send');
    }

    /**
 * Get appropriate retry strategy based on error type
 * @private
 */
    private getRetryStrategy(error: any): RetryStrategyConfig {
        const errorConfig = this.environmentService.getConfig().errorHandling;
        const strategies = errorConfig.retryStrategies;

        if (!strategies) {
            // Fallback to default strategy
            return {
                name: 'Default Strategy',
                maxAttempts: this.maxRetries,
                baseDelay: this.retryDelay,
                useExponentialBackoff: true,
                backoffMultiplier: 2,
                maxDelay: 30000,
                errorCodes: []
            };
        }

        let errorCode: number | undefined;

        // Extract error code
        if (error instanceof HttpErrorResponse) {
            if (error.status === 429) {
                errorCode = 429;
            } else if (error.status >= 500) {
                errorCode = error.status;
            } else if (error.error?.error) {
                errorCode = error.error.error;
            }
        }

        // Match strategy by error code
        if (errorCode) {
            // Check rate limit strategy
            if (strategies.rateLimitStrategy.errorCodes.includes(errorCode)) {
                return strategies.rateLimitStrategy;
            }

            // Check server error strategy
            if (strategies.serverErrorStrategy.errorCodes.includes(errorCode)) {
                return strategies.serverErrorStrategy;
            }

            // Check overload strategy
            if (strategies.overloadStrategy.errorCodes.includes(errorCode)) {
                return strategies.overloadStrategy;
            }
        }

        // Default strategy
        return strategies.defaultStrategy;
    }

    /**
 * Calculate retry delay based on strategy configuration
 * @private
 */
    private calculateRetryDelay(retryIndex: number, strategy: RetryStrategyConfig): number {
        let delay: number;

        if (strategy.useExponentialBackoff) {
            // Exponential backoff: baseDelay * (multiplier ^ retryIndex)
            const multiplier = strategy.backoffMultiplier || 2;
            delay = strategy.baseDelay * Math.pow(multiplier, retryIndex);
        } else {
            // Linear backoff: baseDelay * (retryIndex + 1)
            delay = strategy.baseDelay * (retryIndex + 1);
        }

        // Apply max delay cap
        return Math.min(delay, strategy.maxDelay);
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

        const request$ = this.http.post<BulkSMSResponse>(url, body, this.getHttpOptions()).pipe(
            retryWhen(errors =>
                errors.pipe(
                    mergeMap((error, index) => {
                        const strategy = this.getRetryStrategy(error);

                        if (index >= strategy.maxAttempts || !this.shouldRetry(error)) {
                            return throwError(() => error);
                        }

                        const delay = this.calculateRetryDelay(index, strategy);
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
                        successful: response['successful_count'],
                        failed: response['failed_count'],
                        cost: response['total_cost']
                    });
                }
            })
        );

        // Execute through circuit breaker
        return this.circuitBreaker.execute(request$, 'Bulk SMS Send');
    }

    /**
 * Get circuit breaker status (for monitoring/debugging)
 */
    getCircuitBreakerStatus(): {
        state: string;
        stats: any;
        isHealthy: boolean;
    } {
        const stats = this.circuitBreaker.getStats();

        return {
            state: stats.state,
            stats: stats,
            isHealthy: stats.state === 'CLOSED'
        };
    }

    /**
     * Reset circuit breaker (admin/testing purposes)
     */
    resetCircuitBreaker(): void {
        this.circuitBreaker.reset();
        this.notificationService.info(
            'Circuit Breaker Reset',
            'Circuit breaker е възстановен до нормално състояние'
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
        let extendedErrorInfo: ReturnType<typeof getSMSErrorCodeExtended>;

        if (error instanceof HttpErrorResponse) {
            // HTTP errors - map to SMS error codes
            if (error.status === 401) {
                errorCode = 1001;
            } else if (error.status === 403) {
                errorCode = 105;
            } else if (error.status === 429) {
                errorCode = 429;
            } else if (error.status >= 500) {
                errorCode = 201;
            } else if (error.error) {
                // API error response
                const apiError = error.error as SMSErrorResponse;
                if (apiError.error) {
                    errorCode = apiError.error;
                }
            }

            // Get extended error info if code is available
            if (errorCode) {
                extendedErrorInfo = getSMSErrorCodeExtended(errorCode);
                if (extendedErrorInfo) {
                    // Use Bulgarian message from extended codes
                    errorMessage = extendedErrorInfo.messageBG;
                } else {
                    // Fallback to old error codes for backward compatibility
                    errorMessage = SMS_ERROR_CODES[errorCode as SMSErrorCode] || errorMessage;
                }
            } else if (error.error?.message) {
                errorMessage = error.error.message;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        // Determine severity
        const severity = errorCode
            ? getSMSErrorSeverity(errorCode)
            : ErrorSeverity.MEDIUM;

        // Build metadata with extended info
        const metadata: Record<string, any> = {
            message: errorMessage,
            httpStatus: error.status,
            url: error.url,
            errorCode: errorCode
        };

        // Add extended error details to metadata
        if (extendedErrorInfo) {
            metadata['severity'] = extendedErrorInfo['severity'];
            metadata['recoverable'] = extendedErrorInfo['recoverable'];
            metadata['retryable'] = extendedErrorInfo['retryable'];
            metadata['suggestion'] = extendedErrorInfo['suggestion'];
            metadata['messageEN'] = extendedErrorInfo['message'];
        }

        // ✅ ENHANCED: Log error with ErrorLoggerService including severity
        this.errorLogger.logError(
            error,
            ErrorContext.SMS_API,
            severity,
            metadata
        );

        // Log to console (development only)
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.error('❌ SMS API Error:', {
                code: errorCode,
                message: errorMessage,
                severity: severity,
                suggestion: extendedErrorInfo?.['suggestion'],
                details: error
            });
        }

        // Build notification message
        let notificationMessage = errorMessage;

        // Add suggestion to notification for recoverable errors
        if (extendedErrorInfo?.['recoverable'] && extendedErrorInfo['suggestion']) {
            notificationMessage += `\n\n💡 ${extendedErrorInfo['suggestion']}`;
        }

        // Show notification
        this.notificationService.error(
            `SMS грешка ${errorCode ? `(${errorCode})` : ''}`,
            notificationMessage
        );

        return throwError(() => ({
            code: errorCode,
            message: errorMessage,
            severity: severity,
            suggestion: extendedErrorInfo?.['suggestion'],
            recoverable: extendedErrorInfo?.['recoverable'] ?? false,
            retryable: extendedErrorInfo?.['retryable'] ?? false,
            details: error
        }));
    }

    /**
     * Determine if error should be retried
     */
    private shouldRetry(error: any): boolean {
        if (error instanceof HttpErrorResponse) {
            // Retry on rate limit and server errors
            if (error.status === 429 || error.status >= 500) {
                return true;
            }
        }

        // Check API error codes using extended info
        if (error.error?.error) {
            const errorCode = error.error.error;
            const extendedInfo = getSMSErrorCodeExtended(errorCode);

            if (extendedInfo) {
                return extendedInfo['retryable'];
            }

            // Fallback to old logic
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

    /**
     * Send batch SMS with detailed per-recipient tracking
     * Tracks individual success/failure for each message
     * 
     * @param messages - Array of messages with clientId, phoneNumber, message
     * @param options - Optional sending options (sender, priority, etc.)
     * @returns Observable<BatchOperationResult> with detailed tracking
     */
    sendBatchWithTracking(
        messages: BatchSMSMessage[],
        options?: BulkSMSOptions
    ): Observable<BatchOperationResult> {
        // Validation
        if (!messages || messages.length === 0) {
            this.notificationService.error('SMS грешка', 'Няма съобщения за изпращане');
            return throwError(() => new Error('No messages provided'));
        }

        if (messages.length > 10000) {
            this.notificationService.warning(
                'Твърде много съобщения',
                `Максимум 10,000 съобщения на заявка. Текущо: ${messages.length}`
            );
            return throwError(() => new Error('Too many messages (max 10,000)'));
        }

        const sender = options?.from || this.defaultSender;
        const priority = options?.priority || false;
        const tracker = new BatchResultTracker(sender, priority);

        // Log operation start
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.group('📨 Batch SMS with Tracking');
            console.log('Total messages:', messages.length);
            console.log('Sender:', sender);
            console.log('Priority:', priority);
            console.groupEnd();
        }

        // Използваме forkJoin за паралелно изпращане
        const sendOperations = messages.map((msg, index) =>
            this.sendSMS({
                to: msg.phoneNumber,
                message: msg.message,
                from: sender,
                priority: priority,
                customId: msg.customId || `${msg.clientId}-${index}`
            }).pipe(
                tap(response => {
                    // Success - добавяме в tracker
                    const result: SMSSendResult = {
                        clientId: msg.clientId,
                        phoneNumber: msg.phoneNumber,
                        message: msg.message, // ✅ Съхраняваме message за retry
                        messageId: response.list[0]?.id,
                        status: 'success',
                        cost: response.list[0]?.points || 0,
                        timestamp: new Date()
                    };

                    tracker.addSuccess(result);

                    if (this.environmentService.isConsoleLoggingEnabled()) {
                        console.log(`✅ SMS sent to ${msg.clientId} (${msg.phoneNumber})`);
                    }
                }),
                catchError(error => {
                    // Failure - добавяме в tracker
                    const errorCode = error.code || error.status;
                    const errorMessage = error.message || 'Unknown error';

                    const result: SMSSendResult = {
                        clientId: msg.clientId,
                        phoneNumber: msg.phoneNumber,
                        message: msg.message, // ✅ Съхраняваме message за retry
                        status: 'failed',
                        error: errorMessage,
                        errorCode: errorCode,
                        timestamp: new Date()
                    };

                    tracker.addFailure(result);

                    // Log в ErrorLoggerService
                    this.errorLogger.logSMSError(error, errorCode, {
                        clientId: msg.clientId,
                        phoneNumber: msg.phoneNumber,
                        operation: 'batch_send'
                    });

                    if (this.environmentService.isConsoleLoggingEnabled()) {
                        console.error(`❌ SMS failed for ${msg.clientId}: ${errorMessage}`);
                    }

                    // Връщаме празен observable за да продължи операцията
                    return of(null);
                })
            )
        );

        // Изчакваме всички операции да завършат
        return forkJoin(sendOperations).pipe(
            map(() => {
                const result = tracker.getResult();

                // Final notification
                this.notificationService.info(
                    'Batch изпращане завършено',
                    `✅ Успешни: ${result.stats.successfulCount}\n` +
                    `❌ Неуспешни: ${result.stats.failedCount}\n` +
                    `💰 Разход: ${result.stats.totalCost.toFixed(2)} credits`,
                    7000
                );

                // Log в ErrorLogger
                this.errorLogger.logError(
                    `Batch SMS operation completed: ${result.stats.successfulCount}/${result.stats.totalAttempted} successful`,
                    ErrorContext.SMS_API,
                    result.stats.failedCount > 0 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW,
                    {
                        totalAttempted: result.stats.totalAttempted,
                        successfulCount: result.stats.successfulCount,
                        failedCount: result.stats.failedCount,
                        successRate: result.stats.successRate,
                        totalCost: result.stats.totalCost
                    }
                );

                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.group('📊 Batch Operation Result');
                    console.log('Total attempted:', result.stats.totalAttempted);
                    console.log('Successful:', result.stats.successfulCount);
                    console.log('Failed:', result.stats.failedCount);
                    console.log('Success rate:', (result.stats.successRate * 100).toFixed(1) + '%');
                    console.log('Total cost:', result.stats.totalCost.toFixed(2), 'credits');
                    console.log('Can retry:', result.canRetry);
                    console.groupEnd();
                }

                return result;
            }),
            catchError(error => {
                this.notificationService.error(
                    'Грешка при batch изпращане',
                    error.message || 'Неизвестна грешка'
                );
                return throwError(() => error);
            })
        );
    }

    /**
     * Retry only failed messages from a previous batch operation
     * 
     * @param previousResult - Result from previous sendBatchWithTracking call
     * @param options - Optional retry options
     * @returns Observable<BatchOperationResult> with retry results
     */
    retryFailedMessages(
        previousResult: BatchOperationResult,
        options?: RetryOptions
    ): Observable<BatchOperationResult> {
        // Check if there are retryable messages
        if (!previousResult.canRetry) {
            this.notificationService.warning(
                'Няма съобщения за retry',
                'Всички неуспешни съобщения не могат да бъдат повторени автоматично'
            );
            return throwError(() => new Error('No retryable messages'));
        }

        const retryableMessages = previousResult.retryableMessages;

        if (retryableMessages.length === 0) {
            this.notificationService.info('Няма съобщения за retry', 'Всички съобщения са изпратени успешно');
            return of(previousResult); // Връщаме същия резултат
        }

        // Log retry attempt
        if (this.environmentService.isConsoleLoggingEnabled()) {
            console.group('🔄 Retry Failed Messages');
            console.log('Retrying messages:', retryableMessages.length);
            console.log('Error codes:', retryableMessages.map(m => m.errorCode));
            console.groupEnd();
        }

        this.notificationService.info(
            'Retry започна',
            `Опитваме се да изпратим отново ${retryableMessages.length} неуспешни съобщения...`,
            3000
        );

        // Log в ErrorLogger
        this.errorLogger.logError(
            `Retrying ${retryableMessages.length} failed SMS messages`,
            ErrorContext.SMS_API,
            ErrorSeverity.MEDIUM,
            {
                retryCount: retryableMessages.length,
                errorCodes: retryableMessages.map(m => m.errorCode)
            }
        );

        // Конвертираме retryable messages обратно в BatchSMSMessage формат
        // ВАЖНО: message полето трябва да се запази от оригиналната операция
        // За целта използваме failed резултатите от previousResult
        // Конвертираме retryable messages обратно в BatchSMSMessage формат
        const messagesToRetry: BatchSMSMessage[] = previousResult.failed
            .filter(failedMsg =>
                failedMsg.errorCode &&
                isSMSErrorRetryable(failedMsg.errorCode) &&
                failedMsg.message // ✅ Проверяваме дали има message
            )
            .map(failedMsg => ({
                clientId: failedMsg.clientId,
                phoneNumber: failedMsg.phoneNumber,
                message: failedMsg.message!, // ✅ Използваме съхраненото message
                customId: `retry-${failedMsg.clientId}-${Date.now()}`
            }));

        if (messagesToRetry.length === 0) {
            this.notificationService.warning(
                'Няма валидни съобщения за retry',
                'Не са намерени съобщения с валидно съдържание за повторно изпращане'
            );
            return throwError(() => new Error('No valid messages to retry'));
        }

        // Retry with same options as original
        return this.sendBatchWithTracking(messagesToRetry, {
            from: previousResult.metadata.sender,
            priority: previousResult.metadata.priority
        }).pipe(
            tap(retryResult => {
                // Log retry results
                if (this.environmentService.isConsoleLoggingEnabled()) {
                    console.group('🔄 Retry Results');
                    console.log('Retry successful:', retryResult.stats.successfulCount);
                    console.log('Retry failed:', retryResult.stats.failedCount);
                    console.log('Success rate:', (retryResult.stats.successRate * 100).toFixed(1) + '%');
                    console.groupEnd();
                }

                // Show notification with retry results
                this.notificationService.info(
                    'Retry завършен',
                    `✅ Успешни: ${retryResult.stats.successfulCount}\n` +
                    `❌ Все още неуспешни: ${retryResult.stats.failedCount}`,
                    7000
                );
            })
        );
    }
}
