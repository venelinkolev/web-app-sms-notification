// src/app/features/client-list/client-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { DataService } from '../../core/services/data.service';
import {
    ParsedClientRecord,
    PaginatedClientData,
    ClientSelection,
    ClientSort
} from '../../core/models';

@Component({
    selector: 'app-client-list',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.scss',
})
export class ClientListComponent implements OnInit, OnDestroy {

    // Data
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

    // Math object for template
    Math = Math;

    private destroy$ = new Subject<void>();

    constructor(private dataService: DataService) { }

    ngOnInit(): void {
        // Subscribe to paginated data
        this.dataService.paginatedData
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.paginatedData = data;
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
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Toggle selection на един запис
     */
    toggleSelection(recordId: string): void {
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
        this.dataService.setPageSize(this.pageSize);
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
     * Send SMS (placeholder)
     */
    onSendSMS(): void {
        const selected = this.dataService.getSelectedRecords();
        console.log('Sending SMS to:', selected);
        alert(`Готово за SMS изпращане към ${selected.length} клиента! (Функционалност в следваща под-задача)`);
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
}