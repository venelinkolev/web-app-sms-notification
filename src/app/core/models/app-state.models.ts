import { ClientRecord, ParsedClientRecord, ClientSelection, ClientFilter, ClientSort } from './client.models';
import { SMSTemplate, BatchSMSProgress, SMSOperationResult } from './sms.models';

/**
 * Main application state
 */
export interface AppState {
    /** Client data state */
    clientData: ClientDataState;

    /** SMS operations state */
    smsOperations: SMSOperationsState;

    /** UI state */
    ui: UIState;

    /** User preferences */
    preferences: UserPreferences;

    /** Application metadata */
    metadata: AppMetadata;
}

/**
 * Client data management state
 */
export interface ClientDataState {
    /** Current loaded data */
    data: {
        /** Raw imported records */
        rawRecords: ClientRecord[];

        /** Parsed and validated records */
        parsedRecords: ParsedClientRecord[];

        /** Currently displayed records (after filtering/sorting) */
        displayedRecords: ParsedClientRecord[];

        /** Import information */
        importInfo: {
            fileName?: string;
            importDate?: Date;
            totalRecords: number;
            validRecords: number;
            invalidRecords: number;
        } | null;
    };

    /** Selection management */
    selection: ClientSelection;

    /** Filtering state */
    filters: ClientFilter;

    /** Sorting state */
    sorting: ClientSort;

    /** Pagination state */
    pagination: {
        currentPage: number;
        pageSize: number;
        totalRecords: number;
        totalPages: number;
    };

    /** Data loading states */
    loading: {
        importing: boolean;
        validating: boolean;
        filtering: boolean;
    };

    /** Error states */
    errors: {
        importError?: string;
        validationError?: string;
        filterError?: string;
    };
}

/**
 * SMS operations state
 */
export interface SMSOperationsState {
    /** Available SMS templates */
    templates: {
        available: SMSTemplate[];
        current?: SMSTemplate;
        editing?: SMSTemplate;
    };

    /** Current batch operation */
    currentBatch: {
        progress?: BatchSMSProgress;
        result?: SMSOperationResult;
        isActive: boolean;
    };

    /** Operation history */
    history: Array<{
        batchId: string;
        timestamp: Date;
        clientCount: number;
        successCount: number;
        failCount: number;
        template: string;
    }>;

    /** SMS previews for selected clients */
    previews: Array<{
        clientId: string;
        content: string;
        characterCount: number;
        estimatedCost: number;
        isValid: boolean;
    }>;

    /** Operation states */
    states: {
        generatingPreviews: boolean;
        sending: boolean;
        paused: boolean;
    };

    /** SMS operation errors */
    errors: {
        templateError?: string;
        previewError?: string;
        sendError?: string;
    };
}

/**
 * UI state management
 */
export interface UIState {
    /** Current active view */
    currentView: AppView;

    /** Modal states */
    modals: {
        confirmDialog?: {
            title: string;
            message: string;
            confirmText: string;
            cancelText: string;
            onConfirm: () => void;
            onCancel: () => void;
        };

        templateEditor?: {
            isOpen: boolean;
            template: SMSTemplate;
            isNew: boolean;
        };

        progressDialog?: {
            isOpen: boolean;
            title: string;
            progress: number;
            canCancel: boolean;
        };
    };

    /** Notification states */
    notifications: NotificationState[];

    /** Loading states for UI components */
    loading: {
        [key: string]: boolean;
    };

    /** Form states */
    forms: {
        fileUpload: {
            isDragging: boolean;
            isProcessing: boolean;
            error?: string;
        };

        templateEditor: {
            hasChanges: boolean;
            isValid: boolean;
            errors: string[];
        };
    };

    /** Layout preferences */
    layout: {
        sidebarCollapsed: boolean;
        tableView: 'compact' | 'comfortable' | 'spacious';
        theme: 'light' | 'dark' | 'auto';
    };
}

/**
 * User preferences and settings
 */
export interface UserPreferences {
    /** SMS sending preferences */
    sms: {
        defaultSender: string;
        confirmBeforeSend: boolean;
        maxBatchSize: number;
        retryFailedMessages: boolean;
    };

    /** UI preferences */
    ui: {
        theme: 'light' | 'dark' | 'auto';
        language: 'bg' | 'en';
        dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
        timeFormat: '12h' | '24h';
        animations: boolean;
    };

    /** Table preferences */
    table: {
        defaultPageSize: number;
        defaultSortField: string;
        defaultSortDirection: 'asc' | 'desc';
        visibleColumns: string[];
    };

    /** Notification preferences */
    notifications: {
        showSuccessToasts: boolean;
        showWarningToasts: boolean;
        showErrorToasts: boolean;
        autoHideDelay: number;
    };
}

/**
 * Application metadata
 */
export interface AppMetadata {
    /** Current app version */
    version: string;

    /** Last session information */
    lastSession: {
        timestamp: Date;
        duration: number;
        actionsPerformed: number;
    };

    /** Usage statistics */
    usage: {
        totalSMSSent: number;
        totalClientsProcessed: number;
        totalSessions: number;
        averageSessionDuration: number;
    };

    /** Error tracking */
    errorLog: Array<{
        timestamp: Date;
        error: string;
        context: string;
        resolved: boolean;
    }>;
}

/**
 * Application views/pages
 */
export enum AppView {
    FILE_UPLOAD = 'FILE_UPLOAD',
    DATA_TABLE = 'DATA_TABLE',
    SMS_PREVIEW = 'SMS_PREVIEW',
    SEND_PROGRESS = 'SEND_PROGRESS',
    RESULTS = 'RESULTS',
    SETTINGS = 'SETTINGS'
}

/**
 * Notification state
 */
export interface NotificationState {
    /** Unique notification ID */
    id: string;

    /** Notification type */
    type: NotificationType;

    /** Title text */
    title: string;

    /** Message content */
    message: string;

    /** Auto-hide timeout (0 = never hide) */
    timeout: number;

    /** Whether notification can be dismissed */
    dismissible: boolean;

    /** Action buttons */
    actions?: Array<{
        label: string;
        handler: () => void;
        style?: 'primary' | 'secondary' | 'danger';
    }>;

    /** Creation timestamp */
    timestamp: Date;

    /** Whether notification is visible */
    visible: boolean;
}

/**
 * Notification types
 */
export enum NotificationType {
    SUCCESS = 'SUCCESS',
    INFO = 'INFO',
    WARNING = 'WARNING',
    ERROR = 'ERROR'
}

/**
 * Global error state
 */
export interface ErrorState {
    /** Error details */
    error: Error | string | null;

    /** Error context/location */
    context?: string;

    /** Error timestamp */
    timestamp?: Date;

    /** Whether error is recoverable */
    recoverable: boolean;

    /** Recovery actions */
    recoveryActions?: Array<{
        label: string;
        handler: () => void;
    }>;

    /** Error ID for tracking */
    errorId?: string;
}

/**
 * Loading state with context
 */
export interface LoadingState {
    /** Whether currently loading */
    isLoading: boolean;

    /** Loading message */
    message?: string;

    /** Progress percentage (0-100) */
    progress?: number;

    /** Whether operation can be cancelled */
    cancellable?: boolean;

    /** Cancel handler */
    onCancel?: () => void;
}

/**
 * Form validation state
 */
export interface FormValidationState {
    /** Whether form is valid */
    isValid: boolean;

    /** Field-level errors */
    fieldErrors: Record<string, string[]>;

    /** Form-level errors */
    formErrors: string[];

    /** Validation touched state */
    touched: Record<string, boolean>;

    /** Whether validation is in progress */
    isValidating: boolean;
}