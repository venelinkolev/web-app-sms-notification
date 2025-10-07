import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import {
    ParsedClientRecord,
    ClientDataImport,
    ClientSelection,
    ClientFilter,
    ClientSort,
    PaginatedClientData
} from '../models';

@Injectable({
    providedIn: 'root'
})
export class DataService {

    // Private state subjects
    private rawData$ = new BehaviorSubject<ParsedClientRecord[]>([]);
    private filters$ = new BehaviorSubject<ClientFilter>({});
    private sorting$ = new BehaviorSubject<ClientSort>({
        field: 'End_Data',
        direction: 'asc'
    });
    private selection$ = new BehaviorSubject<ClientSelection>({
        selectedIds: new Set<string>(),
        allIds: [],
        allSelected: false,
        indeterminate: false,
        selectedCount: 0,
        totalCount: 0
    });
    private pagination$ = new BehaviorSubject<{ page: number; pageSize: number }>({
        page: 0,
        pageSize: 50
    });

    // Public observables
    readonly rawData: Observable<ParsedClientRecord[]> = this.rawData$.asObservable();
    readonly filters: Observable<ClientFilter> = this.filters$.asObservable();
    readonly sorting: Observable<ClientSort> = this.sorting$.asObservable();
    readonly selection: Observable<ClientSelection> = this.selection$.asObservable();

    /**
     * Филтрирани и сортирани данни
     */
    readonly processedData: Observable<ParsedClientRecord[]> = combineLatest([
        this.rawData$,
        this.filters$,
        this.sorting$
    ]).pipe(
        map(([data, filters, sorting]) => {
            let result = [...data];

            // Apply filters
            result = this.applyFilters(result, filters);

            // Apply sorting
            result = this.applySorting(result, sorting);

            return result;
        }),
        distinctUntilChanged()
    );

    /**
     * Paginирани данни
     */
    readonly paginatedData: Observable<PaginatedClientData> = combineLatest([
        this.processedData,
        this.pagination$
    ]).pipe(
        map(([data, pagination]) => this.paginateData(data, pagination.page, pagination.pageSize))
    );

    /**
     * Зареждане на данни от импорт
     */
    loadData(importData: ClientDataImport): void {
        const records = importData.validRecords.map(record => ({
            ...record,
            selected: false
        }));

        this.rawData$.next(records);

        // Reset selection
        this.selection$.next({
            selectedIds: new Set<string>(),
            allIds: records.map(r => r.id),
            allSelected: false,
            indeterminate: false,
            selectedCount: 0,
            totalCount: records.length
        });

        // Reset pagination
        this.pagination$.next({ page: 0, pageSize: 50 });
    }

    /**
     * Получаване на всички данни
     */
    getAllData(): ParsedClientRecord[] {
        return this.rawData$.value;
    }

    /**
     * Получаване на избраните записи
     */
    getSelectedRecords(): ParsedClientRecord[] {
        const data = this.rawData$.value;
        const selectedIds = this.selection$.value.selectedIds;
        return data.filter(record => selectedIds.has(record.id));
    }

    /**
     * Toggle selection на един запис
     */
    toggleSelection(recordId: string): void {
        const currentSelection = this.selection$.value;
        const newSelectedIds = new Set(currentSelection.selectedIds);

        if (newSelectedIds.has(recordId)) {
            newSelectedIds.delete(recordId);
        } else {
            newSelectedIds.add(recordId);
        }

        this.updateSelection(newSelectedIds);
    }

    /**
     * Select all записи
     */
    selectAll(): void {
        const allIds = this.rawData$.value.map(r => r.id);
        this.updateSelection(new Set(allIds));
    }

    /**
     * Deselect all записи
     */
    deselectAll(): void {
        this.updateSelection(new Set());
    }

    /**
     * Select записи от текущата страница
     */
    selectPage(pageRecords: ParsedClientRecord[]): void {
        const currentSelection = this.selection$.value;
        const newSelectedIds = new Set(currentSelection.selectedIds);

        pageRecords.forEach(record => {
            newSelectedIds.add(record.id);
        });

        this.updateSelection(newSelectedIds);
    }

    /**
     * Deselect записи от текущата страница
     */
    deselectPage(pageRecords: ParsedClientRecord[]): void {
        const currentSelection = this.selection$.value;
        const newSelectedIds = new Set(currentSelection.selectedIds);

        pageRecords.forEach(record => {
            newSelectedIds.delete(record.id);
        });

        this.updateSelection(newSelectedIds);
    }

    /**
     * Обновяване на selection state
     */
    private updateSelection(selectedIds: Set<string>): void {
        const allIds = this.rawData$.value.map(r => r.id);
        const selectedCount = selectedIds.size;
        const totalCount = allIds.length;

        this.selection$.next({
            selectedIds,
            allIds,
            allSelected: selectedCount === totalCount && totalCount > 0,
            indeterminate: selectedCount > 0 && selectedCount < totalCount,
            selectedCount,
            totalCount
        });

        // Update selected flag in records
        const updatedData = this.rawData$.value.map(record => ({
            ...record,
            selected: selectedIds.has(record.id)
        }));
        this.rawData$.next(updatedData);
    }

    /**
     * Set filters
     */
    setFilters(filters: ClientFilter): void {
        this.filters$.next(filters);
        // Reset to first page when filters change
        this.pagination$.next({ ...this.pagination$.value, page: 0 });
    }

    /**
     * Update filter field
     */
    updateFilter<K extends keyof ClientFilter>(field: K, value: ClientFilter[K]): void {
        const currentFilters = this.filters$.value;
        this.setFilters({ ...currentFilters, [field]: value });
    }

    /**
     * Clear filters
     */
    clearFilters(): void {
        this.filters$.next({});
    }

    /**
     * Set sorting
     */
    setSorting(sorting: ClientSort): void {
        this.sorting$.next(sorting);
    }

    /**
     * Toggle sort direction
     */
    toggleSortDirection(): void {
        const current = this.sorting$.value;
        this.sorting$.next({
            ...current,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
        });
    }

    /**
     * Set pagination
     */
    setPagination(page: number, pageSize: number): void {
        this.pagination$.next({ page, pageSize });
    }

    /**
     * Go to page
     */
    goToPage(page: number): void {
        this.pagination$.next({ ...this.pagination$.value, page });
    }

    /**
     * Set page size
     */
    setPageSize(pageSize: number): void {
        this.pagination$.next({ page: 0, pageSize });
    }

    /**
     * Apply filters to data
     */
    private applyFilters(data: ParsedClientRecord[], filters: ClientFilter): ParsedClientRecord[] {
        let result = [...data];

        // Text search
        if (filters.searchText && filters.searchText.trim()) {
            const searchLower = filters.searchText.toLowerCase();
            result = result.filter(record =>
                record.Number.toLowerCase().includes(searchLower) ||
                record.Ime_Firma.toLowerCase().includes(searchLower) ||
                record.Phone.toLowerCase().includes(searchLower) ||
                record.Model.toLowerCase().includes(searchLower) ||
                (record.Ime_Obekt?.toLowerCase().includes(searchLower)) ||
                (record.Adres_Obekt?.toLowerCase().includes(searchLower))
            );
        }

        // Company name filter
        if (filters.companyName && filters.companyName.trim()) {
            const companyLower = filters.companyName.toLowerCase();
            result = result.filter(record =>
                record.Ime_Firma.toLowerCase().includes(companyLower)
            );
        }

        // Phone number filter
        if (filters.phoneNumber && filters.phoneNumber.trim()) {
            const phoneLower = filters.phoneNumber.toLowerCase();
            result = result.filter(record =>
                record.Phone.toLowerCase().includes(phoneLower) ||
                record.formattedPhone?.toLowerCase().includes(phoneLower)
            );
        }

        // Date range filter
        if (filters.endDateRange) {
            result = result.filter(record => {
                if (!record.parsedEndDate) return false;
                return record.parsedEndDate >= filters.endDateRange!.from &&
                    record.parsedEndDate <= filters.endDateRange!.to;
            });
        }

        // Validation status filter
        if (filters.validationStatus && filters.validationStatus !== 'all') {
            const isValid = filters.validationStatus === 'valid';
            result = result.filter(record => record.isValid === isValid);
        }

        // Selection status filter
        if (filters.selectionStatus && filters.selectionStatus !== 'all') {
            const isSelected = filters.selectionStatus === 'selected';
            result = result.filter(record => record.selected === isSelected);
        }

        return result;
    }

    /**
     * Apply sorting to data
     */
    private applySorting(data: ParsedClientRecord[], sorting: ClientSort): ParsedClientRecord[] {
        const result = [...data];
        const direction = sorting.direction === 'asc' ? 1 : -1;

        result.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sorting.field === 'parsedEndDate') {
                aValue = a.parsedEndDate?.getTime() || 0;
                bValue = b.parsedEndDate?.getTime() || 0;
            } else {
                aValue = a[sorting.field] || '';
                bValue = b[sorting.field] || '';
            }

            if (typeof aValue === 'string') {
                return aValue.localeCompare(bValue) * direction;
            }

            return (aValue - bValue) * direction;
        });

        return result;
    }

    /**
     * Paginate data
     */
    private paginateData(
        data: ParsedClientRecord[],
        page: number,
        pageSize: number
    ): PaginatedClientData {
        const totalRecords = data.length;
        const totalPages = Math.ceil(totalRecords / pageSize);
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const records = data.slice(startIndex, endIndex);

        return {
            records,
            page,
            pageSize,
            totalRecords,
            totalPages,
            hasNextPage: page < totalPages - 1,
            hasPreviousPage: page > 0
        };
    }

    /**
     * Get current pagination info
     */
    getPaginationInfo(): Observable<{ page: number; pageSize: number }> {
        return this.pagination$.asObservable();
    }

    /**
     * Reset service (clear all data)
     */
    reset(): void {
        this.rawData$.next([]);
        this.filters$.next({});
        this.sorting$.next({ field: 'End_Data', direction: 'asc' });
        this.selection$.next({
            selectedIds: new Set<string>(),
            allIds: [],
            allSelected: false,
            indeterminate: false,
            selectedCount: 0,
            totalCount: 0
        });
        this.pagination$.next({ page: 0, pageSize: 50 });
    }

    /**
     * Get statistics
     */
    getStatistics(): Observable<{
        total: number;
        selected: number;
        filtered: number;
        valid: number;
        invalid: number;
    }> {
        return combineLatest([
            this.rawData$,
            this.processedData,
            this.selection$
        ]).pipe(
            map(([raw, processed, selection]) => ({
                total: raw.length,
                selected: selection.selectedCount,
                filtered: processed.length,
                valid: raw.filter(r => r.isValid).length,
                invalid: raw.filter(r => !r.isValid).length
            }))
        );
    }
}