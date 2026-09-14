/**
 * Apply dashboard filter values to a widget query.
 *
 * Shared between DashboardProvider (view mode) and DashboardEditor (edit mode)
 * so that dashboard-level filters are applied consistently to all widget queries.
 */

import type { Dashboard, FilterValue } from './types';
import type { FilterDefinition, QueryDefinition } from '../types';
import { resolveDatePreset } from './datePresets';

export function applyFiltersToQuery(
  query: QueryDefinition,
  dashboard: Dashboard,
  filterValues: FilterValue[],
  fiscalYearStartMonth = 1
): QueryDefinition {
  // Map filter values by filter ID
  const valueMap = new Map(
    filterValues.map((fv) => [fv.filter_id, fv.value])
  );

  // Build filter definitions from dashboard filters
  const additionalFilters: FilterDefinition[] = [];

  for (const filter of dashboard.filters) {
    const value = valueMap.get(filter.id);
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Find the table ID that matches this filter
    // If filter specifies a table and it exists in the query, use that table
    // Otherwise apply to first table - backend will validate if column exists
    let tableId = query.tables[0]?.id || 't1';
    if (filter.table) {
      const matchingTable = query.tables.find((t) => t.name === filter.table);
      if (matchingTable) {
        tableId = matchingTable.id;
      }
    }

    // Convert filter value to FilterDefinition based on filter type
    switch (filter.type) {
      case 'date_range': {
        const dateValue = value as
          | { start?: string; end?: string; preset?: string }
          | string;
        // A bare preset string, or { preset } from a filter's date_preset
        // default, resolves against the tenant's fiscal calendar.
        const range =
          typeof dateValue === 'string'
            ? resolveDatePreset(dateValue, fiscalYearStartMonth)
            : dateValue.preset && !dateValue.start && !dateValue.end
              ? resolveDatePreset(dateValue.preset, fiscalYearStartMonth)
              : dateValue.start && dateValue.end
                ? { start: dateValue.start, end: dateValue.end }
                : null;
        if (range) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'between',
            value: [range.start, range.end],
          });
        }
        break;
      }
      case 'select':
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') break;
        additionalFilters.push({
          table_id: tableId,
          column: filter.field,
          operator: 'eq',
          value,
        });
        break;
      case 'multi_select':
        if (Array.isArray(value) && value.length > 0) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'in_',
            value,
          });
        }
        break;
      case 'text':
        if (typeof value !== 'string' || value.trim() === '') break;
        additionalFilters.push({
          table_id: tableId,
          column: filter.field,
          operator: 'ilike',
          value: `%${value}%`,
        });
        break;
      case 'number_range': {
        if (typeof value !== 'object' || value === null) break;
        const rangeValue = value as { min: number | null; max: number | null };
        if (rangeValue.min !== null && rangeValue.max !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'between',
            value: [rangeValue.min, rangeValue.max],
          });
        } else if (rangeValue.min !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'gte',
            value: rangeValue.min,
          });
        } else if (rangeValue.max !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'lte',
            value: rangeValue.max,
          });
        }
        break;
      }
    }
  }

  // Merge with existing query filters
  return {
    ...query,
    filters: [...(query.filters || []), ...additionalFilters],
  };
}
