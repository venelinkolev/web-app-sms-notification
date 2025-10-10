import { ErrorSeverity } from './error.models';

/**
 * SMS message statuses from SMSApi.bg
 */
export enum SMSStatus {
    QUEUE = 'QUEUE',           // Message queued for sending
    SENT = 'SENT',             // Message sent to carrier
    DELIVERED = 'DELIVERED',   // Message delivered to recipient
    UNDELIVERED = 'UNDELIVERED' // Message delivery failed
}

/**
 * SMS character encoding types
 */
export enum SMSEncoding {
    STANDARD = 'standard',     // GSM 7-bit (160 chars)
    UNICODE = 'unicode'        // UTF-8 (70 chars, supports Cyrillic)
}

/**
 * Individual SMS message result from API
 */
export interface SMSMessageResult {
    /** Unique message identifier */
    id: string;

    /** Cost in points/credits */
    points: number;

    /** Recipient phone number */
    number: string;

    /** Send timestamp (Unix timestamp) */
    date_sent: number;

    /** Message status */
    status: SMSStatus;
}

/**
 * Successful SMS API response
 */
export interface SMSResponse {
    /** Number of messages processed */
    count: number;

    /** List of individual message results */
    list: SMSMessageResult[];
}

/**
 * Invalid phone number details
 */
export interface InvalidNumber {
    /** Invalid phone number */
    number: string;

    /** Error description */
    message: string;
}

/**
 * SMS API error response
 */
export interface SMSErrorResponse {
    /** List of invalid phone numbers */
    invalid_numbers?: InvalidNumber[];

    /** Error code from SMSApi.bg */
    error: number;

    /** Error message description */
    message: string;
}

/**
 * Complete SMS operation result (success + errors)
 */
export interface SMSOperationResult {
    /** Successful message results */
    successful: SMSMessageResult[];

    /** Failed message attempts */
    failed: Array<{
        phoneNumber: string;
        clientId: string;
        error: string;
        errorCode: number;
    }>;

    /** Invalid phone numbers */
    invalidNumbers: InvalidNumber[];

    /** Operation statistics */
    stats: {
        totalAttempted: number;
        totalSuccessful: number;
        totalFailed: number;
        totalInvalid: number;
        totalCost: number;
    };

    /** Operation timestamp */
    timestamp: Date;

    /** Operation duration in milliseconds */
    duration: number;
}

/**
 * SMS template configuration
 */
export interface SMSTemplate {
    /** Template identifier */
    id: string;

    /** Template name for UI */
    name: string;

    /** Template message content with placeholders */
    content: string;

    /** Available placeholders */
    placeholders: Array<{
        key: string;
        description: string;
        example: string;
    }>;

    /** Character count information */
    characterInfo: {
        baseLength: number;
        encoding: SMSEncoding;
        estimatedParts: number;
    };

    /** Template creation/modification dates */
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Personalized SMS message for a specific client
 */
export interface PersonalizedSMS {
    /** Client record reference */
    clientId: string;

    /** Client phone number */
    phoneNumber: string;

    /** Personalized message content */
    content: string;

    /** Message character count */
    characterCount: number;

    /** Estimated SMS parts needed */
    estimatedParts: number;

    /** Encoding type used */
    encoding: SMSEncoding;

    /** Estimated cost in credits */
    estimatedCost: number;

    /** Template used for generation */
    templateId?: string;

    /** Validation status */
    isValid: boolean;

    /** Validation errors if any */
    validationErrors?: string[];
}

/**
 * Batch SMS sending request
 */
export interface BatchSMSRequest {
    /** List of personalized SMS messages */
    messages: PersonalizedSMS[];

    /** Sender name */
    sender: string;

    /** Priority sending flag */
    priority?: boolean;

    /** Scheduled send date (optional) */
    scheduledDate?: Date;

    /** Custom batch identifier */
    batchId?: string;

    /** Test mode flag */
    testMode?: boolean;
}

/**
 * Batch SMS operation progress
 */
export interface BatchSMSProgress {
    /** Batch identifier */
    batchId: string;

    /** Current progress (0-100) */
    progress: number;

    /** Messages processed so far */
    processed: number;

    /** Total messages in batch */
    total: number;

    /** Successfully sent count */
    successful: number;

    /** Failed send count */
    failed: number;

    /** Currently processing message */
    currentMessage?: string;

    /** Estimated completion time */
    estimatedCompletion?: Date;

    /** Operation status */
    status: BatchSMSStatus;

    /** Start time */
    startTime: Date;

    /** Current errors */
    errors: string[];
}

/**
 * Batch SMS operation statuses
 */
export enum BatchSMSStatus {
    PENDING = 'PENDING',       // Not started yet
    PROCESSING = 'PROCESSING', // Currently sending
    PAUSED = 'PAUSED',        // Temporarily paused
    COMPLETED = 'COMPLETED',   // All messages processed
    CANCELLED = 'CANCELLED',   // Operation cancelled
    FAILED = 'FAILED'         // Operation failed
}

/**
 * SMS delivery report from webhook
 */
export interface SMSDeliveryReport {
    /** Message ID */
    MsgId: string;

    /** Delivery status */
    status: SMSStatus;

    /** Delivery timestamp (Unix timestamp) */
    donedate: number;

    /** Sender name */
    from: string;

    /** Recipient number */
    to: string;

    /** Credits consumed */
    points: string;

    /** Error description (if failed) */
    error?: string;
}

/**
 * SMS API error code mappings
 */
export const SMS_ERROR_CODES = {
    11: 'Invalid credentials or message too long/encoding issue',
    13: 'No valid phone numbers provided',
    14: 'Invalid sender name',
    15: 'Message contains prohibited content',
    103: 'Insufficient account credits',
    104: 'Account suspended or blocked',
    105: 'IP address not whitelisted',
    106: 'Credit reservation failed for bulk operation',
    201: 'System overloaded, retry later',
    202: 'Queue capacity exceeded',
    429: 'Rate limit exceeded',
    1001: 'Missing authorization header'
} as const;

/**
 * SMS API error codes type
 */
export type SMSErrorCode = keyof typeof SMS_ERROR_CODES;

/**
 * Extended SMS error code with detailed metadata
 */
export interface SMSErrorCodeExtended {
    /** Numeric error code */
    code: number;

    /** Error message in English */
    message: string;

    /** Error message in Bulgarian */
    messageBG: string;

    /** Error severity level */
    severity: ErrorSeverity;

    /** Whether error is recoverable by user action */
    recoverable: boolean;

    /** Whether operation should be retried automatically */
    retryable: boolean;

    /** User-friendly suggestion in Bulgarian (formal form) */
    suggestion: string;
}

/**
 * Extended SMS error codes with detailed metadata and Bulgarian translations
 * Use this for enhanced error handling with severity levels and recovery suggestions
 */
export const SMS_ERROR_CODES_EXTENDED: Record<number, SMSErrorCodeExtended> = {
    11: {
        code: 11,
        message: 'Invalid credentials or message too long',
        messageBG: 'Невалиден API token или съобщението е твърде дълго',
        severity: ErrorSeverity.HIGH,
        recoverable: false,
        retryable: false,
        suggestion: 'Моля, проверете вашия API token или намалете дължината на съобщението. Максимум 160 символа за латиница или 70 за кирилица.'
    },
    13: {
        code: 13,
        message: 'No valid phone numbers provided',
        messageBG: 'Не са предоставени валидни телефонни номера',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: false,
        suggestion: 'Моля, проверете телефонните номера. Трябва да бъдат в международен формат (+359...).'
    },
    14: {
        code: 14,
        message: 'Invalid sender name',
        messageBG: 'Невалидно име на подателя',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: false,
        suggestion: 'Името на подателя трябва да бъде 1-11 символа, само букви и цифри. Моля, използвайте верифицирано име.'
    },
    15: {
        code: 15,
        message: 'Message contains prohibited content',
        messageBG: 'Съобщението съдържа забранено съдържание',
        severity: ErrorSeverity.HIGH,
        recoverable: false,
        retryable: false,
        suggestion: 'Вашето съобщение съдържа забранени думи или съдържание. Моля, променете текста на съобщението.'
    },
    103: {
        code: 103,
        message: 'Insufficient account credits',
        messageBG: 'Недостатъчен баланс в акаунта',
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: false,
        suggestion: 'Няма достатъчно credits за изпращане на SMS. Моля, добавете credits към вашия акаунт в портала на SMSApi.bg.'
    },
    104: {
        code: 104,
        message: 'Account suspended or blocked',
        messageBG: 'Акаунтът е спрян или блокиран',
        severity: ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        suggestion: 'Вашият акаунт е временно спрян или блокиран. Моля, свържете се със support на SMSApi.bg за повече информация.'
    },
    105: {
        code: 105,
        message: 'IP address not whitelisted',
        messageBG: 'IP адресът не е одобрен',
        severity: ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        suggestion: 'Вашият IP адрес не е в белия списък. Моля, добавете го в настройките на акаунта си на https://portal.smsapi.bg/react/ip-filters.'
    },
    106: {
        code: 106,
        message: 'Credit reservation failed for bulk operation',
        messageBG: 'Грешка при резервация на credits за групово изпращане',
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: false,
        suggestion: 'Не може да се резервират достатъчно credits за груповата операция. Моля, проверете баланса си и опитайте с по-малко съобщения.'
    },
    201: {
        code: 201,
        message: 'System overloaded, retry later',
        messageBG: 'Системата е претоварена',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        suggestion: 'SMS системата е временно претоварена. Моля, изчакайте няколко минути и опитайте отново.'
    },
    202: {
        code: 202,
        message: 'Queue capacity exceeded',
        messageBG: 'Надвишен капацитет на опашката',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        suggestion: 'Опашката за SMS е пълна в момента. Моля, изчакайте няколко минути и опитайте отново.'
    },
    429: {
        code: 429,
        message: 'Rate limit exceeded',
        messageBG: 'Превишен лимит на заявки',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        suggestion: 'Изпратихте твърде много заявки за кратко време (лимит: 100 заявки/секунда). Моля, изчакайте малко и опитайте отново.'
    },
    1001: {
        code: 1001,
        message: 'Missing authorization header',
        messageBG: 'Липсва authorization header',
        severity: ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        suggestion: 'Липсва оторизация в заявката. Моля, проверете дали сте задали правилно API token в настройките на приложението.'
    }
};

/**
 * Type for SMS error code numbers
 */
export type SMSErrorCodeNumber = keyof typeof SMS_ERROR_CODES_EXTENDED;

/**
 * Get extended error code details by code number
 */
export function getSMSErrorCodeExtended(code: number): SMSErrorCodeExtended | undefined {
    return SMS_ERROR_CODES_EXTENDED[code];
}

/**
 * Check if error code is retryable
 */
export function isSMSErrorRetryable(code: number): boolean {
    return SMS_ERROR_CODES_EXTENDED[code]?.retryable ?? false;
}

/**
 * Check if error is recoverable by user action
 */
export function isSMSErrorRecoverable(code: number): boolean {
    return SMS_ERROR_CODES_EXTENDED[code]?.recoverable ?? false;
}

/**
 * Get Bulgarian error message by code
 */
export function getSMSErrorMessageBG(code: number): string {
    return SMS_ERROR_CODES_EXTENDED[code]?.messageBG ?? 'Неизвестна грешка';
}

/**
 * Get error severity by code
 */
export function getSMSErrorSeverity(code: number): ErrorSeverity {
    return SMS_ERROR_CODES_EXTENDED[code]?.severity ?? ErrorSeverity.MEDIUM;
}

/**
 * SMS Service Request Parameters
 */

/**
 * Parameters for sending a single SMS
 */
export interface SendSMSParams {
    /** Recipient phone number(s) in international format */
    to: string | string[];

    /** SMS message content */
    message: string;

    /** Sender name (must be verified, defaults to "Test") */
    from?: string;

    /** Priority delivery flag (50% premium cost) */
    priority?: boolean;

    /** Scheduled delivery date (Unix timestamp) */
    scheduledDate?: Date;

    /** Custom message identifier (max 32 characters) */
    customId?: string;

    /** Character encoding flag */
    hasSpecialChars?: boolean;

    /** Template identifier */
    templateId?: string;

    /** Template parameters */
    templateParams?: Record<string, string>;
}

/**
 * Options for bulk SMS operations
 */
export interface BulkSMSOptions {
    /** Sender name */
    from?: string;

    /** Priority delivery flag */
    priority?: boolean;

    /** Scheduled delivery date */
    scheduledDate?: Date;

    /** Custom batch identifier */
    batchId?: string;

    /** Encoding type */
    encoding?: SMSEncoding;
}

/**
 * Bulk SMS sending response
 */
export interface BulkSMSResponse extends SMSResponse {
    /** Invalid phone numbers */
    invalid_numbers?: InvalidNumber[];

    /** Total cost in credits */
    total_cost: number;

    /** Successful sends count */
    successful_count: number;

    /** Failed sends count */
    failed_count: number;
}

/**
 * SMS sending result with client context
 */
export interface SMSSendResult {
    /** Client record ID */
    clientId: string;

    /** Phone number used */
    phoneNumber: string;

    /** Original message content (for retry purposes) */
    message?: string;

    /** SMS message ID from API */
    messageId?: string;

    /** Send status */
    status: 'success' | 'failed';

    /** Error message if failed */
    error?: string;

    /** Error code if failed */
    errorCode?: number;

    /** Cost in credits */
    cost?: number;

    /** Timestamp */
    timestamp: Date;
}

/**
 * Batch SMS operation complete result
 */
export interface BatchSMSCompleteResult {
    /** Batch identifier */
    batchId: string;

    /** Individual send results */
    results: SMSSendResult[];

    /** Statistics */
    stats: {
        total: number;
        successful: number;
        failed: number;
        totalCost: number;
    };

    /** Operation start time */
    startTime: Date;

    /** Operation end time */
    endTime: Date;

    /** Duration in milliseconds */
    duration: number;
}

/**
 * Detailed batch operation result with retry support
 * Used for tracking individual message success/failure in batch operations
 */
export interface BatchOperationResult {
    /** Successfully sent messages with details */
    successful: SMSSendResult[];

    /** Failed messages with error details */
    failed: SMSSendResult[];

    /** Invalid phone numbers that were rejected */
    invalid: Array<{
        clientId: string;
        phoneNumber: string;
        reason: string;
    }>;

    /** Detailed statistics */
    stats: {
        /** Total messages attempted */
        totalAttempted: number;

        /** Successfully sent count */
        successfulCount: number;

        /** Failed send count */
        failedCount: number;

        /** Invalid phone count */
        invalidCount: number;

        /** Success rate (0-1) */
        successRate: number;

        /** Failure rate (0-1) */
        failureRate: number;

        /** Total cost in credits */
        totalCost: number;

        /** Average cost per successful message */
        averageCost: number;
    };

    /** Whether any failed messages can be retried */
    canRetry: boolean;

    /** List of failed messages that are retryable */
    retryableMessages: Array<{
        clientId: string;
        phoneNumber: string;
        message: string;
        errorCode: number;
        errorMessage: string;
    }>;

    /** Batch operation metadata */
    metadata: {
        /** Batch start time */
        startTime: Date;

        /** Batch end time */
        endTime: Date;

        /** Duration in milliseconds */
        duration: number;

        /** Sender name used */
        sender: string;

        /** Whether priority sending was used */
        priority: boolean;
    };
}

/**
 * Input for batch SMS with tracking
 */
export interface BatchSMSMessage {
    /** Client record ID for tracking */
    clientId: string;

    /** Phone number in international format */
    phoneNumber: string;

    /** SMS message content */
    message: string;

    /** Optional custom message ID */
    customId?: string;
}

/**
 * Options for retry operation
 */
export interface RetryOptions {
    /** Retry only specific error codes */
    retryErrorCodes?: number[];

    /** Maximum retry attempts per message */
    maxRetries?: number;

    /** Delay between retries (ms) */
    retryDelay?: number;

    /** Whether to use exponential backoff */
    useExponentialBackoff?: boolean;
}