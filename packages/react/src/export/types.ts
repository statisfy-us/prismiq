/**
 * Types for export functionality.
 */

import type { QueryResult } from '../types';

/**
 * Options for CSV export.
 */
export interface ExportOptions {
  /** Custom filename (without extension) */
  filename?: string;
  /** Subset of columns to export (defaults to all) */
  columns?: string[];
  /** Custom column header names */
  headers?: Record<string, string>;
  /** Date format string (default: ISO) */
  dateFormat?: string;
  /** Number format options */
  numberFormat?: Intl.NumberFormatOptions;
}

/**
 * Options for Excel export.
 */
export interface ExcelExportOptions extends ExportOptions {
  /** Sheet name (default: "Sheet1") */
  sheetName?: string;
  /** Column width overrides */
  columnWidths?: Record<string, number>;
  /** Freeze the header row */
  freezeHeader?: boolean;
  /** Header cell style */
  headerStyle?: ExcelCellStyle;
  /** Data cell style */
  dataStyle?: ExcelCellStyle;
}

/**
 * Excel cell style options.
 */
export interface ExcelCellStyle {
  /** Bold text */
  bold?: boolean;
  /** Background color (hex) */
  fill?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Data that can be exported (QueryResult or array of objects).
 */
export type ExportData = QueryResult | Record<string, unknown>[];
