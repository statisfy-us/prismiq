/**
 * Tooltip component.
 */

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TooltipProps {
  /** The content to show in the tooltip. */
  content: ReactNode;
  /** The element that triggers the tooltip. */
  children: ReactElement;
  /** Position of the tooltip relative to the trigger. */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms). */
  delay?: number;
  /** Whether the tooltip is disabled. */
  disabled?: boolean;
  /** Additional class name for the tooltip element. */
  className?: string;
  /** Additional styles for the tooltip element. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const tooltipStyles: React.CSSProperties = {
  position: 'fixed',
  padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
  backgroundColor: 'var(--prismiq-color-text)',
  color: 'var(--prismiq-color-background)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  borderRadius: 'var(--prismiq-radius-md)',
  boxShadow: 'var(--prismiq-shadow-md)',
  zIndex: 9999,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  maxWidth: '250px',
  wordWrap: 'break-word',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Tooltip component that shows content on hover.
 *
 * @example
 * ```tsx
 * <Tooltip content="This is a tooltip">
 *   <Button>Hover me</Button>
 * </Tooltip>
 * ```
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  {
    content,
    children,
    position = 'top',
    delay = 200,
    disabled = false,
    style,
    className,
  },
  ref
) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < gap) left = gap;
    if (left + tooltipRect.width > viewportWidth - gap) {
      left = viewportWidth - tooltipRect.width - gap;
    }
    if (top < gap) top = gap;
    if (top + tooltipRect.height > viewportHeight - gap) {
      top = viewportHeight - tooltipRect.height - gap;
    }

    setTooltipPosition({ top, left });
  }, [position]);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure tooltip is rendered
      requestAnimationFrame(calculatePosition);
    }
  }, [isVisible, calculatePosition]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clone the child element and add event handlers
  const trigger = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        ref: (node: HTMLElement | null) => {
          (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
          // Handle child's ref if it exists
          const childRef = (children as { ref?: React.Ref<HTMLElement> }).ref;
          if (typeof childRef === 'function') {
            childRef(node);
          } else if (childRef && typeof childRef === 'object') {
            (childRef as React.MutableRefObject<HTMLElement | null>).current = node;
          }
        },
        onMouseEnter: (e: React.MouseEvent) => {
          handleMouseEnter();
          const onMouseEnter = children.props.onMouseEnter as
            | ((e: React.MouseEvent) => void)
            | undefined;
          onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleMouseLeave();
          const onMouseLeave = children.props.onMouseLeave as
            | ((e: React.MouseEvent) => void)
            | undefined;
          onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          handleMouseEnter();
          const onFocus = children.props.onFocus as
            | ((e: React.FocusEvent) => void)
            | undefined;
          onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          handleMouseLeave();
          const onBlur = children.props.onBlur as
            | ((e: React.FocusEvent) => void)
            | undefined;
          onBlur?.(e);
        },
      })
    : children;

  return (
    <>
      {trigger}
      {isVisible && (
        <div
          ref={(node) => {
            (tooltipRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          role="tooltip"
          className={className}
          style={{
            ...tooltipStyles,
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            ...style,
          }}
        >
          {content}
        </div>
      )}
    </>
  );
});
