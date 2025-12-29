/**
 * Dialog component.
 *
 * Accessible modal dialog with focus trap and backdrop.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { useFocusTrap } from '../../utils';

// ============================================================================
// Types
// ============================================================================

export interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Dialog title. */
  title?: ReactNode;
  /** Dialog description. */
  description?: ReactNode;
  /** Dialog content. */
  children: ReactNode;
  /** Whether to show a close button. */
  showCloseButton?: boolean;
  /** Whether clicking the backdrop closes the dialog. */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the dialog. */
  closeOnEscape?: boolean;
  /** Dialog width. */
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

// ============================================================================
// Styles
// ============================================================================

const backdropStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 'var(--prismiq-spacing-lg)',
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-background)',
  borderRadius: 'var(--prismiq-radius-lg)',
  boxShadow: 'var(--prismiq-shadow-lg)',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  outline: 'none',
};

const widthStyles: Record<NonNullable<DialogProps['width']>, React.CSSProperties> = {
  sm: { width: '100%', maxWidth: '400px' },
  md: { width: '100%', maxWidth: '560px' },
  lg: { width: '100%', maxWidth: '720px' },
  xl: { width: '100%', maxWidth: '960px' },
  full: { width: '100%', maxWidth: 'calc(100vw - 48px)' },
};

const headerStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-lg)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 'var(--prismiq-spacing-md)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-lg)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  margin: 0,
  lineHeight: 1.4,
};

const descriptionStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  margin: '4px 0 0 0',
  lineHeight: 1.5,
};

const closeButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  border: 'none',
  background: 'transparent',
  borderRadius: 'var(--prismiq-radius-sm)',
  cursor: 'pointer',
  color: 'var(--prismiq-color-text-muted)',
  flexShrink: 0,
};

const contentStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-lg)',
  overflow: 'auto',
  flex: 1,
};

const footerStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-lg)',
  borderTop: '1px solid var(--prismiq-color-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'var(--prismiq-spacing-sm)',
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Dialog header component.
 */
export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  function DialogHeader({ children, style, ...props }, ref) {
    return (
      <div ref={ref} style={{ ...footerStyles, justifyContent: 'flex-start', ...style }} {...props}>
        {children}
      </div>
    );
  }
);

/**
 * Dialog footer component for action buttons.
 */
export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  function DialogFooter({ children, style, ...props }, ref) {
    return (
      <div ref={ref} style={{ ...footerStyles, ...style }} {...props}>
        {children}
      </div>
    );
  }
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Modal dialog component with accessibility features.
 *
 * @example
 * ```tsx
 * function Example() {
 *   const [open, setOpen] = useState(false);
 *
 *   return (
 *     <>
 *       <Button onClick={() => setOpen(true)}>Open Dialog</Button>
 *       <Dialog
 *         open={open}
 *         onClose={() => setOpen(false)}
 *         title="Confirm Action"
 *         description="Are you sure you want to proceed?"
 *       >
 *         <p>This action cannot be undone.</p>
 *         <DialogFooter>
 *           <Button variant="secondary" onClick={() => setOpen(false)}>
 *             Cancel
 *           </Button>
 *           <Button variant="danger">Delete</Button>
 *         </DialogFooter>
 *       </Dialog>
 *     </>
 *   );
 * }
 * ```
 */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  {
    open,
    onClose,
    title,
    description,
    children,
    showCloseButton = true,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    width = 'md',
    style,
    ...props
  },
  _ref
) {
  // Focus trap
  const { containerRef } = useFocusTrap({
    active: open,
    onEscape: closeOnEscape ? onClose : undefined,
  });

  // Note: We use containerRef from useFocusTrap for focus management
  // The forwarded ref is not used directly but available via the forwardRef pattern

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  if (!open) return null;

  const dialogContent = (
    <div
      style={backdropStyles}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-describedby={description ? 'dialog-description' : undefined}
        tabIndex={-1}
        style={{
          ...dialogStyles,
          ...widthStyles[width],
          ...style,
        }}
        {...props}
      >
        {(title || showCloseButton) && (
          <div style={headerStyles}>
            <div>
              {title && (
                <h2 id="dialog-title" style={titleStyles}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-description" style={descriptionStyles}>
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                style={closeButtonStyles}
                aria-label="Close dialog"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div style={contentStyles}>{children}</div>
      </div>
    </div>
  );

  // Render in portal
  return createPortal(dialogContent, document.body);
});
