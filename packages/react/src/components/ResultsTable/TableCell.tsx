/**
 * TableCell component for rendering a single cell in the results table.
 */

import { useMemo } from 'react';

import { Tooltip } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface TableCellProps {
  /** Cell value. */
  value: unknown;
  /** Column data type. */
  columnType?: string;
  /** Custom formatter function. */
  formatter?: (value: unknown) => string;
  /** Maximum width before truncation. */
  maxWidth?: number;
  /** Wrap long text onto multiple lines instead of truncating. */
  wrapText?: boolean;
  /** Callback when cell is clicked. */
  onClick?: () => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const cellStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  verticalAlign: 'middle',
  textAlign: 'left',
};

const nullStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  fontStyle: 'italic',
};

const numberStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-mono)',
  textAlign: 'right',
};

const truncatedStyles: React.CSSProperties = {
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const wrappedStyles: React.CSSProperties = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a value for display based on its type.
 */
function formatValue(value: unknown, columnType?: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    // Format numbers with locale
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Format date strings
  if (columnType?.includes('timestamp') || columnType?.includes('date')) {
    const dateStr = String(value);
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        if (columnType?.includes('time')) {
          return date.toLocaleString();
        }
        return date.toLocaleDateString();
      }
    } catch {
      // Fall through to string
    }
  }

  // Format arrays/objects as JSON
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

// ============================================================================
// Hyperlink detection
// ============================================================================

// Only allow http/https URLs — prevents javascript:, data:, vbscript:, file:,
// etc. from being rendered as clickable links.
const SAFE_URL_RE = /^https?:\/\/[^\s<>"']+$/i;

// Markdown link: [label](https://url). Label may contain any character except
// closing bracket; URL must be a safe http/https URL with no whitespace/quotes.
const MARKDOWN_LINK_RE = /^\[([^\]]+)\]\((https?:\/\/[^\s<>"')]+)\)$/;

/**
 * Detect a hyperlink in a formatted cell string.
 *
 * Supports two forms:
 *  - Bare URL:      "https://example.com/foo"
 *  - Markdown link: "[Account Name](https://app.statisfy.com/book/...)"
 *
 * Returns `{ label, href }` when a safe link is detected, otherwise null.
 * Only http/https URLs qualify — javascript:/data:/etc. are treated as plain text.
 */
function detectHyperlink(
  s: string
): { label: string; href: string } | null {
  const md = MARKDOWN_LINK_RE.exec(s);
  if (md) {
    return { label: md[1], href: md[2] };
  }
  if (SAFE_URL_RE.test(s)) {
    return { label: s, href: s };
  }
  return null;
}

/**
 * Check if value is numeric type.
 */
function isNumericType(columnType?: string): boolean {
  if (!columnType) return false;
  const type = columnType.toLowerCase();
  return (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single cell in the results table.
 */
export function TableCell({
  value,
  columnType,
  formatter,
  maxWidth = 200,
  wrapText = false,
  onClick,
  className,
}: TableCellProps): JSX.Element {
  const isNull = value === null || value === undefined;
  const isNumeric = isNumericType(columnType);

  const formattedValue = useMemo(() => {
    if (formatter) {
      return formatter(value);
    }
    return formatValue(value, columnType);
  }, [value, columnType, formatter]);

  // Detect http/https URL or markdown-link ("[label](url)") in the cell string.
  // Skip when NULL, or when a custom onClick handler owns the cell (we don't
  // want two competing click behaviors on the same target).
  const link = useMemo(() => {
    if (isNull || onClick) return null;
    return detectHyperlink(formattedValue);
  }, [formattedValue, isNull, onClick]);

  const displayText = link ? link.label : formattedValue;
  const isLong = displayText.length > 50;
  const needsTruncation = isLong && !wrapText;

  const cellContent = (
    <td
      className={className}
      onClick={onClick}
      style={{
        ...cellStyles,
        ...(isNull ? nullStyles : {}),
        ...(isNumeric ? numberStyles : {}),
        ...(needsTruncation ? { ...truncatedStyles, maxWidth } : {}),
        ...(wrapText ? wrappedStyles : {}),
        ...(onClick ? { cursor: 'pointer' } : {}),
      }}
    >
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--prismiq-color-primary)',
            textDecoration: 'underline',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {link.label}
        </a>
      ) : (
        formattedValue
      )}
    </td>
  );

  if (needsTruncation) {
    return (
      <Tooltip content={formattedValue} position="top" delay={200}>
        {cellContent}
      </Tooltip>
    );
  }

  return cellContent;
}
