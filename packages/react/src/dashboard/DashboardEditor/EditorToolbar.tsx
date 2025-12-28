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

  return (
    <div style={toolbarStyle} className="prismiq-editor-toolbar">
      <div style={leftSectionStyle}>
        <h2 style={titleStyle}>{dashboardName || 'New Dashboard'}</h2>

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
