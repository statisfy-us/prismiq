/**
 * Dashboard editor toolbar component.
 */

import { useTheme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';

/**
 * Props for EditorToolbar component.
 */
export interface EditorToolbarProps {
  /** Dashboard name. */
  dashboardName: string;
  /** Callback when dashboard name changes. */
  onNameChange?: (name: string) => void;
  /** Whether there are unsaved changes. */
  hasChanges: boolean;
  /** Whether save is in progress. */
  isSaving: boolean;
  /** Callback when add widget is clicked. */
  onAddWidget: () => void;
  /** Callback when edit filters is clicked. */
  onEditFilters?: () => void;
  /** Callback when settings is clicked. */
  onSettings?: () => void;
  /** Callback when save is clicked. */
  onSave: () => void;
  /** Callback when cancel is clicked. */
  onCancel: () => void;
}

/**
 * Editor toolbar with actions for dashboard editing.
 */
export function EditorToolbar({
  dashboardName,
  onNameChange,
  hasChanges,
  isSaving,
  onAddWidget,
  onEditFilters,
  onSettings,
  onSave,
  onCancel,
}: EditorToolbarProps): JSX.Element {
  const { theme } = useTheme();

  const toolbarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const leftSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const rightSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const unsavedStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.warning,
    marginRight: theme.spacing.sm,
  };

  const titleInputStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    outline: 'none',
    minWidth: '200px',
  };

  return (
    <div style={toolbarStyle} className="prismiq-editor-toolbar">
      <div style={leftSectionStyle}>
        {onNameChange ? (
          <input
            type="text"
            id="dashboard-title-input"
            data-testid="dashboard-title-input"
            aria-label="Dashboard title"
            value={dashboardName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Dashboard name"
            style={titleInputStyle}
          />
        ) : (
          <h2 style={titleStyle}>{dashboardName || 'New Dashboard'}</h2>
        )}

        <div style={actionsStyle}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddWidget}
          >
            <Icon name="plus" size={16} />
            <span style={{ marginLeft: theme.spacing.xs }}>Add Widget</span>
          </Button>

          {onEditFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditFilters}
            >
              <Icon name="filter" size={16} />
              <span style={{ marginLeft: theme.spacing.xs }}>Filters</span>
            </Button>
          )}

          {onSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
            >
              <Icon name="settings" size={16} />
              <span style={{ marginLeft: theme.spacing.xs }}>Settings</span>
            </Button>
          )}
        </div>
      </div>

      <div style={rightSectionStyle}>
        {hasChanges && (
          <span style={unsavedStyle}>Unsaved changes</span>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
