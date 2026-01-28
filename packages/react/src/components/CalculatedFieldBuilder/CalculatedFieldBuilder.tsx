/**
 * CalculatedFieldBuilder component for creating and managing calculated fields.
 *
 * Provides UI for:
 * - Adding new calculated fields
 * - Editing field names and expressions
 * - Selecting data types
 * - Removing fields
 */

import { useCallback, useRef } from 'react';
import { useTheme } from '../../theme';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ExpressionEditor } from './ExpressionEditor';
import type { CalculatedField, QueryTable, DatabaseSchema } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface CalculatedFieldBuilderProps {
  /** Current calculated fields. */
  fields: CalculatedField[];
  /** Callback when fields change. */
  onChange: (fields: CalculatedField[]) => void;
  /** Tables in the query (for field references). */
  tables: QueryTable[];
  /** Database schema for field information. */
  schema: DatabaseSchema;
  /** Maximum number of calculated fields allowed. */
  maxFields?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DATA_TYPE_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Builder for creating and managing calculated fields.
 */
export function CalculatedFieldBuilder({
  fields,
  onChange,
  tables,
  schema,
  maxFields = 10,
}: CalculatedFieldBuilderProps): JSX.Element {
  const { theme } = useTheme();

  // Counter for generating unique IDs
  const idCounter = useRef(0);
  const fieldIdsRef = useRef<Map<CalculatedField, string>>(new Map());

  // Get or create a stable ID for a field
  const getFieldId = useCallback((field: CalculatedField): string => {
    let id = fieldIdsRef.current.get(field);
    if (!id) {
      id = `field-${++idCounter.current}`;
      fieldIdsRef.current.set(field, id);
    }
    return id;
  }, []);

  const addField = useCallback(() => {
    if (fields.length >= maxFields) return;

    const newField: CalculatedField = {
      name: `calculated_${fields.length + 1}`,
      expression: '',
      data_type: 'number',
    };
    onChange([...fields, newField]);
  }, [fields, onChange, maxFields]);

  // Update a field
  const updateField = useCallback(
    (index: number, updates: Partial<CalculatedField>) => {
      onChange(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
    },
    [fields, onChange]
  );

  // Remove a field
  const removeField = useCallback(
    (index: number) => {
      onChange(fields.filter((_, i) => i !== index));
    },
    [fields, onChange]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const fieldCardStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  };

  const fieldHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  };

  const fieldIndexStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    fontWeight: 500,
  };

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  };

  const emptyStateStyle: React.CSSProperties = {
    padding: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textMuted,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  };

  return (
    <div style={containerStyle}>
      {fields.length === 0 ? (
        <div style={emptyStateStyle}>
          <p style={{ margin: 0, marginBottom: theme.spacing.sm }}>
            No calculated fields defined
          </p>
          <p style={{ ...helpTextStyle, margin: 0 }}>
            Create computed columns using expressions like <code>[revenue] - [cost]</code>
          </p>
        </div>
      ) : (
        fields.map((field, index) => (
          <div key={getFieldId(field)} style={fieldCardStyle}>
            <div style={fieldHeaderStyle}>
              <span style={fieldIndexStyle}>Calculated Field #{index + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => removeField(index)}>
                <Icon name="trash" size={14} />
              </Button>
            </div>

            <div style={fieldRowStyle}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Name</label>
                <Input
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  placeholder="field_name"
                />
              </div>
              <div style={{ width: '120px' }}>
                <label style={labelStyle}>Data Type</label>
                <Select
                  value={field.data_type ?? 'number'}
                  onChange={(value) => updateField(index, { data_type: value })}
                  options={DATA_TYPE_OPTIONS}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Expression</label>
              <ExpressionEditor
                value={field.expression}
                onChange={(expression) => updateField(index, { expression })}
                tables={tables}
                schema={schema}
              />
            </div>
          </div>
        ))
      )}

      {fields.length < maxFields && (
        <Button
          variant="secondary"
          onClick={addField}
          style={{ alignSelf: 'flex-start' }}
        >
          <Icon name="plus" size={14} />
          <span style={{ marginLeft: theme.spacing.xs }}>Add Calculated Field</span>
        </Button>
      )}

      {fields.length >= maxFields && (
        <span style={helpTextStyle}>
          Maximum of {maxFields} calculated fields reached
        </span>
      )}
    </div>
  );
}
