/**
 * Utilities for parsing column references in "tableId.column" format.
 */

/**
 * Parsed column reference with table ID and column name.
 */
export interface ColumnReference {
  tableId: string;
  column: string;
}

/**
 * Parse a column reference in "tableId.column" format.
 *
 * @param ref - The column reference string (e.g., "t1.created_at")
 * @param defaultTableId - Table ID to use when ref has no table prefix
 * @returns Parsed reference, or null if invalid. Logs a warning only for
 *          malformed references (e.g., "table." or ".column" or "a.b.c").
 *          Empty/whitespace inputs return null without warning.
 */
export function parseColumnRef(
  ref: string,
  defaultTableId: string
): ColumnReference | null {
  if (!ref || ref.trim() === '') {
    return null;
  }

  if (!ref.includes('.')) {
    // Simple column name without table prefix - use default table
    // for backward compatibility with single-table queries
    return { tableId: defaultTableId, column: ref };
  }

  const parts = ref.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.warn(`Invalid column reference format: "${ref}". Expected "tableId.column"`);
    return null;
  }

  return { tableId: parts[0], column: parts[1] };
}
