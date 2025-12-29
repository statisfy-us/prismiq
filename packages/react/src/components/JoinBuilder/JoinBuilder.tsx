/**
 * JoinBuilder component for defining table joins.
 */

import { useCallback, useMemo } from 'react';

import type { DatabaseSchema, JoinDefinition, QueryTable } from '../../types';
import { Button, Icon } from '../ui';
import { JoinRow } from './JoinRow';

// ============================================================================
// Types
// ============================================================================

export interface JoinBuilderProps {
  /** Tables in the query. */
  tables: QueryTable[];
  /** Current join definitions. */
  joins: JoinDefinition[];
  /** Callback when joins change. */
  onChange: (joins: JoinDefinition[]) => void;
  /** Database schema. */
  schema: DatabaseSchema;
  /** Maximum number of joins allowed. */
  maxJoins?: number;
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
  gap: 'var(--prismiq-spacing-sm)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--prismiq-spacing-xs)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
};

const countStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

const emptyStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  textAlign: 'center',
  color: 'var(--prismiq-color-text-muted)',
  fontSize: 'var(--prismiq-font-size-sm)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px dashed var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
};

const joinsListStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-sm)',
};

const actionsStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--prismiq-spacing-sm)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Join builder component for defining table joins.
 *
 * @example
 * ```tsx
 * <JoinBuilder
 *   tables={query.tables}
 *   joins={query.joins ?? []}
 *   onChange={(joins) => setQuery({ ...query, joins })}
 *   schema={schema}
 *   maxJoins={5}
 * />
 * ```
 */
export function JoinBuilder({
  tables,
  joins,
  onChange,
  schema,
  maxJoins = 10,
  className,
  style,
}: JoinBuilderProps): JSX.Element {
  // Check if we can add more joins (need at least 2 tables)
  const canAddJoin = useMemo(() => {
    return tables.length >= 2 && joins.length < maxJoins;
  }, [tables.length, joins.length, maxJoins]);

  // Get default join for new entry
  const getDefaultJoin = useCallback((): JoinDefinition | null => {
    if (tables.length < 2) return null;

    const fromTable = tables[0];
    const toTable = tables[1];
    if (!fromTable || !toTable) return null;

    const fromTableSchema = schema.tables.find((t) => t.name === fromTable.name);
    const toTableSchema = schema.tables.find((t) => t.name === toTable.name);

    if (!fromTableSchema || !toTableSchema) return null;

    // Try to find matching column names (common join pattern)
    let fromColumn = fromTableSchema.columns[0]?.name ?? '';
    let toColumn = toTableSchema.columns[0]?.name ?? '';

    // Look for id/foreign key patterns
    const toTableName = toTable.name.replace(/s$/, ''); // orders -> order
    const fkPattern = `${toTableName}_id`;

    // Check if from table has a foreign key to the to table
    const fkColumn = fromTableSchema.columns.find(
      (c) => c.name === fkPattern || c.name === `${toTableName}id`
    );
    if (fkColumn) {
      fromColumn = fkColumn.name;
      toColumn = 'id';
    }

    // Check if to table has a foreign key to the from table
    const fromTableName = fromTable.name.replace(/s$/, '');
    const reverseFkPattern = `${fromTableName}_id`;
    const reverseFkColumn = toTableSchema.columns.find(
      (c) => c.name === reverseFkPattern || c.name === `${fromTableName}id`
    );
    if (reverseFkColumn) {
      fromColumn = 'id';
      toColumn = reverseFkColumn.name;
    }

    return {
      from_table_id: fromTable.id,
      from_column: fromColumn,
      to_table_id: toTable.id,
      to_column: toColumn,
      join_type: 'INNER',
    };
  }, [tables, schema]);

  const handleAddJoin = useCallback(() => {
    const defaultJoin = getDefaultJoin();
    if (defaultJoin) {
      onChange([...joins, defaultJoin]);
    }
  }, [joins, onChange, getDefaultJoin]);

  const handleUpdateJoin = useCallback(
    (index: number, join: JoinDefinition) => {
      const newJoins = [...joins];
      newJoins[index] = join;
      onChange(newJoins);
    },
    [joins, onChange]
  );

  const handleRemoveJoin = useCallback(
    (index: number) => {
      const newJoins = [...joins];
      newJoins.splice(index, 1);
      onChange(newJoins);
    },
    [joins, onChange]
  );

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const isEmpty = joins.length === 0;
  const needsMoreTables = tables.length < 2;

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={headerStyles}>
        <span style={titleStyles}>
          <Icon
            name="link"
            size={14}
            style={{
              marginRight: 'var(--prismiq-spacing-xs)',
              verticalAlign: 'middle',
            }}
          />
          Joins
        </span>
        <span style={countStyles}>
          {joins.length} / {maxJoins} joins
        </span>
      </div>

      {isEmpty ? (
        <div style={emptyStyles}>
          {needsMoreTables ? (
            <>Select at least 2 tables to add joins</>
          ) : (
            <>No joins defined. Click "Add Join" to connect tables.</>
          )}
        </div>
      ) : (
        <div style={joinsListStyles}>
          {joins.map((join, index) => (
            <JoinRow
              key={`${join.from_table_id}-${join.to_table_id}-${index}`}
              join={join}
              tables={tables}
              schema={schema}
              index={index}
              onChange={(updated) => handleUpdateJoin(index, updated)}
              onRemove={() => handleRemoveJoin(index)}
            />
          ))}
        </div>
      )}

      <div style={actionsStyles}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Icon name="plus" size={14} />}
          onClick={handleAddJoin}
          disabled={!canAddJoin}
        >
          Add Join
        </Button>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="trash" size={14} />}
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
