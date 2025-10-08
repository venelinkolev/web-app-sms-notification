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