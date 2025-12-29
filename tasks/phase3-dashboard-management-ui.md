# Phase 3: Dashboard Management UI

## Overview
Add React components for creating, editing, and managing dashboards. This enables users to build their own dashboards without writing code.

## Prerequisites
- Phase 1 complete (database persistence)
- Phase 2 complete (multi-tenancy)
- E2E testing infrastructure (Phase 0)

## Validation Commands
```bash
cd packages/react && npm run build            # React builds
cd packages/react && npm run typecheck        # TypeScript passes
cd examples/demo/frontend && npm test         # E2E tests pass
```

## E2E Validation
```typescript
// User can create a dashboard via UI
test('create dashboard via UI', async ({ page }) => {
  await page.goto('/dashboards');
  await page.click('[data-testid="create-dashboard-button"]');
  await page.fill('[data-testid="dashboard-name-input"]', 'My New Dashboard');
  await page.click('[data-testid="save-dashboard-button"]');
  await expect(page.locator('text=My New Dashboard')).toBeVisible();
});
```

---

## Task 1: Dashboard List Component

**File:** `packages/react/src/dashboard/DashboardList/DashboardList.tsx`

```tsx
import React, { useState } from 'react';
import { useDashboards, useDashboardMutations } from '../../hooks';
import { Dashboard } from '../../types';
import { DashboardCard } from './DashboardCard';
import { DashboardDialog } from '../DashboardDialog/DashboardDialog';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import './DashboardList.css';

export interface DashboardListProps {
  /** Callback when a dashboard is selected */
  onSelect?: (dashboard: Dashboard) => void;
  /** Show create/edit/delete actions */
  showActions?: boolean;
  /** Custom empty state content */
  emptyState?: React.ReactNode;
  /** Additional CSS class */
  className?: string;
}

export function DashboardList({
  onSelect,
  showActions = true,
  emptyState,
  className,
}: DashboardListProps): JSX.Element {
  const { dashboards, isLoading, error, refetch } = useDashboards();
  const { deleteDashboard, isDeleting } = useDashboardMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  const handleCreate = () => {
    setEditingDashboard(null);
    setDialogOpen(true);
  };

  const handleEdit = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setDialogOpen(true);
  };

  const handleDelete = async (dashboard: Dashboard) => {
    if (confirm(`Delete "${dashboard.name}"? This cannot be undone.`)) {
      await deleteDashboard(dashboard.id);
      refetch();
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingDashboard(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className={`prismiq-dashboard-list ${className || ''}`} data-testid="dashboard-list">
        <div className="dashboard-list-header">
          <Skeleton width={200} height={32} />
        </div>
        <div className="dashboard-grid">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={150} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`prismiq-dashboard-list ${className || ''}`} data-testid="dashboard-list">
        <EmptyState
          title="Failed to load dashboards"
          description={error.message}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className={`prismiq-dashboard-list ${className || ''}`} data-testid="dashboard-list">
        {emptyState || (
          <EmptyState
            title="No dashboards yet"
            description="Create your first dashboard to get started."
            action={
              showActions && (
                <Button onClick={handleCreate} data-testid="create-dashboard-button">
                  Create Dashboard
                </Button>
              )
            }
          />
        )}
        {dialogOpen && (
          <DashboardDialog
            open={dialogOpen}
            dashboard={editingDashboard}
            onClose={handleDialogClose}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`prismiq-dashboard-list ${className || ''}`} data-testid="dashboard-list">
      <div className="dashboard-list-header">
        <h2>Dashboards</h2>
        {showActions && (
          <Button onClick={handleCreate} data-testid="create-dashboard-button">
            + New Dashboard
          </Button>
        )}
      </div>

      <div className="dashboard-grid">
        {dashboards.map((dashboard) => (
          <DashboardCard
            key={dashboard.id}
            dashboard={dashboard}
            onSelect={onSelect}
            onEdit={showActions ? handleEdit : undefined}
            onDelete={showActions ? handleDelete : undefined}
            isDeleting={isDeleting}
          />
        ))}
      </div>

      {dialogOpen && (
        <DashboardDialog
          open={dialogOpen}
          dashboard={editingDashboard}
          onClose={handleDialogClose}
        />
      )}
    </div>
  );
}
```

**File:** `packages/react/src/dashboard/DashboardList/DashboardCard.tsx`

```tsx
import React from 'react';
import { Dashboard } from '../../types';
import { Button } from '../../components/Button';
import { DropdownMenu } from '../../components/DropdownMenu';
import { formatDistanceToNow } from '../../utils/date';
import './DashboardCard.css';

interface DashboardCardProps {
  dashboard: Dashboard;
  onSelect?: (dashboard: Dashboard) => void;
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (dashboard: Dashboard) => void;
  isDeleting?: boolean;
}

export function DashboardCard({
  dashboard,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
}: DashboardCardProps): JSX.Element {
  const widgetCount = dashboard.widgets?.length || 0;

  return (
    <div
      className="prismiq-dashboard-card"
      onClick={() => onSelect?.(dashboard)}
      data-testid={`dashboard-card-${dashboard.id}`}
    >
      <div className="dashboard-card-header">
        <h3 className="dashboard-card-title">{dashboard.name}</h3>
        {(onEdit || onDelete) && (
          <DropdownMenu
            trigger={<Button variant="ghost" size="sm">⋮</Button>}
            items={[
              onEdit && {
                label: 'Edit',
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onEdit(dashboard);
                },
              },
              onDelete && {
                label: 'Delete',
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onDelete(dashboard);
                },
                variant: 'danger',
              },
            ].filter(Boolean)}
          />
        )}
      </div>

      {dashboard.description && (
        <p className="dashboard-card-description">{dashboard.description}</p>
      )}

      <div className="dashboard-card-footer">
        <span className="dashboard-card-widgets">
          {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
        </span>
        {dashboard.is_public && (
          <span className="dashboard-card-badge">Public</span>
        )}
      </div>
    </div>
  );
}
```

---

## Task 2: Dashboard Create/Edit Dialog

**File:** `packages/react/src/dashboard/DashboardDialog/DashboardDialog.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Dashboard, DashboardCreate, DashboardUpdate } from '../../types';
import { useDashboardMutations } from '../../hooks';
import { Dialog } from '../../components/Dialog';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Checkbox } from '../../components/Checkbox';
import './DashboardDialog.css';

export interface DashboardDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Dashboard to edit (null for create mode) */
  dashboard?: Dashboard | null;
  /** Called when dialog is closed */
  onClose: () => void;
  /** Called after successful save */
  onSave?: (dashboard: Dashboard) => void;
}

export function DashboardDialog({
  open,
  dashboard,
  onClose,
  onSave,
}: DashboardDialogProps): JSX.Element {
  const isEditing = !!dashboard;
  const { createDashboard, updateDashboard, isLoading, error } = useDashboardMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(dashboard?.name || '');
      setDescription(dashboard?.description || '');
      setIsPublic(dashboard?.is_public || false);
    }
  }, [open, dashboard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let saved: Dashboard;

      if (isEditing && dashboard) {
        const data: DashboardUpdate = {
          name,
          description: description || null,
          is_public: isPublic,
        };
        saved = await updateDashboard(dashboard.id, data);
      } else {
        const data: DashboardCreate = {
          name,
          description: description || undefined,
        };
        saved = await createDashboard(data);
      }

      onSave?.(saved);
      onClose();
    } catch {
      // Error is handled by hook
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Dashboard' : 'Create Dashboard'}
    >
      <form onSubmit={handleSubmit} className="dashboard-dialog-form">
        <div className="form-field">
          <label htmlFor="dashboard-name">Name *</label>
          <Input
            id="dashboard-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Dashboard"
            required
            autoFocus
            data-testid="dashboard-name-input"
          />
        </div>

        <div className="form-field">
          <label htmlFor="dashboard-description">Description</label>
          <Textarea
            id="dashboard-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            data-testid="dashboard-description-input"
          />
        </div>

        {isEditing && (
          <div className="form-field form-field-checkbox">
            <Checkbox
              id="dashboard-public"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              data-testid="dashboard-public-checkbox"
            />
            <label htmlFor="dashboard-public">
              Make this dashboard public (viewable by all users in your organization)
            </label>
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error.message}
          </div>
        )}

        <div className="dialog-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || isLoading}
            loading={isLoading}
            data-testid="save-dashboard-button"
          >
            {isEditing ? 'Save Changes' : 'Create Dashboard'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

---

## Task 3: Widget Editor Component

**File:** `packages/react/src/dashboard/WidgetEditor/WidgetEditor.tsx`

```tsx
import React, { useState } from 'react';
import { Widget, WidgetCreate, WidgetType, QueryDefinition, WidgetPosition } from '../../types';
import { WidgetTypeSelector } from './WidgetTypeSelector';
import { QueryBuilderStep } from './QueryBuilderStep';
import { VisualizationConfig } from './VisualizationConfig';
import { WidgetPreview } from './WidgetPreview';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import './WidgetEditor.css';

type EditorStep = 'type' | 'query' | 'config' | 'preview';

const STEPS: EditorStep[] = ['type', 'query', 'config', 'preview'];
const STEP_LABELS = {
  type: 'Widget Type',
  query: 'Data Query',
  config: 'Configuration',
  preview: 'Preview',
};

export interface WidgetEditorProps {
  /** Dashboard ID the widget belongs to */
  dashboardId: string;
  /** Existing widget to edit (null for create mode) */
  widget?: Widget | null;
  /** Default position for new widget */
  defaultPosition?: WidgetPosition;
  /** Called when save is clicked */
  onSave: (data: WidgetCreate) => Promise<void>;
  /** Called when cancel is clicked */
  onCancel: () => void;
}

export function WidgetEditor({
  dashboardId,
  widget,
  defaultPosition,
  onSave,
  onCancel,
}: WidgetEditorProps): JSX.Element {
  const [step, setStep] = useState<EditorStep>(widget ? 'config' : 'type');
  const [widgetType, setWidgetType] = useState<WidgetType | null>(widget?.type || null);
  const [query, setQuery] = useState<QueryDefinition | null>(widget?.query || null);
  const [config, setConfig] = useState<Record<string, any>>(widget?.config || {});
  const [title, setTitle] = useState(widget?.title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = widget?.position || defaultPosition || { x: 0, y: 0, w: 6, h: 4 };

  const handleTypeSelect = (type: WidgetType) => {
    setWidgetType(type);
    // Text widgets skip query step
    if (type === WidgetType.TEXT) {
      setStep('config');
    } else {
      setStep('query');
    }
  };

  const handleQueryComplete = (newQuery: QueryDefinition) => {
    setQuery(newQuery);
    setStep('config');
  };

  const handleConfigComplete = () => {
    setStep('preview');
  };

  const handleSave = async () => {
    if (!widgetType || !title.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const data: WidgetCreate = {
        type: widgetType,
        title: title.trim(),
        query: widgetType !== WidgetType.TEXT ? query : null,
        position,
        config,
      };

      await onSave(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save widget');
    } finally {
      setIsSaving(false);
    }
  };

  const canGoBack = step !== 'type';
  const handleBack = () => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      // Skip query step for text widgets when going back
      if (step === 'config' && widgetType === WidgetType.TEXT) {
        setStep('type');
      } else {
        setStep(STEPS[currentIndex - 1]);
      }
    }
  };

  return (
    <div className="prismiq-widget-editor" data-testid="widget-editor">
      <div className="widget-editor-header">
        <h2>{widget ? 'Edit Widget' : 'Add Widget'}</h2>
        <Stepper
          steps={STEPS.map((s) => STEP_LABELS[s])}
          currentStep={STEPS.indexOf(step)}
        />
      </div>

      <div className="widget-editor-content">
        {step === 'type' && (
          <WidgetTypeSelector
            selected={widgetType}
            onSelect={handleTypeSelect}
          />
        )}

        {step === 'query' && widgetType && widgetType !== WidgetType.TEXT && (
          <QueryBuilderStep
            query={query}
            onChange={setQuery}
            onComplete={handleQueryComplete}
          />
        )}

        {step === 'config' && widgetType && (
          <VisualizationConfig
            widgetType={widgetType}
            query={query}
            config={config}
            title={title}
            onConfigChange={setConfig}
            onTitleChange={setTitle}
            onComplete={handleConfigComplete}
          />
        )}

        {step === 'preview' && widgetType && (
          <WidgetPreview
            type={widgetType}
            title={title}
            query={query}
            config={config}
          />
        )}
      </div>

      {error && (
        <div className="widget-editor-error" role="alert">
          {error}
        </div>
      )}

      <div className="widget-editor-actions">
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>

        <div className="widget-editor-actions-right">
          {canGoBack && (
            <Button variant="secondary" onClick={handleBack} disabled={isSaving}>
              Back
            </Button>
          )}

          {step === 'preview' ? (
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={!title.trim()}
              data-testid="save-widget-button"
            >
              {widget ? 'Save Widget' : 'Add Widget'}
            </Button>
          ) : step !== 'type' && (
            <Button onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 4: Widget Type Selector

**File:** `packages/react/src/dashboard/WidgetEditor/WidgetTypeSelector.tsx`

```tsx
import React from 'react';
import { WidgetType } from '../../types';
import './WidgetTypeSelector.css';

interface WidgetTypeOption {
  type: WidgetType;
  label: string;
  description: string;
  icon: string;
  category: 'KPIs' | 'Charts' | 'Data' | 'Content';
}

const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    type: WidgetType.METRIC,
    label: 'Metric',
    description: 'Display a single key number',
    icon: '📊',
    category: 'KPIs',
  },
  {
    type: WidgetType.BAR_CHART,
    label: 'Bar Chart',
    description: 'Compare values across categories',
    icon: '📊',
    category: 'Charts',
  },
  {
    type: WidgetType.LINE_CHART,
    label: 'Line Chart',
    description: 'Show trends over time',
    icon: '📈',
    category: 'Charts',
  },
  {
    type: WidgetType.AREA_CHART,
    label: 'Area Chart',
    description: 'Visualize cumulative totals',
    icon: '📉',
    category: 'Charts',
  },
  {
    type: WidgetType.PIE_CHART,
    label: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: '🥧',
    category: 'Charts',
  },
  {
    type: WidgetType.SCATTER_CHART,
    label: 'Scatter Plot',
    description: 'Show correlation between variables',
    icon: '⚫',
    category: 'Charts',
  },
  {
    type: WidgetType.TABLE,
    label: 'Table',
    description: 'Display detailed data rows',
    icon: '📋',
    category: 'Data',
  },
  {
    type: WidgetType.TEXT,
    label: 'Text / Markdown',
    description: 'Add notes and documentation',
    icon: '📝',
    category: 'Content',
  },
];

const CATEGORIES = ['KPIs', 'Charts', 'Data', 'Content'] as const;

interface WidgetTypeSelectorProps {
  selected: WidgetType | null;
  onSelect: (type: WidgetType) => void;
}

export function WidgetTypeSelector({
  selected,
  onSelect,
}: WidgetTypeSelectorProps): JSX.Element {
  const grouped = CATEGORIES.reduce((acc, category) => {
    acc[category] = WIDGET_TYPES.filter((w) => w.category === category);
    return acc;
  }, {} as Record<string, WidgetTypeOption[]>);

  return (
    <div className="widget-type-selector" data-testid="widget-type-selector">
      <h3>Choose a widget type</h3>

      {CATEGORIES.map((category) => (
        <div key={category} className="widget-type-category">
          <h4>{category}</h4>
          <div className="widget-type-grid">
            {grouped[category].map((option) => (
              <button
                key={option.type}
                type="button"
                className={`widget-type-card ${selected === option.type ? 'selected' : ''}`}
                onClick={() => onSelect(option.type)}
                data-testid={`widget-type-${option.type}`}
              >
                <span className="widget-type-icon">{option.icon}</span>
                <span className="widget-type-label">{option.label}</span>
                <span className="widget-type-description">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Task 5: Visualization Configuration

**File:** `packages/react/src/dashboard/WidgetEditor/VisualizationConfig.tsx`

```tsx
import React from 'react';
import { WidgetType, QueryDefinition } from '../../types';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Checkbox } from '../../components/Checkbox';
import { Textarea } from '../../components/Textarea';
import './VisualizationConfig.css';

interface VisualizationConfigProps {
  widgetType: WidgetType;
  query: QueryDefinition | null;
  config: Record<string, any>;
  title: string;
  onConfigChange: (config: Record<string, any>) => void;
  onTitleChange: (title: string) => void;
  onComplete: () => void;
}

export function VisualizationConfig({
  widgetType,
  query,
  config,
  title,
  onConfigChange,
  onTitleChange,
  onComplete,
}: VisualizationConfigProps): JSX.Element {
  // Get available columns from query
  const columns = query?.columns?.map((c) => c.alias || c.column) || [];

  const updateConfig = (key: string, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const renderChartConfig = () => (
    <>
      {columns.length > 0 && (
        <>
          <div className="config-field">
            <label>X-Axis Column</label>
            <Select
              value={config.xAxis || columns[0]}
              onChange={(e) => updateConfig('xAxis', e.target.value)}
            >
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </Select>
          </div>

          <div className="config-field">
            <label>Y-Axis Column</label>
            <Select
              value={config.yAxis || (columns[1] || columns[0])}
              onChange={(e) => updateConfig('yAxis', e.target.value)}
            >
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </Select>
          </div>
        </>
      )}

      {widgetType === WidgetType.BAR_CHART && (
        <>
          <div className="config-field">
            <label>Orientation</label>
            <Select
              value={config.orientation || 'vertical'}
              onChange={(e) => updateConfig('orientation', e.target.value)}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </Select>
          </div>

          <div className="config-field-checkbox">
            <Checkbox
              checked={config.stacked || false}
              onChange={(e) => updateConfig('stacked', e.target.checked)}
            />
            <label>Stack bars</label>
          </div>
        </>
      )}

      {(widgetType === WidgetType.LINE_CHART || widgetType === WidgetType.AREA_CHART) && (
        <div className="config-field-checkbox">
          <Checkbox
            checked={config.showPoints || false}
            onChange={(e) => updateConfig('showPoints', e.target.checked)}
          />
          <label>Show data points</label>
        </div>
      )}

      {widgetType === WidgetType.PIE_CHART && (
        <div className="config-field-checkbox">
          <Checkbox
            checked={config.donut || false}
            onChange={(e) => updateConfig('donut', e.target.checked)}
          />
          <label>Donut style</label>
        </div>
      )}
    </>
  );

  const renderMetricConfig = () => (
    <>
      {columns.length > 0 && (
        <div className="config-field">
          <label>Value Column</label>
          <Select
            value={config.valueColumn || columns[0]}
            onChange={(e) => updateConfig('valueColumn', e.target.value)}
          >
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="config-field">
        <label>Number Format</label>
        <Select
          value={config.format || 'number'}
          onChange={(e) => updateConfig('format', e.target.value)}
        >
          <option value="number">Number</option>
          <option value="currency">Currency ($)</option>
          <option value="percent">Percentage (%)</option>
          <option value="compact">Compact (1.2K, 3.4M)</option>
        </Select>
      </div>

      <div className="config-field-checkbox">
        <Checkbox
          checked={config.showTrend || false}
          onChange={(e) => updateConfig('showTrend', e.target.checked)}
        />
        <label>Show trend indicator</label>
      </div>
    </>
  );

  const renderTableConfig = () => (
    <>
      <div className="config-field-checkbox">
        <Checkbox
          checked={config.striped || true}
          onChange={(e) => updateConfig('striped', e.target.checked)}
        />
        <label>Striped rows</label>
      </div>

      <div className="config-field-checkbox">
        <Checkbox
          checked={config.sortable || true}
          onChange={(e) => updateConfig('sortable', e.target.checked)}
        />
        <label>Allow column sorting</label>
      </div>

      <div className="config-field">
        <label>Rows per page</label>
        <Select
          value={config.pageSize || 10}
          onChange={(e) => updateConfig('pageSize', parseInt(e.target.value))}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </Select>
      </div>
    </>
  );

  const renderTextConfig = () => (
    <div className="config-field">
      <label>Content (Markdown supported)</label>
      <Textarea
        value={config.content || ''}
        onChange={(e) => updateConfig('content', e.target.value)}
        placeholder="Enter your text content here..."
        rows={8}
        data-testid="text-content-input"
      />
    </div>
  );

  return (
    <div className="visualization-config" data-testid="visualization-config">
      <div className="config-section">
        <h4>Widget Title</h4>
        <div className="config-field">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter widget title..."
            required
            data-testid="widget-title-input"
          />
        </div>
      </div>

      <div className="config-section">
        <h4>Display Options</h4>

        {widgetType === WidgetType.TEXT && renderTextConfig()}
        {widgetType === WidgetType.METRIC && renderMetricConfig()}
        {widgetType === WidgetType.TABLE && renderTableConfig()}
        {[WidgetType.BAR_CHART, WidgetType.LINE_CHART, WidgetType.AREA_CHART, WidgetType.PIE_CHART, WidgetType.SCATTER_CHART].includes(widgetType) && renderChartConfig()}
      </div>

      <div className="config-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onComplete}
          disabled={!title.trim()}
        >
          Preview Widget
        </button>
      </div>
    </div>
  );
}
```

---

## Task 6: useDashboardMutations Hook

**File:** `packages/react/src/hooks/useDashboardMutations.ts`

```tsx
import { useState, useCallback } from 'react';
import { useAnalytics } from '../context/AnalyticsProvider';
import {
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  Widget,
  WidgetCreate,
  WidgetUpdate,
  WidgetPositionUpdate,
} from '../types';

interface UseDashboardMutationsResult {
  // Dashboard mutations
  createDashboard: (data: DashboardCreate) => Promise<Dashboard>;
  updateDashboard: (id: string, data: DashboardUpdate) => Promise<Dashboard>;
  deleteDashboard: (id: string) => Promise<void>;

  // Widget mutations
  addWidget: (dashboardId: string, data: WidgetCreate) => Promise<Widget>;
  updateWidget: (dashboardId: string, widgetId: string, data: WidgetUpdate) => Promise<Widget>;
  deleteWidget: (dashboardId: string, widgetId: string) => Promise<void>;
  updateWidgetPositions: (dashboardId: string, positions: WidgetPositionUpdate[]) => Promise<void>;

  // Utility
  duplicateWidget: (dashboardId: string, widget: Widget) => Promise<Widget>;

  // State
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: Error | null;
}

export function useDashboardMutations(): UseDashboardMutationsResult {
  const { client } = useAnalytics();

  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isLoading = isCreating || isUpdating || isDeleting;

  // Dashboard mutations
  const createDashboard = useCallback(async (data: DashboardCreate): Promise<Dashboard> => {
    setIsCreating(true);
    setError(null);
    try {
      const dashboard = await client.createDashboard(data);
      return dashboard;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to create dashboard');
      setError(err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [client]);

  const updateDashboard = useCallback(async (id: string, data: DashboardUpdate): Promise<Dashboard> => {
    setIsUpdating(true);
    setError(null);
    try {
      const dashboard = await client.updateDashboard(id, data);
      return dashboard;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to update dashboard');
      setError(err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [client]);

  const deleteDashboard = useCallback(async (id: string): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await client.deleteDashboard(id);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to delete dashboard');
      setError(err);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [client]);

  // Widget mutations
  const addWidget = useCallback(async (dashboardId: string, data: WidgetCreate): Promise<Widget> => {
    setIsCreating(true);
    setError(null);
    try {
      const widget = await client.addWidget(dashboardId, data);
      return widget;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to add widget');
      setError(err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [client]);

  const updateWidget = useCallback(async (
    dashboardId: string,
    widgetId: string,
    data: WidgetUpdate
  ): Promise<Widget> => {
    setIsUpdating(true);
    setError(null);
    try {
      const widget = await client.updateWidget(dashboardId, widgetId, data);
      return widget;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to update widget');
      setError(err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [client]);

  const deleteWidget = useCallback(async (dashboardId: string, widgetId: string): Promise<void> => {
    setIsDeleting(true);
    setError(null);
    try {
      await client.deleteWidget(dashboardId, widgetId);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to delete widget');
      setError(err);
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [client]);

  const updateWidgetPositions = useCallback(async (
    dashboardId: string,
    positions: WidgetPositionUpdate[]
  ): Promise<void> => {
    setIsUpdating(true);
    setError(null);
    try {
      await client.updateLayout(dashboardId, positions);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to update positions');
      setError(err);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [client]);

  const duplicateWidget = useCallback(async (
    dashboardId: string,
    widget: Widget
  ): Promise<Widget> => {
    const data: WidgetCreate = {
      type: widget.type,
      title: `${widget.title} (copy)`,
      query: widget.query,
      position: {
        x: widget.position.x,
        y: widget.position.y + widget.position.h, // Place below original
        w: widget.position.w,
        h: widget.position.h,
      },
      config: widget.config,
    };
    return addWidget(dashboardId, data);
  }, [addWidget]);

  return {
    createDashboard,
    updateDashboard,
    deleteDashboard,
    addWidget,
    updateWidget,
    deleteWidget,
    updateWidgetPositions,
    duplicateWidget,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
  };
}
```

---

## Task 7: Dashboard Edit Mode

**File:** Update `packages/react/src/dashboard/Dashboard.tsx`

Add edit mode functionality:

```tsx
interface DashboardProps {
  id: string;
  /** Enable edit mode (drag, resize, add/remove widgets) */
  editable?: boolean;
  showFilters?: boolean;
  showTitle?: boolean;
  refreshInterval?: number;
  className?: string;
}

export function Dashboard({
  id,
  editable = false,
  showFilters = true,
  showTitle = true,
  refreshInterval,
  className,
}: DashboardProps): JSX.Element {
  const { dashboard, widgets, isLoading, error, refetch } = useDashboard(id);
  const { addWidget, deleteWidget, updateWidgetPositions } = useDashboardMutations();

  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  const handleLayoutChange = useCallback((layout: Layout[]) => {
    if (!editable) return;

    const positions = layout.map((item) => ({
      widget_id: item.i,
      position: { x: item.x, y: item.y, w: item.w, h: item.h },
    }));

    updateWidgetPositions(id, positions);
  }, [id, editable, updateWidgetPositions]);

  const handleAddWidget = async (data: WidgetCreate) => {
    await addWidget(id, data);
    setWidgetEditorOpen(false);
    refetch();
  };

  const handleEditWidget = (widget: Widget) => {
    setEditingWidget(widget);
    setWidgetEditorOpen(true);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (confirm('Delete this widget?')) {
      await deleteWidget(id, widgetId);
      refetch();
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <div className="prismiq-dashboard-error" data-testid="dashboard-error">
        <EmptyState
          title="Failed to load dashboard"
          description={error?.message || 'Dashboard not found'}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <DashboardProvider id={id}>
      <div
        className={`prismiq-dashboard ${editable ? 'editable' : ''} ${className || ''}`}
        data-testid="dashboard-container"
      >
        {showTitle && (
          <div className="dashboard-header">
            <h1>{dashboard.name}</h1>
            {dashboard.description && <p>{dashboard.description}</p>}
          </div>
        )}

        {showFilters && dashboard.filters.length > 0 && (
          <FilterBar filters={dashboard.filters} />
        )}

        {editable && (
          <div className="dashboard-toolbar">
            <Button
              onClick={() => {
                setEditingWidget(null);
                setWidgetEditorOpen(true);
              }}
              data-testid="add-widget-button"
            >
              + Add Widget
            </Button>
          </div>
        )}

        <DashboardLayout
          widgets={widgets}
          editable={editable}
          onLayoutChange={handleLayoutChange}
          onWidgetEdit={editable ? handleEditWidget : undefined}
          onWidgetDelete={editable ? handleDeleteWidget : undefined}
        />

        {widgetEditorOpen && (
          <Dialog open onClose={() => setWidgetEditorOpen(false)} size="large">
            <WidgetEditor
              dashboardId={id}
              widget={editingWidget}
              onSave={handleAddWidget}
              onCancel={() => setWidgetEditorOpen(false)}
            />
          </Dialog>
        )}
      </div>
    </DashboardProvider>
  );
}
```

---

## Task 8: E2E Dashboard Management Tests

**File:** `examples/demo/frontend/e2e/dashboard-management.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboards list
    await page.goto('/dashboards');
  });

  test('displays dashboard list', async ({ page }) => {
    await expect(page.locator('[data-testid="dashboard-list"]')).toBeVisible();
  });

  test('create new dashboard via dialog', async ({ page }) => {
    // Click create button
    await page.click('[data-testid="create-dashboard-button"]');

    // Fill in details
    const dashboardName = `Test Dashboard ${Date.now()}`;
    await page.fill('[data-testid="dashboard-name-input"]', dashboardName);
    await page.fill('[data-testid="dashboard-description-input"]', 'Created by E2E test');

    // Save
    await page.click('[data-testid="save-dashboard-button"]');

    // Verify dashboard appears in list
    await expect(page.locator(`text=${dashboardName}`)).toBeVisible();
  });

  test('edit dashboard name', async ({ page }) => {
    // First create a dashboard
    await page.click('[data-testid="create-dashboard-button"]');
    const originalName = `Edit Test ${Date.now()}`;
    await page.fill('[data-testid="dashboard-name-input"]', originalName);
    await page.click('[data-testid="save-dashboard-button"]');

    // Click edit on the dashboard card
    await page.click(`[data-testid="dashboard-card-${originalName}"] [data-testid="edit-button"]`);

    // Change name
    const newName = `${originalName} - Edited`;
    await page.fill('[data-testid="dashboard-name-input"]', newName);
    await page.click('[data-testid="save-dashboard-button"]');

    // Verify new name appears
    await expect(page.locator(`text=${newName}`)).toBeVisible();
  });

  test('delete dashboard', async ({ page }) => {
    // Create a dashboard
    await page.click('[data-testid="create-dashboard-button"]');
    const dashboardName = `Delete Test ${Date.now()}`;
    await page.fill('[data-testid="dashboard-name-input"]', dashboardName);
    await page.click('[data-testid="save-dashboard-button"]');

    // Wait for it to appear
    await expect(page.locator(`text=${dashboardName}`)).toBeVisible();

    // Click delete
    page.on('dialog', (dialog) => dialog.accept());
    await page.click(`[data-testid="dashboard-card-${dashboardName}"] [data-testid="delete-button"]`);

    // Verify it's gone
    await expect(page.locator(`text=${dashboardName}`)).not.toBeVisible();
  });
});

test.describe('Widget Editor', () => {
  test('add metric widget to dashboard', async ({ page }) => {
    // Navigate to editable dashboard
    await page.goto('/dashboard/sales-overview?edit=true');

    // Click add widget
    await page.click('[data-testid="add-widget-button"]');

    // Select metric type
    await page.click('[data-testid="widget-type-metric"]');

    // Configure query (simplified - might need schema loading)
    await page.click('[data-testid="next-step"]');

    // Set title and options
    await page.fill('[data-testid="widget-title-input"]', 'New Metric Widget');
    await page.click('[data-testid="next-step"]');

    // Save widget
    await page.click('[data-testid="save-widget-button"]');

    // Verify widget appears
    await expect(page.locator('text=New Metric Widget')).toBeVisible();
  });

  test('delete widget from dashboard', async ({ page }) => {
    // Navigate to editable dashboard
    await page.goto('/dashboard/sales-overview?edit=true');

    // Find first widget's delete button
    const firstWidget = page.locator('[data-testid^="widget-"]').first();
    const widgetTitle = await firstWidget.locator('.widget-title').textContent();

    // Delete it
    page.on('dialog', (dialog) => dialog.accept());
    await firstWidget.locator('[data-testid="delete-widget-button"]').click();

    // Verify it's gone
    await expect(page.locator(`text=${widgetTitle}`)).not.toBeVisible();
  });
});
```

---

## Task 9: Demo App Dashboard Management Page

**File:** `examples/demo/frontend/src/pages/DashboardsPage.tsx`

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardList } from '@prismiq/react';

export function DashboardsPage(): JSX.Element {
  const navigate = useNavigate();

  const handleSelectDashboard = (dashboard: Dashboard) => {
    navigate(`/dashboard/${dashboard.id}`);
  };

  return (
    <div className="dashboards-page">
      <DashboardList
        onSelect={handleSelectDashboard}
        showActions={true}
      />
    </div>
  );
}
```

**Update:** `examples/demo/frontend/src/App.tsx`

Add routes for dashboard management:

```tsx
<Route path="dashboards" element={<DashboardsPage />} />
<Route path="dashboard/:id" element={<DashboardPage />} />
```

---

## Completion Criteria

- [ ] `DashboardList` component displays all tenant dashboards
- [ ] `DashboardCard` shows name, description, widget count
- [ ] `DashboardDialog` allows creating new dashboards
- [ ] `DashboardDialog` allows editing existing dashboards
- [ ] Delete dashboard with confirmation
- [ ] `WidgetEditor` with 4-step wizard (type, query, config, preview)
- [ ] `WidgetTypeSelector` shows all 8 widget types
- [ ] `VisualizationConfig` provides type-specific options
- [ ] `useDashboardMutations` hook for all CRUD operations
- [ ] `Dashboard` component `editable` prop enables edit mode
- [ ] Add Widget button opens WidgetEditor
- [ ] Edit/Delete buttons on widgets in edit mode
- [ ] All components have data-testid attributes
- [ ] Demo app has `/dashboards` route
- [ ] E2E tests pass for dashboard CRUD
- [ ] E2E tests pass for widget CRUD
