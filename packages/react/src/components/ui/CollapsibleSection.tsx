/**
 * CollapsibleSection component for organizing form sections.
 */

import { useState, useCallback } from 'react';
import { useTheme } from '../../theme';
import { Icon } from './Icon';

// ============================================================================
// Types
// ============================================================================

export interface CollapsibleSectionProps {
  /** Section title. */
  title: string;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
  /** Children to render inside the section. */
  children: React.ReactNode;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A collapsible section with a toggle header.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps): JSX.Element {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} 0`,
    cursor: 'pointer',
    userSelect: 'none',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    flex: 1,
  };

  const iconStyle: React.CSSProperties = {
    color: theme.colors.textMuted,
    transition: 'transform 0.2s ease',
    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
  };

  const contentStyle: React.CSSProperties = {
    overflow: 'hidden',
    maxHeight: isOpen ? '1000px' : '0',
    opacity: isOpen ? 1 : 0,
    transition: 'max-height 0.3s ease, opacity 0.2s ease',
    paddingTop: isOpen ? theme.spacing.sm : 0,
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        style={{
          ...headerStyle,
          background: 'none',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <span style={iconStyle}>
          <Icon name="chevron-right" size={14} />
        </span>
        <span style={titleStyle}>{title}</span>
      </button>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}
