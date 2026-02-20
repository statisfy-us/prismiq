/**
 * SchemaExplorer component for browsing database tables and columns.
 */

import { useCallback, useState } from 'react';

import { useSchema } from '../../hooks';
import type { ColumnSchema, TableSchema } from '../../types';
import { Icon, Input } from '../ui';
import { TableNode } from './TableNode';

// ============================================================================
// Types
// ============================================================================

export interface SchemaExplorerProps {
  /** Callback when a table is selected. */
  onTableSelect?: (table: TableSchema) => void;
  /** Callback when a column is selected. */
  onColumnSelect?: (table: TableSchema, column: ColumnSchema) => void;
  /** Callback when column drag starts. */
  onColumnDragStart?: (table: TableSchema, column: ColumnSchema) => void;
  /** Currently selected table name. */
  selectedTable?: string;
  /** Array of selected column identifiers. */
  selectedColumns?: Array<{ table: string; column: string }>;
  /** Whether to show search input. */
  searchable?: boolean;
  /** Whether tables are collapsible. */
  collapsible?: boolean;
  /** Optional element rendered at the right end of the header row. */
  headerAction?: React.ReactNode;
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: 'var(--prismiq-color-background)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
};

const searchContainerStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm)',
  borderBottom: '1px solid var(--prismiq-color-border)',
};

const treeContainerStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const errorStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  color: 'var(--prismiq-color-error)',
  fontSize: 'var(--prismiq-font-size-sm)',
  textAlign: 'center',
};

const emptyStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  color: 'var(--prismiq-color-text-muted)',
  fontSize: 'var(--prismiq-font-size-sm)',
  textAlign: 'center',
};

// ============================================================================
// Skeleton Component
// ============================================================================

function LoadingSkeleton(): JSX.Element {
  return (
    <div style={{ padding: 'var(--prismiq-spacing-sm)' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--prismiq-spacing-sm)',
            padding: 'var(--prismiq-spacing-sm)',
            marginBottom: 'var(--prismiq-spacing-xs)',
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              backgroundColor: 'var(--prismiq-color-surface)',
              borderRadius: 'var(--prismiq-radius-sm)',
              animation: 'prismiq-pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              flex: 1,
              height: 14,
              backgroundColor: 'var(--prismiq-color-surface)',
              borderRadius: 'var(--prismiq-radius-sm)',
              animation: 'prismiq-pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Schema explorer component for browsing database structure.
 *
 * @example
 * ```tsx
 * <SchemaExplorer
 *   onTableSelect={(table) => console.log('Table:', table.name)}
 *   onColumnSelect={(table, column) => console.log('Column:', column.name)}
 *   searchable
 *   collapsible
 * />
 * ```
 */
export function SchemaExplorer({
  onTableSelect,
  onColumnSelect,
  onColumnDragStart,
  selectedTable,
  selectedColumns = [],
  searchable = true,
  collapsible = true,
  headerAction,
  className,
  style,
}: SchemaExplorerProps): JSX.Element {
  const { tables, isLoading, error } = useSchema();
  const [searchQuery, setSearchQuery] = useState('');

  const handleTableClick = useCallback(
    (table: TableSchema) => {
      onTableSelect?.(table);
    },
    [onTableSelect]
  );

  const handleColumnClick = useCallback(
    (table: TableSchema, column: ColumnSchema) => {
      onColumnSelect?.(table, column);
    },
    [onColumnSelect]
  );

  const handleColumnDragStart = useCallback(
    (table: TableSchema, column: ColumnSchema) => {
      onColumnDragStart?.(table, column);
    },
    [onColumnDragStart]
  );

  // Filter tables based on search query
  const filteredTables = searchQuery
    ? tables.filter(
        (table) =>
          table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          table.columns.some((col) =>
            col.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : tables;

  return (
    <div
      className={className}
      style={{ ...containerStyles, ...style }}
      role="tree"
      aria-label="Database schema"
      data-testid="schema-explorer-root"
    >
      <div style={headerStyles}>
        <Icon name="table" size={16} style={{ color: 'var(--prismiq-color-primary)' }} />
        <span style={{ ...titleStyles, flex: 1 }}>Schema Explorer</span>
        {headerAction}
      </div>

      {searchable && (
        <div style={searchContainerStyles}>
          <Input
            inputSize="sm"
            placeholder="Search tables and columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
            data-testid="schema-explorer-search"
          />
        </div>
      )}

      <div style={treeContainerStyles}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div style={errorStyles}>
            <Icon
              name="error"
              size={24}
              style={{ marginBottom: 'var(--prismiq-spacing-sm)' }}
            />
            <div>Failed to load schema</div>
            <div style={{ fontSize: 'var(--prismiq-font-size-xs)', marginTop: 4 }}>
              {error.message}
            </div>
          </div>
        ) : filteredTables.length === 0 ? (
          <div style={emptyStyles}>
            {searchQuery ? (
              <>No tables or columns match "{searchQuery}"</>
            ) : (
              <>No tables available</>
            )}
          </div>
        ) : (
          filteredTables.map((table) => (
            <TableNode
              key={table.name}
              table={table}
              isSelected={selectedTable === table.name}
              selectedColumns={selectedColumns}
              onTableClick={handleTableClick}
              onColumnClick={handleColumnClick}
              onColumnDragStart={handleColumnDragStart}
              collapsible={collapsible}
              defaultExpanded={!collapsible}
              searchFilter={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  );
}
