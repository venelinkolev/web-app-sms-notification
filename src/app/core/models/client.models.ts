/**
 * Main client record structure for JSON data import
 * Corresponds to the contract expiry notification system requirements
 */
export interface ClientRecord {
    /** Client record number/identifier */
    Number: string;

    /** Contract end date in format dd/mm/yy HH:mm:ss */
    End_Data: string;

    /** Equipment model */
    Model: string;

    /** EKA equipment number */
    Number_EKA: string;

    /** Object/site name */
    Ime_Obekt: string;

    /** Object/site address */
    Adres_Obekt: string;

    /** Tax number */
    Dan_Number: string;

    /** Contact phone number */
    Phone: string;

    /** Company name */
    Ime_Firma: string;

    /** Bulgarian tax identifier */
    bulst: string;
}

/**
 * Parsed client record with additional computed fields
 */
export interface ParsedClientRecord extends ClientRecord {
    /** Parsed end date as Date object */
    parsedEndDate?: Date;

    /** Formatted phone number in international format */
    formattedPhone?: string;

    /** Record validation status */
    isValid: boolean;

    /** Validation errors if any */
    validationErrors?: string[];

    /** Record selection state for UI */
    selected?: boolean;

    /** Unique identifier for UI operations */
    id: string;
}

/**
 * Client data import result
 */
export interface ClientDataImport {
    /** Successfully parsed records */
    validRecords: ParsedClientRecord[];

    /** Records with validation errors */
    invalidRecords: Array<{
        record: Partial<ClientRecord>;
        errors: string[];
        lineNumber?: number;
    }>;

    /** Import statistics */
    stats: {
        totalRecords: number;
        validRecords: number;
        invalidRecords: number;
        duplicateRecords: number;
    };

    /** Import timestamp */
    importedAt: Date;

    /** Source file information */
    fileInfo: {
        name: string;
        size: number;
        type: string;
    };
}

/**
 * Client record validation result
 */
export interface ValidationResult {
    /** Whether the record is valid */
    isValid: boolean;

    /** List of validation errors */
    errors: ValidationError[];

    /** List of validation warnings */
    warnings: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
    /** Field name that failed validation */
    field: keyof ClientRecord;

    /** Error message */
    message: string;

    /** Error type/code */
    code: ValidationErrorCode;

    /** Current field value */
    value: any;
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
    REQUIRED = 'REQUIRED',
    INVALID_FORMAT = 'INVALID_FORMAT',
    INVALID_DATE = 'INVALID_DATE',
    INVALID_PHONE = 'INVALID_PHONE',
    TOO_LONG = 'TOO_LONG',
    TOO_SHORT = 'TOO_SHORT',
    DUPLICATE = 'DUPLICATE'
}

/**
 * Client selection state for bulk operations
 */
export interface ClientSelection {
    /** Selected client IDs */
    selectedIds: Set<string>;

    /** All available client IDs */
    allIds: string[];

    /** Whether all clients are selected */
    allSelected: boolean;

    /** Whether some (but not all) clients are selected */
    indeterminate: boolean;

    /** Number of selected clients */
    selectedCount: number;

    /** Total number of clients */
    totalCount: number;
}

/**
 * Client data filtering options
 */
export interface ClientFilter {
    /** Text search across all fields */
    searchText?: string;

    /** Filter by company name */
    companyName?: string;

    /** Filter by phone number */
    phoneNumber?: string;

    /** Filter by contract end date range */
    endDateRange?: {
        from: Date;
        to: Date;
    };

    /** Filter by validation status */
    validationStatus?: 'valid' | 'invalid' | 'all';

    /** Filter by selection status */
    selectionStatus?: 'selected' | 'unselected' | 'all';
}

/**
 * Client data sorting options
 */
export interface ClientSort {
    /** Field to sort by */
    field: keyof ClientRecord | 'parsedEndDate';

    /** Sort direction */
    direction: 'asc' | 'desc';
}

/**
 * Paginated client data result
 */
export interface PaginatedClientData {
    /** Client records for current page */
    records: ParsedClientRecord[];

    /** Current page number (0-based) */
    page: number;

    /** Items per page */
    pageSize: number;

    /** Total number of records */
    totalRecords: number;

    /** Total number of pages */
    totalPages: number;

    /** Whether there are more pages */
    hasNextPage: boolean;

    /** Whether there are previous pages */
    hasPreviousPage: boolean;
}