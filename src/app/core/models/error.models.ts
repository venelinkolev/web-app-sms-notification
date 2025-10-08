/**
 * Error severity levels
 */
export enum ErrorSeverity {
    /** Low severity - informational, non-critical */
    LOW = 'LOW',

    /** Medium severity - warning, potential issue */
    MEDIUM = 'MEDIUM',

    /** High severity - error, needs attention */
    HIGH = 'HIGH',

    /** Critical severity - system failure, immediate action required */
    CRITICAL = 'CRITICAL'
}

/**
 * Error context/source categories
 */
export enum ErrorContext {
    /** SMS API related errors */
    SMS_API = 'SMS_API',

    /** File operations errors */
    FILE_OPERATION = 'FILE_OPERATION',

    /** Data validation errors */
    DATA_VALIDATION = 'DATA_VALIDATION',

    /** Network/HTTP errors */
    NETWORK = 'NETWORK',

    /** Application logic errors */
    APPLICATION = 'APPLICATION',

    /** User input errors */
    USER_INPUT = 'USER_INPUT',

    /** Template processing errors */
    TEMPLATE = 'TEMPLATE',

    /** Unknown/unclassified errors */
    UNKNOWN = 'UNKNOWN'
}

/**
 * Error log entry
 */
export interface ErrorLog {
    /** Unique error ID */
    id: string;

    /** Error timestamp */
    timestamp: Date;

    /** Error severity level */
    severity: ErrorSeverity;

    /** Error context/source */
    context: ErrorContext;

    /** Error message (user-friendly) */
    message: string;

    /** Technical error details */
    technicalDetails?: string;

    /** Error code (if applicable) */
    code?: string | number;

    /** Stack trace (development only) */
    stackTrace?: string;

    /** Additional metadata */
    metadata?: Record<string, any>;

    /** User who encountered the error (if applicable) */
    userId?: string;

    /** Whether error was resolved */
    resolved?: boolean;

    /** Resolution notes */
    resolutionNotes?: string;

    /** Resolution timestamp */
    resolvedAt?: Date;
}

/**
 * Error log filter options
 */
export interface ErrorLogFilter {
    /** Filter by severity */
    severity?: ErrorSeverity[];

    /** Filter by context */
    context?: ErrorContext[];

    /** Filter by date range */
    dateRange?: {
        from: Date;
        to: Date;
    };

    /** Filter by resolved status */
    resolved?: boolean;

    /** Search in messages */
    searchText?: string;
}

/**
 * Error log statistics
 */
export interface ErrorLogStats {
    /** Total error count */
    total: number;

    /** Count by severity */
    bySeverity: Record<ErrorSeverity, number>;

    /** Count by context */
    byContext: Record<ErrorContext, number>;

    /** Resolved errors count */
    resolved: number;

    /** Unresolved errors count */
    unresolved: number;

    /** Errors in last 24 hours */
    last24Hours: number;

    /** Most common error */
    mostCommonError?: {
        message: string;
        count: number;
    };
}

/**
 * Error export format
 */
export interface ErrorExport {
    /** Export timestamp */
    exportedAt: Date;

    /** Export format version */
    version: string;

    /** Application version */
    appVersion: string;

    /** Error logs */
    logs: ErrorLog[];

    /** Statistics */
    stats: ErrorLogStats;
}

/**
 * Error recovery suggestion
 */
export interface ErrorRecoverySuggestion {
    /** Suggestion title */
    title: string;

    /** Suggestion description */
    description: string;

    /** Action button label */
    actionLabel?: string;

    /** Action handler */
    action?: () => void;

    /** Priority (higher = more important) */
    priority: number;
}

/**
 * Application error with enhanced metadata
 */
export interface AppError extends Error {
    /** Error code */
    code?: string | number;

    /** Error severity */
    severity: ErrorSeverity;

    /** Error context */
    context: ErrorContext;

    /** Technical details */
    technicalDetails?: string;

    /** Recovery suggestions */
    suggestions?: ErrorRecoverySuggestion[];

    /** Whether error is recoverable */
    recoverable: boolean;

    /** Original error (if wrapped) */
    originalError?: Error;
}