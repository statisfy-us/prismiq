'use client';

/**
 * Accessibility utilities for keyboard navigation and screen readers.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FocusTrapOptions {
  /** Whether the focus trap is active. */
  active?: boolean;
  /** Whether to focus the first focusable element when activated. */
  autoFocus?: boolean;
  /** Whether to restore focus when deactivated. */
  restoreFocus?: boolean;
  /** Called when Escape is pressed. */
  onEscape?: () => void;
}

export interface ArrowNavigationOptions {
  /** Whether navigation wraps around at edges. */
  wrap?: boolean;
  /** Orientation for arrow key mapping. */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Callback when active item changes. */
  onActiveChange?: (index: number) => void;
}

export interface UseFocusTrapResult {
  /** Ref to attach to the container element. */
  containerRef: RefObject<HTMLElement>;
  /** Activate the focus trap. */
  activate: () => void;
  /** Deactivate the focus trap. */
  deactivate: () => void;
  /** Whether the trap is active. */
  isActive: boolean;
}

export interface UseArrowNavigationResult {
  /** Current active index. */
  activeIndex: number;
  /** Set active index. */
  setActiveIndex: (index: number) => void;
  /** Key down handler to attach to container. */
  onKeyDown: (event: React.KeyboardEvent) => void;
  /** Get props for an item. */
  getItemProps: (index: number) => {
    tabIndex: number;
    'aria-selected': boolean;
    onFocus: () => void;
  };
}

// ============================================================================
// Focus Trap Hook
// ============================================================================

/**
 * Selector for focusable elements.
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Get all focusable elements within a container.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
  return Array.from(elements).filter(
    (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null
  );
}

/**
 * Hook to trap focus within a container.
 *
 * @param options - Focus trap options
 * @returns Focus trap controls
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const { containerRef, activate, deactivate } = useFocusTrap({
 *     active: isOpen,
 *     onEscape: onClose,
 *   });
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *       <input type="text" />
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(options: FocusTrapOptions = {}): UseFocusTrapResult {
  const {
    active = true,
    autoFocus = true,
    restoreFocus = true,
    onEscape,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isActive, setIsActive] = useState(active);

  const activate = useCallback(() => {
    if (!containerRef.current) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus first focusable element
    if (autoFocus) {
      const focusable = getFocusableElements(containerRef.current);
      const firstElement = focusable[0];
      if (firstElement) {
        firstElement.focus();
      }
    }

    setIsActive(true);
  }, [autoFocus]);

  const deactivate = useCallback(() => {
    setIsActive(false);

    // Restore focus
    if (restoreFocus && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [restoreFocus]);

  // Handle focus trap
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      // Guard against undefined (though array check above should prevent this)
      if (!firstElement || !lastElement) return;

      // Shift+Tab on first element -> focus last
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      // Tab on last element -> focus first
      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    // Handle focus escaping the container
    const handleFocusIn = (event: FocusEvent) => {
      if (!container.contains(event.target as Node)) {
        const focusable = getFocusableElements(container);
        const firstElement = focusable[0];
        if (firstElement) {
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [isActive, onEscape]);

  // Auto-activate when active prop changes
  useEffect(() => {
    if (active) {
      activate();
    } else {
      deactivate();
    }
  }, [active, activate, deactivate]);

  return {
    containerRef: containerRef as RefObject<HTMLElement>,
    activate,
    deactivate,
    isActive,
  };
}

// ============================================================================
// Arrow Navigation Hook
// ============================================================================

/**
 * Hook for arrow key navigation through a list of items.
 *
 * @param itemCount - Number of items in the list
 * @param options - Navigation options
 * @returns Navigation state and handlers
 *
 * @example
 * ```tsx
 * function Menu({ items }) {
 *   const { activeIndex, onKeyDown, getItemProps } = useArrowNavigation(items.length);
 *
 *   return (
 *     <ul role="menu" onKeyDown={onKeyDown}>
 *       {items.map((item, index) => (
 *         <li key={index} role="menuitem" {...getItemProps(index)}>
 *           {item}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useArrowNavigation(
  itemCount: number,
  options: ArrowNavigationOptions = {}
): UseArrowNavigationResult {
  const { wrap = true, orientation = 'vertical', onActiveChange } = options;

  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      let newIndex = activeIndex;
      let handled = false;

      // Map arrow keys based on orientation
      const isNext =
        (orientation === 'vertical' && event.key === 'ArrowDown') ||
        (orientation === 'horizontal' && event.key === 'ArrowRight') ||
        (orientation === 'both' && (event.key === 'ArrowDown' || event.key === 'ArrowRight'));

      const isPrev =
        (orientation === 'vertical' && event.key === 'ArrowUp') ||
        (orientation === 'horizontal' && event.key === 'ArrowLeft') ||
        (orientation === 'both' && (event.key === 'ArrowUp' || event.key === 'ArrowLeft'));

      if (isNext) {
        handled = true;
        if (activeIndex < itemCount - 1) {
          newIndex = activeIndex + 1;
        } else if (wrap) {
          newIndex = 0;
        }
      } else if (isPrev) {
        handled = true;
        if (activeIndex > 0) {
          newIndex = activeIndex - 1;
        } else if (wrap) {
          newIndex = itemCount - 1;
        }
      } else if (event.key === 'Home') {
        handled = true;
        newIndex = 0;
      } else if (event.key === 'End') {
        handled = true;
        newIndex = itemCount - 1;
      }

      if (handled) {
        event.preventDefault();
        setActiveIndex(newIndex);
        onActiveChange?.(newIndex);
      }
    },
    [activeIndex, itemCount, wrap, orientation, onActiveChange]
  );

  const getItemProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      'aria-selected': index === activeIndex,
      onFocus: () => {
        setActiveIndex(index);
        onActiveChange?.(index);
      },
    }),
    [activeIndex, onActiveChange]
  );

  // Update active index setter to also call callback
  const handleSetActiveIndex = useCallback(
    (index: number) => {
      setActiveIndex(index);
      onActiveChange?.(index);
    },
    [onActiveChange]
  );

  return {
    activeIndex,
    setActiveIndex: handleSetActiveIndex,
    onKeyDown: handleKeyDown,
    getItemProps,
  };
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

let announceElement: HTMLElement | null = null;

/**
 * Get or create the live region element for announcements.
 */
function getAnnounceElement(): HTMLElement {
  if (announceElement) return announceElement;

  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    throw new Error('announceToScreenReader can only be used in browser environment');
  }

  announceElement = document.createElement('div');
  announceElement.setAttribute('role', 'status');
  announceElement.setAttribute('aria-live', 'polite');
  announceElement.setAttribute('aria-atomic', 'true');
  announceElement.style.cssText = [
    'position: absolute',
    'width: 1px',
    'height: 1px',
    'padding: 0',
    'margin: -1px',
    'overflow: hidden',
    'clip: rect(0, 0, 0, 0)',
    'white-space: nowrap',
    'border: 0',
  ].join(';');
  announceElement.id = 'prismiq-announcer';

  document.body.appendChild(announceElement);
  return announceElement;
}

/**
 * Announce a message to screen readers.
 *
 * @param message - The message to announce
 * @param priority - Announcement priority ('polite' or 'assertive')
 *
 * @example
 * ```tsx
 * // Announce a status update
 * announceToScreenReader('Results loaded: 42 items');
 *
 * // Urgent announcement
 * announceToScreenReader('Error: Connection lost', 'assertive');
 * ```
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  // Skip in SSR
  if (typeof document === 'undefined') return;

  const element = getAnnounceElement();
  element.setAttribute('aria-live', priority);

  // Clear and set message (this triggers announcement)
  element.textContent = '';
  // Use requestAnimationFrame to ensure the clear happens first
  requestAnimationFrame(() => {
    element.textContent = message;
  });
}

// ============================================================================
// Focus Visible
// ============================================================================

/**
 * CSS for focus-visible styling.
 * Add this to your global styles or use the useFocusVisible hook.
 */
export const focusVisibleStyles = `
  /* Hide focus outline for mouse users */
  :focus:not(:focus-visible) {
    outline: none;
  }

  /* Show focus outline for keyboard users */
  :focus-visible {
    outline: 2px solid var(--prismiq-color-primary);
    outline-offset: 2px;
  }

  /* Prismiq focus ring class */
  .prismiq-focus-ring:focus-visible {
    outline: 2px solid var(--prismiq-color-primary);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(var(--prismiq-color-primary-rgb), 0.2);
  }
`;

/**
 * Hook to detect if focus is visible (keyboard navigation).
 */
export function useFocusVisible(): boolean {
  const [focusVisible, setFocusVisible] = useState(false);

  useEffect(() => {
    // Skip in SSR
    if (typeof window === 'undefined') return;

    let hadKeyboardEvent = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        hadKeyboardEvent = true;
      }
    };

    const handlePointerDown = () => {
      hadKeyboardEvent = false;
    };

    const handleFocus = () => {
      setFocusVisible(hadKeyboardEvent);
    };

    const handleBlur = () => {
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
    };
  }, []);

  return focusVisible;
}

// ============================================================================
// Skip Link
// ============================================================================

/**
 * Props for the skip link component.
 */
export interface SkipLinkProps {
  /** Target element ID to skip to. */
  targetId: string;
  /** Link text. */
  children?: React.ReactNode;
}

/**
 * Styles for skip link (visually hidden until focused).
 */
export const skipLinkStyles: React.CSSProperties = {
  position: 'absolute',
  left: '-9999px',
  zIndex: 9999,
  padding: '1em',
  backgroundColor: 'var(--prismiq-color-background)',
  color: 'var(--prismiq-color-primary)',
  textDecoration: 'underline',
  // When focused, show the link
};

export const skipLinkFocusStyles: React.CSSProperties = {
  ...skipLinkStyles,
  left: 0,
  top: 0,
};

// ============================================================================
// Roving Tab Index
// ============================================================================

/**
 * Hook for implementing roving tabindex pattern.
 *
 * @param itemRefs - Refs to the focusable items
 * @param options - Navigation options
 */
export function useRovingTabIndex<T extends HTMLElement>(
  itemRefs: RefObject<T>[],
  options: ArrowNavigationOptions = {}
): UseArrowNavigationResult {
  const result = useArrowNavigation(itemRefs.length, options);

  // Focus the active element when activeIndex changes
  useEffect(() => {
    const activeRef = itemRefs[result.activeIndex];
    if (activeRef?.current) {
      activeRef.current.focus();
    }
  }, [result.activeIndex, itemRefs]);

  return result;
}
