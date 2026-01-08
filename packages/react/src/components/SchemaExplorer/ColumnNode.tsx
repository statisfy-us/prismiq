/**
 * ColumnNode component for displaying a column in the schema explorer.
 */

import { useCallback, useState, useRef, type MouseEvent, type DragEvent } from 'react';

import { useAnalytics } from '../../context';
import type { ColumnSchema, TableSchema } from '../../types';
import { Icon, Tooltip } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface ColumnNodeProps {
  /** The column schema. */
  column: ColumnSchema;
  /** The parent table schema. */
  table: TableSchema;
  /** Whether this column is selected. */
  isSelected?: boolean;
  /** Callback when column is clicked. */
  onClick?: (table: TableSchema, column: ColumnSchema) => void;
  /** Callback when column drag starts. */
  onDragStart?: (table: TableSchema, column: ColumnSchema) => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const nodeStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
  paddingLeft: 'var(--prismiq-spacing-xl)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  userSelect: 'none',
  position: 'relative',
};

const selectedStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
};

const iconStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  flexShrink: 0,
};

const nameStyles: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const typeStyles: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'var(--prismiq-font-mono)',
  padding: '1px 4px',
  borderRadius: '3px',
  lineHeight: 1.2,
};

// Type category colors
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  numeric: { bg: 'rgba(59, 130, 246, 0.15)', text: 'rgb(59, 130, 246)' },      // Blue
  string: { bg: 'rgba(34, 197, 94, 0.15)', text: 'rgb(34, 197, 94)' },         // Green
  datetime: { bg: 'rgba(249, 115, 22, 0.15)', text: 'rgb(249, 115, 22)' },     // Orange
  boolean: { bg: 'rgba(168, 85, 247, 0.15)', text: 'rgb(168, 85, 247)' },      // Purple
  json: { bg: 'rgba(236, 72, 153, 0.15)', text: 'rgb(236, 72, 153)' },         // Pink
  other: { bg: 'rgba(107, 114, 128, 0.15)', text: 'rgb(107, 114, 128)' },      // Gray
};

// Sample preview popover styles
const previewPopoverStyles: React.CSSProperties = {
  position: 'absolute',
  left: '100%',
  top: '50%',
  transform: 'translateY(-50%)',
  marginLeft: '8px',
  padding: '8px 12px',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  zIndex: 1000,
  minWidth: '120px',
  maxWidth: '250px',
};

const previewHeaderStyles: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: 'var(--prismiq-color-text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const previewValueStyles: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--prismiq-font-mono)',
  color: 'var(--prismiq-color-text)',
  padding: '2px 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const previewLoadingStyles: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--prismiq-color-text-muted)',
  fontStyle: 'italic',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the icon name for a column based on its properties.
 */
function getColumnIcon(column: ColumnSchema): 'key' | 'link' | 'column' {
  if (column.is_primary_key) return 'key';
  // Note: foreign key detection would come from relationships, not column itself
  return 'column';
}

/**
 * Format the data type for display.
 */
function formatDataType(dataType: string): string {
  // Shorten common PostgreSQL types
  const typeMap: Record<string, string> = {
    'character varying': 'varchar',
    'timestamp without time zone': 'timestamp',
    'timestamp with time zone': 'timestamptz',
    'double precision': 'double',
    'boolean': 'bool',
    'integer': 'int',
    'bigint': 'int8',
    'smallint': 'int2',
  };
  return typeMap[dataType] ?? dataType;
}

/**
 * Get the type category for color coding.
 */
function getTypeCategory(dataType: string): keyof typeof TYPE_COLORS {
  const lowerType = dataType.toLowerCase();

  // Numeric types
  if (
    lowerType.includes('int') ||
    lowerType.includes('numeric') ||
    lowerType.includes('decimal') ||
    lowerType.includes('real') ||
    lowerType.includes('double') ||
    lowerType.includes('serial') ||
    lowerType.includes('money')
  ) {
    return 'numeric';
  }

  // Date/time types
  if (
    lowerType.includes('timestamp') ||
    lowerType.includes('date') ||
    lowerType.includes('time') ||
    lowerType.includes('interval')
  ) {
    return 'datetime';
  }

  // Boolean
  if (lowerType.includes('bool')) {
    return 'boolean';
  }

  // JSON types
  if (lowerType.includes('json')) {
    return 'json';
  }

  // String types
  if (
    lowerType.includes('char') ||
    lowerType.includes('text') ||
    lowerType.includes('varchar') ||
    lowerType.includes('uuid') ||
    lowerType.includes('citext')
  ) {
    return 'string';
  }

  return 'other';
}

/**
 * Format a sample value for display.
 */
function formatSampleValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') {
    // Truncate long strings
    return value.length > 30 ? `"${value.slice(0, 27)}..."` : `"${value}"`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single column node in the schema explorer tree.
 */
export function ColumnNode({
  column,
  table,
  isSelected = false,
  onClick,
  onDragStart,
  className,
}: ColumnNodeProps): JSX.Element {
  const { client } = useAnalytics();
  const [showPreview, setShowPreview] = useState(false);
  const [sampleValues, setSampleValues] = useState<unknown[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClick?.(table, column);
    },
    [onClick, table, column]
  );

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData(
        'application/prismiq-column',
        JSON.stringify({ table: table.name, column: column.name })
      );
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart?.(table, column);
    },
    [onDragStart, table, column]
  );

  const handleMouseEnter = useCallback(() => {
    // Start a delay before showing the preview
    hoverTimeoutRef.current = setTimeout(async () => {
      setShowPreview(true);

      // Fetch sample data if not already fetched
      if (!fetchedRef.current && !isLoading) {
        setIsLoading(true);
        try {
          const values = await client.getColumnSample(table.name, column.name, 5);
          setSampleValues(values);
          fetchedRef.current = true;
        } catch {
          // Silently fail - just don't show sample data
          setSampleValues([]);
        } finally {
          setIsLoading(false);
        }
      }
    }, 400); // 400ms delay before showing preview
  }, [client, table.name, column.name, isLoading]);

  const handleMouseLeave = useCallback(() => {
    // Cancel any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowPreview(false);
  }, []);

  const iconName = getColumnIcon(column);
  const formattedType = formatDataType(column.data_type);
  const typeCategory = getTypeCategory(column.data_type);
  const defaultColor = { bg: 'rgba(107, 114, 128, 0.15)', text: 'rgb(107, 114, 128)' };
  const typeColor = TYPE_COLORS[typeCategory] ?? defaultColor;

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      className={className}
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(table, column);
        }
      }}
      style={{
        ...nodeStyles,
        ...(isSelected ? selectedStyles : {}),
      }}
    >
      <Tooltip
        content={
          column.is_primary_key
            ? 'Primary Key'
            : column.is_nullable
              ? 'Nullable column'
              : 'Required column'
        }
        position="right"
        delay={500}
      >
        <span style={iconStyles}>
          <Icon name={iconName} size={14} />
        </span>
      </Tooltip>
      <span style={nameStyles}>{column.name}</span>
      <span
        style={{
          ...typeStyles,
          backgroundColor: typeColor.bg,
          color: typeColor.text,
        }}
      >
        {formattedType}
      </span>

      {/* Sample data preview popover */}
      {showPreview && (
        <div style={previewPopoverStyles}>
          <div style={previewHeaderStyles}>Sample Values</div>
          {isLoading ? (
            <div style={previewLoadingStyles}>Loading...</div>
          ) : sampleValues && sampleValues.length > 0 ? (
            sampleValues.map((value, i) => (
              <div key={i} style={previewValueStyles} title={String(value)}>
                {formatSampleValue(value)}
              </div>
            ))
          ) : (
            <div style={previewLoadingStyles}>No data</div>
          )}
        </div>
      )}
    </div>
  );
}
