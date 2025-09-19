/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
    /** Response data */
    data: T;

    /** Success status */
    success: boolean;

    /** Response message */
    message?: string;

    /** Error details if failed */
    error?: ApiError;

    /** Response timestamp */
    timestamp: Date;

    /** Request ID for tracking */
    requestId?: string;

    /** Response metadata */
    metadata?: Record<string, any>;
}

/**
 * API error structure
 */
export interface ApiError {
    /** Error code */
    code: string | number;

    /** Error message */
    message: string;

    /** Detailed error description */
    details?: string;

    /** Field-specific errors */
    fieldErrors?: Record<string, string[]>;

    /** Stack trace (development only) */
    stack?: string;

    /** Error timestamp */
    timestamp: Date;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    /** Data items for current page */
    items: T[];

    /** Pagination metadata */
    pagination: {
        /** Current page (0-based) */
        page: number;

        /** Items per page */
        pageSize: number;

        /** Total number of items */
        totalItems: number;

        /** Total number of pages */
        totalPages: number;

        /** Whether there are more pages */
        hasNext: boolean;

        /** Whether there are previous pages */
        hasPrevious: boolean;

        /** Index of first item on page */
        startIndex: number;

        /** Index of last item on page */
        endIndex: number;
    };

    /** Sorting information */
    sorting?: {
        field: string;
        direction: SortDirection;
    };

    /** Filtering information */
    filtering?: {
        activeFilters: Record<string, any>;
        totalUnfiltered: number;
    };
}

/**
 * Sort direction options
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Generic operation result
 */
export interface OperationResult<TSuccess = any, TError = any> {
    /** Whether operation succeeded */
    success: boolean;

    /** Success data */
    data?: TSuccess;

    /** Error information */
    error?: TError;

    /** Operation message */
    message?: string;

    /** Operation duration in ms */
    duration?: number;

    /** Operation timestamp */
    timestamp: Date;
}

/**
 * Validation rule definition
 */
export interface ValidationRule<T = any> {
    /** Rule name/identifier */
    name: string;

    /** Validation function */
    validator: (value: T, context?: Record<string, any>) => boolean | Promise<boolean>;

    /** Error message if validation fails */
    message: string;

    /** Rule parameters */
    params?: Record<string, any>;

    /** Whether rule is required (stops validation chain if fails) */
    required?: boolean;
}

/**
 * Field validation configuration
 */
export interface FieldValidation<T = any> {
    /** Field name */
    field: keyof T;

    /** Validation rules */
    rules: ValidationRule[];

    /** Whether field is required */
    required?: boolean;

    /** Custom validation message */
    customMessage?: string;
}

/**
 * Form validation configuration
 */
export interface FormValidationConfig<T = any> {
    /** Field validations */
    fields: FieldValidation<T>[];

    /** Form-level validation rules */
    formRules?: ValidationRule<T>[];

    /** Validation mode */
    mode: ValidationMode;

    /** Whether to validate on change */
    validateOnChange?: boolean;

    /** Whether to validate on blur */
    validateOnBlur?: boolean;

    /** Debounce delay for validation */
    debounceMs?: number;
}

/**
 * Validation modes
 */
export enum ValidationMode {
    /** Validate all fields always */
    ALWAYS = 'ALWAYS',

    /** Validate only touched fields */
    ON_TOUCH = 'ON_TOUCH',

    /** Validate only on form submission */
    ON_SUBMIT = 'ON_SUBMIT'
}

/**
 * File upload validation
 */
export interface FileValidation {
    /** Maximum file size in bytes */
    maxSize: number;

    /** Allowed file types */
    allowedTypes: string[];

    /** Allowed file extensions */
    allowedExtensions: string[];

    /** Maximum number of files */
    maxFiles?: number;

    /** Custom validation function */
    customValidator?: (file: File) => boolean | string;
}

/**
 * Progress tracking for long operations
 */
export interface ProgressTracker {
    /** Current progress (0-100) */
    progress: number;

    /** Current step description */
    currentStep: string;

    /** Total steps */
    totalSteps?: number;

    /** Current step number */
    currentStepNumber?: number;

    /** Estimated time remaining (ms) */
    estimatedTimeRemaining?: number;

    /** Start time */
    startTime: Date;

    /** Whether operation can be cancelled */
    cancellable: boolean;

    /** Cancel function */
    cancel?: () => void;

    /** Pause function */
    pause?: () => void;

    /** Resume function */
    resume?: () => void;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
    /** Maximum retry attempts */
    maxAttempts: number;

    /** Delay between retries (ms) */
    delay: number;

    /** Whether to use exponential backoff */
    exponentialBackoff?: boolean;

    /** Backoff multiplier */
    backoffMultiplier?: number;

    /** Maximum delay (ms) */
    maxDelay?: number;

    /** Conditions when to retry */
    retryConditions?: Array<(error: any) => boolean>;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Cache key */
    key: string;

    /** Cache TTL in ms */
    ttl: number;

    /** Whether to cache errors */
    cacheErrors?: boolean;

    /** Cache invalidation strategy */
    invalidation?: 'time' | 'manual' | 'dependency';

    /** Dependency keys for cache invalidation */
    dependencies?: string[];
}

/**
 * Event data structure
 */
export interface AppEvent<T = any> {
    /** Event type */
    type: string;

    /** Event data payload */
    data: T;

    /** Event timestamp */
    timestamp: Date;

    /** Event source */
    source?: string;

    /** Event metadata */
    metadata?: Record<string, any>;
}

/**
 * Utility type for making specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making specific properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type for deep partial (all nested properties optional)
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Record<string, any> ? DeepPartial<T[P]> : T[P];
};

/**
 * Utility type for deep required (all nested properties required)
 */
export type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends Record<string, any> ? DeepRequired<T[P]> : T[P];
};

/**
 * Extract keys of specific type from object
 */
export type KeysOfType<T, U> = {
    [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Create a type with only specific value types
 */
export type PickByType<T, U> = Pick<T, KeysOfType<T, U>>;

/**
 * Exclude keys of specific type from object
 */
export type OmitByType<T, U> = Omit<T, KeysOfType<T, U>>;

/**
 * Make all properties of T nullable
 */
export type Nullable<T> = {
    [P in keyof T]: T[P] | null;
};

/**
 * Remove null from all properties of T
 */
export type NonNullable<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Function type with typed parameters and return
 */
export type TypedFunction<TParams extends any[] = any[], TReturn = any> = (...args: TParams) => TReturn;

/**
 * Async function type
 */
export type AsyncFunction<TParams extends any[] = any[], TReturn = any> = (...args: TParams) => Promise<TReturn>;

/**
 * Event handler function type
 */
export type EventHandler<TEvent = any> = (event: TEvent) => void;

/**
 * Predicate function type
 */
export type Predicate<T> = (item: T) => boolean;

/**
 * Comparator function type for sorting
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Mapper function type
 */
export type Mapper<TInput, TOutput> = (input: TInput) => TOutput;

/**
 * Reducer function type
 */
export type Reducer<TState, TAction> = (state: TState, action: TAction) => TState;