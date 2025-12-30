/**
 * SavedQueryPicker component.
 *
 * Allows users to select, save, and manage saved queries.
 */

import {
  forwardRef,
  useCallback,
  useState,
  type HTMLAttributes,
} from 'react';

import { useSavedQueries } from '../../hooks/useSavedQueries';
import type { QueryDefinition, SavedQuery } from '../../types';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/Dropdown';

// ============================================================================
// Types
// ============================================================================

export interface SavedQueryPickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Current query definition (used when saving). */
  currentQuery?: QueryDefinition | null;
  /** Callback when a saved query is selected. */
  onSelect?: (query: SavedQuery) => void;
  /** Callback after successfully saving a query. */
  onSave?: (query: SavedQuery) => void;
  /** Whether to show the save option. */
  showSave?: boolean;
  /** Custom trigger element. */
  trigger?: React.ReactNode;
  /** Label for the trigger button. */
  label?: string;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'inline-block',
};

const queryItemStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
};

const queryNameStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-base)',
  fontWeight: 500,
  color: 'var(--prismiq-color-text)',
};

const queryDescStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '200px',
};

const emptyStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  padding: 'var(--prismiq-spacing-md)',
  textAlign: 'center',
};

const loadingStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  padding: 'var(--prismiq-spacing-md)',
  textAlign: 'center',
};

const dialogOverlayStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10001,
};

const dialogStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-background)',
  borderRadius: 'var(--prismiq-radius-lg)',
  padding: 'var(--prismiq-spacing-lg)',
  minWidth: '300px',
  maxWidth: '400px',
  boxShadow: 'var(--prismiq-shadow-lg)',
};

const dialogTitleStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-lg)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  marginBottom: 'var(--prismiq-spacing-md)',
};

const inputStyles: React.CSSProperties = {
  width: '100%',
  padding: 'var(--prismiq-spacing-sm)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-base)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  marginBottom: 'var(--prismiq-spacing-sm)',
  boxSizing: 'border-box',
};

const dialogActionsStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--prismiq-spacing-sm)',
  marginTop: 'var(--prismiq-spacing-md)',
};

const sharedBadgeStyles: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '10px',
  padding: '1px 4px',
  backgroundColor: 'var(--prismiq-color-primary)',
  color: 'var(--prismiq-color-text-inverse)',
  borderRadius: 'var(--prismiq-radius-sm)',
  marginLeft: 'var(--prismiq-spacing-xs)',
};

// ============================================================================
// SaveDialog Component
// ============================================================================

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, isShared: boolean) => void;
  isSaving: boolean;
}

function SaveDialog({ isOpen, onClose, onSave, isSaving }: SaveDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);

  const handleSubmit = useCallback(() => {
    if (name.trim()) {
      onSave(name.trim(), description.trim(), isShared);
    }
  }, [name, description, isShared, onSave]);

  if (!isOpen) return null;

  return (
    <div style={dialogOverlayStyles} onClick={onClose}>
      <div style={dialogStyles} onClick={(e) => e.stopPropagation()}>
        <div style={dialogTitleStyles}>Save Query</div>
        <input
          type="text"
          placeholder="Query name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyles}
          autoFocus
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ ...inputStyles, resize: 'vertical' }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--prismiq-spacing-sm)',
            fontFamily: 'var(--prismiq-font-sans)',
            fontSize: 'var(--prismiq-font-size-sm)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
          />
          Share with all users
        </label>
        <div style={dialogActionsStyles}>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!name.trim() || isSaving}
            loading={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * SavedQueryPicker component for selecting and saving queries.
 *
 * @example
 * ```tsx
 * <SavedQueryPicker
 *   currentQuery={query}
 *   onSelect={(savedQuery) => setQuery(savedQuery.query)}
 *   onSave={(savedQuery) => console.log('Saved:', savedQuery.name)}
 * />
 * ```
 */
export const SavedQueryPicker = forwardRef<HTMLDivElement, SavedQueryPickerProps>(
  function SavedQueryPicker(
    {
      currentQuery,
      onSelect,
      onSave,
      showSave = true,
      trigger,
      label = 'Saved Queries',
      style,
      className,
      ...props
    },
    ref
  ) {
    const { data, isLoading, createQuery } = useSavedQueries();
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleSelect = useCallback(
      (query: SavedQuery) => {
        onSelect?.(query);
      },
      [onSelect]
    );

    const handleSave = useCallback(
      async (name: string, description: string, isShared: boolean) => {
        if (!currentQuery) return;

        setIsSaving(true);
        try {
          const saved = await createQuery({
            name,
            description: description || undefined,
            query: currentQuery,
            is_shared: isShared,
          });
          onSave?.(saved);
          setIsSaveDialogOpen(false);
        } catch (error) {
          console.error('Failed to save query:', error);
        } finally {
          setIsSaving(false);
        }
      },
      [currentQuery, createQuery, onSave]
    );

    const triggerElement = trigger || (
      <Button variant="secondary" size="sm">
        {label}
      </Button>
    );

    const renderContent = () => {
      if (isLoading) {
        return <div style={loadingStyles}>Loading...</div>;
      }

      const queries = data || [];
      const hasQueries = queries.length > 0;

      return (
        <>
          {!hasQueries && <div style={emptyStyles}>No saved queries</div>}

          {queries.map((query) => (
            <DropdownItem
              key={query.id}
              onClick={() => handleSelect(query)}
              style={{ padding: 0 }}
            >
              <div style={queryItemStyles}>
                <div style={queryNameStyles}>
                  {query.name}
                  {query.is_shared && <span style={sharedBadgeStyles}>Shared</span>}
                </div>
                {query.description && (
                  <div style={queryDescStyles}>{query.description}</div>
                )}
              </div>
            </DropdownItem>
          ))}

          {showSave && currentQuery && (
            <>
              {hasQueries && <DropdownSeparator />}
              <DropdownItem onClick={() => setIsSaveDialogOpen(true)}>
                Save current query...
              </DropdownItem>
            </>
          )}
        </>
      );
    };

    return (
      <div ref={ref} style={{ ...containerStyles, ...style }} className={className} {...props}>
        <Dropdown trigger={triggerElement}>{renderContent()}</Dropdown>

        <SaveDialog
          isOpen={isSaveDialogOpen}
          onClose={() => setIsSaveDialogOpen(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    );
  }
);
