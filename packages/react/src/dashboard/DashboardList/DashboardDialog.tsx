/**
 * DashboardDialog component.
 *
 * Dialog for creating and editing dashboards.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import { Button } from '../../components/ui/Button';
import { Dialog, DialogFooter } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import type { Dashboard, DashboardCreate, DashboardUpdate } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface DashboardDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Called when the form is submitted. */
  onSubmit: (data: DashboardCreate | DashboardUpdate) => Promise<void>;
  /** Dashboard to edit (null for create mode). */
  dashboard?: Dashboard | null;
  /** Whether the submit action is loading. */
  isLoading?: boolean;
  /** Error message to display. */
  error?: string | null;
}

interface FormState {
  name: string;
  description: string;
  isPublic: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const formStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-lg)',
};

const fieldStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-xs)',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 500,
  color: 'var(--prismiq-color-text)',
};

const checkboxContainerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
};

const checkboxLabelStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
};

const errorStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-error-light)',
  color: 'var(--prismiq-color-error)',
  borderRadius: 'var(--prismiq-radius-md)',
  fontSize: 'var(--prismiq-font-size-sm)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Dialog for creating or editing a dashboard.
 *
 * @example
 * ```tsx
 * function DashboardsPage() {
 *   const [dialogOpen, setDialogOpen] = useState(false);
 *   const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
 *   const { createDashboard, updateDashboard, state } = useDashboardMutations();
 *
 *   const handleSubmit = async (data: DashboardCreate | DashboardUpdate) => {
 *     if (editingDashboard) {
 *       await updateDashboard(editingDashboard.id, data);
 *     } else {
 *       await createDashboard(data as DashboardCreate);
 *     }
 *     setDialogOpen(false);
 *   };
 *
 *   return (
 *     <DashboardDialog
 *       open={dialogOpen}
 *       onClose={() => setDialogOpen(false)}
 *       onSubmit={handleSubmit}
 *       dashboard={editingDashboard}
 *       isLoading={state.isLoading}
 *       error={state.error?.message}
 *     />
 *   );
 * }
 * ```
 */
export const DashboardDialog = forwardRef<HTMLDivElement, DashboardDialogProps>(
  function DashboardDialog(
    { open, onClose, onSubmit, dashboard, isLoading, error },
    _ref
  ) {
    const isEditMode = Boolean(dashboard);

    const [formState, setFormState] = useState<FormState>({
      name: '',
      description: '',
      isPublic: false,
    });

    const [validationError, setValidationError] = useState<string | null>(null);

    // Reset form when dialog opens/closes or dashboard changes
    useEffect(() => {
      if (open) {
        if (dashboard) {
          setFormState({
            name: dashboard.name,
            description: dashboard.description || '',
            isPublic: dashboard.is_public,
          });
        } else {
          setFormState({
            name: '',
            description: '',
            isPublic: false,
          });
        }
        setValidationError(null);
      }
    }, [open, dashboard]);

    const handleSubmit = useCallback(
      async (e: FormEvent) => {
        e.preventDefault();

        // Validate
        if (!formState.name.trim()) {
          setValidationError('Dashboard name is required');
          return;
        }

        setValidationError(null);

        const data: DashboardCreate | DashboardUpdate = {
          name: formState.name.trim(),
          description: formState.description.trim() || undefined,
          is_public: formState.isPublic,
        };

        try {
          await onSubmit(data);
        } catch {
          // Error is handled by parent via error prop
        }
      },
      [formState, onSubmit]
    );

    const displayError = validationError || error;

    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={isEditMode ? 'Edit Dashboard' : 'Create Dashboard'}
        description={
          isEditMode
            ? 'Update your dashboard settings.'
            : 'Create a new dashboard to visualize your data.'
        }
        width="sm"
      >
        <form onSubmit={handleSubmit} style={formStyles}>
          {displayError && <div style={errorStyles}>{displayError}</div>}

          <div style={fieldStyles}>
            <label htmlFor="dashboard-name" style={labelStyles}>
              Name
            </label>
            <Input
              id="dashboard-name"
              value={formState.name}
              onChange={(e) =>
                setFormState((s) => ({ ...s, name: e.target.value }))
              }
              placeholder="My Dashboard"
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div style={fieldStyles}>
            <label htmlFor="dashboard-description" style={labelStyles}>
              Description (optional)
            </label>
            <Input
              id="dashboard-description"
              value={formState.description}
              onChange={(e) =>
                setFormState((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="A brief description of this dashboard"
              disabled={isLoading}
            />
          </div>

          <div style={checkboxContainerStyles}>
            <Checkbox
              id="dashboard-public"
              checked={formState.isPublic}
              onChange={(e) =>
                setFormState((s) => ({ ...s, isPublic: e.target.checked }))
              }
              disabled={isLoading}
            />
            <label htmlFor="dashboard-public" style={checkboxLabelStyles}>
              Make this dashboard public
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isLoading}>
              {isEditMode ? 'Save Changes' : 'Create Dashboard'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    );
  }
);
