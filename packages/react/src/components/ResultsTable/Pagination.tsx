/**
 * Pagination component for the results table.
 */

import { useMemo } from 'react';

import { Button, Icon, Select, type SelectOption } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface PaginationProps {
  /** Current page (1-indexed). */
  currentPage: number;
  /** Total number of items. */
  totalItems: number;
  /** Items per page. */
  pageSize: number;
  /** Callback when page changes. */
  onPageChange: (page: number) => void;
  /** Callback when page size changes. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page size options. */
  pageSizeOptions?: number[];
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
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  borderTop: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
};

const leftStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
};

const rightStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
};

const pageInfoStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Pagination controls for the results table.
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  style,
}: PaginationProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pageSizeSelectOptions: SelectOption<number>[] = useMemo(
    () =>
      pageSizeOptions.map((size) => ({
        value: size,
        label: `${size} / page`,
      })),
    [pageSizeOptions]
  );

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleFirst = () => {
    onPageChange(1);
  };

  const handleLast = () => {
    onPageChange(totalPages);
  };

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={leftStyles}>
        <span>
          Showing {startItem} - {endItem} of {totalItems.toLocaleString()} rows
        </span>
        {onPageSizeChange && (
          <Select
            value={pageSize}
            onChange={onPageSizeChange}
            options={pageSizeSelectOptions}
            size="sm"
          />
        )}
      </div>

      <div style={rightStyles}>
        <div style={pageInfoStyles}>
          <span>Page</span>
          <strong>
            {currentPage} of {totalPages}
          </strong>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleFirst}
          disabled={currentPage === 1}
          aria-label="First page"
        >
          <Icon name="chevron-left" size={14} />
          <Icon name="chevron-left" size={14} style={{ marginLeft: '-8px' }} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <Icon name="chevron-left" size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <Icon name="chevron-right" size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLast}
          disabled={currentPage === totalPages}
          aria-label="Last page"
        >
          <Icon name="chevron-right" size={14} />
          <Icon name="chevron-right" size={14} style={{ marginLeft: '-8px' }} />
        </Button>
      </div>
    </div>
  );
}
