/**
 * Main client record structure for JSON data import
 * Corresponds to the contract expiry notification system requirements
 */

/**
 * Individual phone number with selection state for SMS sending
 */
export interface PhoneNumber {
    /** Original phone format from JSON */
    original: string;

    /** Formatted international phone (+359...) */
    formatted: string;

    /** Whether this phone is selected for SMS sending */
    selected: boolean;

    /** Whether this phone is valid */
    isValid: boolean;

    /** Unique identifier for this phone in the record */
    id: string;
}

export interface ClientRecord {
    /** Client record number/identifier */
    Number: string;

    /** Contract end date in format mm/dd/yy HH:mm:ss (American format) */
    End_Data: string;

    /** Equipment model */
    Model: string;

    /** EKA equipment number */
    Number_EKA: string;

    /** Object/site name - OPTIONAL */
    Ime_Obekt?: string;

    /** Object/site address - OPTIONAL */
    Adres_Obekt?: string;

    /** Tax number - OPTIONAL */
    Dan_Number?: string;

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

    /** @deprecated Use phoneNumbers array instead - kept for backward compatibility */
    formattedPhone?: string;

    /** Array of parsed phone numbers (supports multiple phones per record) */
    phoneNumbers: PhoneNumber[];

    /** Whether this record has multiple phone numbers */
    hasMultiplePhones: boolean;

    /** Count of selected phones for SMS sending */
    selectedPhoneCount: number;

    /** Whether user must select phone before SMS (true if multiple phones and none selected) */
    requiresPhoneSelection: boolean;

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
    DUPLICATE = 'DUPLICATE',
    PHONE_SELECTION_REQUIRED = 'PHONE_SELECTION_REQUIRED',
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