import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, map } from 'rxjs';
import { CdkTableModule } from '@angular/cdk/table';
import { DataSource } from '@angular/cdk/collections';
import { Observable } from 'rxjs';

import { DataService } from '../../core/services/data.service';
import {
    ParsedClientRecord,
    PaginatedClientData,
    ClientSelection,
    ClientSort
} from '../../core/models';
import { NotificationService } from '../../core/services';

@Component({
    selector: 'app-client-list',
    standalone: true,
    imports: [CommonModule, FormsModule, CdkTableModule],
    templateUrl: './client-list.component.html',
    styleUrls: ['./client-list.component.scss']
})
export class ClientListComponent implements OnInit, OnDestroy {

    // Table columns
    displayedColumns: string[] = [
        'select',
        'Number',
        'Ime_Firma',
        'Phone',
        'Model',
        'End_Data',
        'Ime_Obekt'
    ];

    // Data
    dataSource: ClientDataSource;
    paginatedData: PaginatedClientData = {
        records: [],
        page: 0,
        pageSize: 50,
        totalRecords: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
    };

    selection: ClientSelection = {
        selectedIds: new Set(),
        allIds: [],
        allSelected: false,
        indeterminate: false,
        selectedCount: 0,
        totalCount: 0
    };

    sorting: ClientSort = {
        field: 'End_Data',
        direction: 'asc'
    };

    statistics = {
        total: 0,
        selected: 0,
        filtered: 0,
        valid: 0,
        invalid: 0
    };

    // Filter form values
    searchText = '';
    companyFilter = '';
    phoneFilter = '';
    pageSize = 50;
    currentPage = 0;

    // Math object for template
    Math = Math;

    private destroy$ = new Subject<void>();

    // Phone selection statistics
    phoneStats$ = this.dataService.getPhoneSelectionStats();

    constructor(private dataService: DataService, private notificationService: NotificationService) {
        this.dataSource = new ClientDataSource(this.dataService);
    }

    ngOnInit(): void {
        // Subscribe to paginated data
        this.dataService.paginatedData
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.paginatedData = data;
                this.currentPage = data.page;
            });

        // Subscribe to selection
        this.dataService.selection
            .pipe(takeUntil(this.destroy$))
            .subscribe(selection => {
                this.selection = selection;
            });

        // Subscribe to sorting
        this.dataService.sorting
            .pipe(takeUntil(this.destroy$))
            .subscribe(sorting => {
                this.sorting = sorting;
            });

        // Subscribe to statistics
        this.dataService.getStatistics()
            .pipe(takeUntil(this.destroy$))
            .subscribe(stats => {
                this.statistics = stats;
            });

        // Subscribe to pagination info
        this.dataService.getPaginationInfo()
            .pipe(takeUntil(this.destroy$))
            .subscribe(info => {
                this.pageSize = info.pageSize;
                this.currentPage = info.page;
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.dataSource.disconnect();
    }

    /**
     * Toggle selection на един запис
     */
    toggleSelection(recordId: string, event?: Event): void {
        if (event) {
            event.stopPropagation();
        }
        this.dataService.toggleSelection(recordId);
    }

    /**
     * Toggle select all
     */
    toggleSelectAll(): void {
        if (this.selection.allSelected || this.selection.indeterminate) {
            this.dataService.deselectAll();
        } else {
            this.dataService.selectAll();
        }
    }

    /**
     * Deselect all
     */
    deselectAll(): void {
        this.dataService.deselectAll();
    }

    /**
     * Row click handler
     */
    onRowClick(record: ParsedClientRecord): void {
        this.toggleSelection(record.id);
    }

    /**
     * Sort by field
     */
    sortBy(field: ClientSort['field']): void {
        if (this.sorting.field === field) {
            this.dataService.toggleSortDirection();
        } else {
            this.dataService.setSorting({ field, direction: 'asc' });
        }
    }

    /**
     * Check if column is sortable
     */
    isSortable(column: string): boolean {
        return ['Number', 'Ime_Firma', 'End_Data'].includes(column);
    }

    /**
     * Get sort icon
     */
    getSortIcon(column: string): string {
        if (this.sorting.field === column ||
            (column === 'End_Data' && this.sorting.field === 'parsedEndDate')) {
            return this.sorting.direction === 'asc' ? '↑' : '↓';
        }
        return '';
    }

    /**
     * Search change
     */
    onSearchChange(): void {
        this.dataService.updateFilter('searchText', this.searchText);
    }

    /**
     * Company filter change
     */
    onCompanyFilterChange(): void {
        this.dataService.updateFilter('companyName', this.companyFilter);
    }

    /**
     * Phone filter change
     */
    onPhoneFilterChange(): void {
        this.dataService.updateFilter('phoneNumber', this.phoneFilter);
    }

    /**
     * Clear filters
     */
    clearFilters(): void {
        this.searchText = '';
        this.companyFilter = '';
        this.phoneFilter = '';
        this.dataService.clearFilters();
    }

    /**
     * Page size change
     */
    onPageSizeChange(): void {
        this.dataService.setPageSize(Number(this.pageSize));
    }

    /**
     * Go to specific page
     */
    goToPage(page: number): void {
        if (page >= 0 && page < this.paginatedData.totalPages) {
            this.dataService.goToPage(page);
        }
    }

    /**
     * Next page
     */
    nextPage(): void {
        if (this.paginatedData.hasNextPage) {
            this.dataService.goToPage(this.paginatedData.page + 1);
        }
    }

    /**
     * Previous page
     */
    previousPage(): void {
        if (this.paginatedData.hasPreviousPage) {
            this.dataService.goToPage(this.paginatedData.page - 1);
        }
    }

    /**
     * First page
     */
    firstPage(): void {
        this.dataService.goToPage(0);
    }

    /**
     * Last page
     */
    lastPage(): void {
        this.dataService.goToPage(this.paginatedData.totalPages - 1);
    }

    /**
     * Send SMS - Navigate to SMS Preview
     */
    onSendSMS(): void {
        // Валидация на phone selections
        const validation = this.dataService.validatePhoneSelections();

        if (!validation.isValid) {
            // Show error notification with all errors
            const errorMessage = validation.errors.join('\n\n');

            this.notificationService.error(
                '⚠️ Изберете телефони за SMS',
                errorMessage
            );

            // Log errors за debugging
            console.error('Phone selection validation errors:', validation.errors);
            return;
        }

        // Get selected records
        const selected = this.dataService.getSelectedRecords();
        const totalPhones = selected.reduce((sum, r) => sum + r.selectedPhoneCount, 0);

        console.log('Selected records for SMS:', selected);

        // Show info notification
        this.notificationService.info(
            '📨 Готово за изпращане',
            `${selected.length} клиента (${totalPhones} телефона) избрани. Scroll надолу към SMS Preview секцията.`
        );

        // Scroll to SMS Preview section
        setTimeout(() => {
            const smsPreviewSection = document.querySelector('.sms-preview-section');
            if (smsPreviewSection) {
                smsPreviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    /**
     * Format date
     */
    formatDate(date: Date | undefined): string {
        if (!date) return '-';
        return new Intl.DateTimeFormat('bg-BG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    }

    /**
     * Track by function for ngFor
     */
    trackByRecordId(index: number, record: ParsedClientRecord): string {
        return record.id;
    }

    /**
 * Toggle phone selection
 */
    onPhoneToggle(recordId: string, phoneId: string, event: Event): void {
        event.stopPropagation();
        this.dataService.togglePhoneSelection(recordId, phoneId);
    }

    /**
 * Select all phones for record
 */
    selectAllPhones(recordId: string, event: Event): void {
        event.stopPropagation();
        this.dataService.selectAllPhonesForRecord(recordId);
    }

    /**
 * Deselect all phones for record
 */
    deselectAllPhones(recordId: string, event: Event): void {
        event.stopPropagation();
        this.dataService.deselectAllPhonesForRecord(recordId);
    }

    /**
 * Log phone selection details (за debugging)
 */
    logPhoneSelectionDetails(): void {
        const selected = this.dataService.getSelectedRecords();

        console.group('📱 Phone Selection Details');
        console.log('Total selected records:', selected.length);

        selected.forEach(record => {
            console.group(`Record: ${record.Number} - ${record.Ime_Firma}`);
            console.log('Has multiple phones:', record.hasMultiplePhones);
            console.log('Selected phone count:', record.selectedPhoneCount);
            console.log('Requires selection:', record.requiresPhoneSelection);

            record.phoneNumbers.forEach(phone => {
                console.log(`  📞 ${phone.formatted} - Selected: ${phone.selected}, Valid: ${phone.isValid}`);
            });

            console.groupEnd();
        });

        console.groupEnd();
    }
}

/**
 * Custom DataSource for CDK Table
 */
class ClientDataSource extends DataSource<ParsedClientRecord> {
    private disconnect$ = new Subject<void>();

    constructor(private dataService: DataService) {
        super();
    }

    connect(): Observable<ParsedClientRecord[]> {
        return this.dataService.paginatedData.pipe(
            takeUntil(this.disconnect$),
            map(data => data.records)
        );
    }

    disconnect(): void {
        this.disconnect$.next();
        this.disconnect$.complete();
    }
}