/**
 * TableSelector component for selecting multiple tables in a query.
 *
 * Allows adding and removing tables with support for suggested joins
 * based on schema relationships.
 */

import { useCallback, useMemo } from 'react';
import { useTheme } from '../../theme';
import type { DatabaseSchema, QueryTable } from '../../types';
import { Icon, Select, Badge } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface TableSelectorProps {
  /** Database schema with available tables. */
  schema: DatabaseSchema;
  /** Currently selected tables. */
  tables: QueryTable[];
  /** Callback when tables change. */
  onChange: (tables: QueryTable[]) => void;
  /** Maximum number of tables allowed. */
  maxTables?: number;
  /** Whether to show relationship suggestions. */
  showRelationships?: boolean;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a unique table ID.
 */
function generateTableId(tables: QueryTable[]): string {
  let id = tables.length + 1;
  const existingIds = new Set(tables.map((t) => t.id));
  while (existingIds.has(`t${id}`)) {
    id++;
  }
  return `t${id}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Multi-table selector with relationship suggestions.
 */
export function TableSelector({
  schema,
  tables,
  onChange,
  maxTables = 5,
  showRelationships = true,
  className,
}: TableSelectorProps): JSX.Element {
  const { theme } = useTheme();

  // Get table options excluding already selected tables
  const availableTableOptions = useMemo(() => {
    const selectedNames = new Set(tables.map((t) => t.name));
    return schema.tables
      .filter((t) => !selectedNames.has(t.name))
      .map((t) => ({
        value: t.name,
        label: `${t.name} (${t.columns.length} cols)`,
      }));
  }, [schema.tables, tables]);

  // Get suggested tables based on relationships
  const suggestedTables = useMemo(() => {
    if (!showRelationships || tables.length === 0) return [];

    const selectedNames = new Set(tables.map((t) => t.name));
    const suggestions: { table: string; relationship: string }[] = [];

    for (const rel of schema.relationships) {
      // If from_table is selected, suggest to_table
      if (selectedNames.has(rel.from_table) && !selectedNames.has(rel.to_table)) {
        const existing = suggestions.find((s) => s.table === rel.to_table);
        if (!existing) {
          suggestions.push({
            table: rel.to_table,
            relationship: `via ${rel.from_table}.${rel.from_column}`,
          });
        }
      }
      // If to_table is selected, suggest from_table
      if (selectedNames.has(rel.to_table) && !selectedNames.has(rel.from_table)) {
        const existing = suggestions.find((s) => s.table === rel.from_table);
        if (!existing) {
          suggestions.push({
            table: rel.from_table,
            relationship: `via ${rel.to_table}.${rel.to_column}`,
          });
        }
      }
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }, [schema.relationships, tables, showRelationships]);

  const handleAddTable = useCallback(
    (tableName: string) => {
      if (!tableName || tables.length >= maxTables) return;

      const newTable: QueryTable = {
        id: generateTableId(tables),
        name: tableName,
      };
      onChange([...tables, newTable]);
    },
    [tables, onChange, maxTables]
  );

  const handleRemoveTable = useCallback(
    (tableId: string) => {
      onChange(tables.filter((t) => t.id !== tableId));
    },
    [tables, onChange]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const selectedTablesStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  };

  const tableChipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSizes.sm,
  };

  const removeButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    color: theme.colors.textMuted,
  };

  const addSectionStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  };

  const suggestionsStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  };

  const suggestionChipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: `${theme.colors.primary}10`,
    border: `1px dashed ${theme.colors.primary}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSizes.xs,
    cursor: 'pointer',
    color: theme.colors.primary,
  };

  const canAddMore = tables.length < maxTables && availableTableOptions.length > 0;

  return (
    <div className={className} style={containerStyle}>
      {/* Selected Tables */}
      {tables.length > 0 && (
        <div style={selectedTablesStyle}>
          {tables.map((table, index) => (
            <div key={table.id} style={tableChipStyle}>
              <Icon name="table" size={14} />
              <span>{table.name}</span>
              {index === 0 && <Badge size="sm" variant="default">primary</Badge>}
              {tables.length > 1 && (
                <button
                  type="button"
                  style={removeButtonStyle}
                  onClick={() => handleRemoveTable(table.id)}
                  aria-label={`Remove ${table.name}`}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Table */}
      {canAddMore && (
        <div>
          <div style={addSectionStyle}>
            <Select
              value=""
              onChange={handleAddTable}
              options={[{ value: '', label: 'Add another table...' }, ...availableTableOptions]}
              style={{ minWidth: '200px' }}
            />
            <span style={{ fontSize: theme.fontSizes.xs, color: theme.colors.textMuted }}>
              {tables.length} / {maxTables} tables
            </span>
          </div>

          {/* Suggestions */}
          {suggestedTables.length > 0 && (
            <div style={suggestionsStyle}>
              <span style={{ fontSize: theme.fontSizes.xs, color: theme.colors.textMuted }}>
                Related:
              </span>
              {suggestedTables.map((suggestion) => (
                <button
                  key={suggestion.table}
                  type="button"
                  style={suggestionChipStyle}
                  onClick={() => handleAddTable(suggestion.table)}
                  title={suggestion.relationship}
                >
                  <Icon name="plus" size={10} />
                  {suggestion.table}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
