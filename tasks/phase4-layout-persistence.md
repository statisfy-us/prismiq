# Phase 4: Layout Persistence

## Overview
Persist drag-drop layout changes to the database with debounced saves and visual feedback.

## Prerequisites
- Phase 1 complete (database persistence)
- Phase 2 complete (multi-tenancy)
- Phase 3 complete (dashboard management UI)
- E2E testing infrastructure (Phase 0)

## Validation Commands
```bash
cd packages/react && npm run build            # React builds
cd examples/demo/frontend && npm test         # E2E tests pass
```

## E2E Validation
```typescript
// Layout changes persist after page reload
test('layout persists after reload', async ({ page }) => {
  await page.goto('/dashboard/test?edit=true');

  // Drag widget to new position
  await page.drag('[data-testid="widget-1"]', { target: { x: 100, y: 200 } });

  // Wait for save indicator
  await expect(page.locator('[data-testid="save-indicator"]')).toHaveText('Saved');

  // Reload and verify position
  await page.reload();
  const widget = page.locator('[data-testid="widget-1"]');
  const box = await widget.boundingBox();
  expect(box?.x).toBeCloseTo(100, 10);
});
```

---

## Task 1: Batch Position Update Endpoint

The endpoint already exists in `api.py`. Ensure it's properly implemented:

**File:** Verify `packages/python/prismiq/api.py`

```python
from pydantic import BaseModel

class WidgetPositionUpdate(BaseModel):
    """Single widget position update."""
    widget_id: str
    position: WidgetPosition

@router.patch("/dashboards/{dashboard_id}/layout")
async def update_layout(
    dashboard_id: str,
    positions: list[WidgetPositionUpdate],
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, str]:
    """Update widget positions in a dashboard."""
    dashboard = await engine.dashboards.get_dashboard(
        dashboard_id=dashboard_id,
        tenant_id=auth.tenant_id,
    )
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    if not can_edit_dashboard(dashboard, auth.user_id):
        raise HTTPException(status_code=403, detail="Permission denied")

    success = await engine.dashboards.update_widget_positions(
        dashboard_id=dashboard_id,
        positions=[p.model_dump() for p in positions],
        tenant_id=auth.tenant_id,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update layout")

    return {"status": "ok"}
```

---

## Task 2: Debounced Layout Updates Hook

**File:** `packages/react/src/hooks/useDebouncedLayoutSave.ts`

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDashboardMutations } from './useDashboardMutations';
import { WidgetPositionUpdate } from '../types';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseDebouncedLayoutSaveOptions {
  /** Dashboard ID */
  dashboardId: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** How long to show "Saved" status */
  savedDurationMs?: number;
  /** Callback on save success */
  onSave?: () => void;
  /** Callback on save error */
  onError?: (error: Error) => void;
}

interface UseDebouncedLayoutSaveResult {
  /** Queue a layout update */
  queueUpdate: (positions: WidgetPositionUpdate[]) => void;
  /** Current save status */
  status: SaveStatus;
  /** Last error if any */
  error: Error | null;
  /** Force save immediately */
  flush: () => Promise<void>;
  /** Cancel pending save */
  cancel: () => void;
}

export function useDebouncedLayoutSave({
  dashboardId,
  debounceMs = 500,
  savedDurationMs = 2000,
  onSave,
  onError,
}: UseDebouncedLayoutSaveOptions): UseDebouncedLayoutSaveResult {
  const { updateWidgetPositions } = useDashboardMutations();

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Track pending positions
  const pendingRef = useRef<WidgetPositionUpdate[] | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const save = useCallback(async (positions: WidgetPositionUpdate[]) => {
    setStatus('saving');
    setError(null);

    try {
      await updateWidgetPositions(dashboardId, positions);

      setStatus('saved');
      onSave?.();

      // Reset to idle after showing "Saved"
      savedTimeoutRef.current = setTimeout(() => {
        setStatus('idle');
      }, savedDurationMs);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to save layout');
      setStatus('error');
      setError(err);
      onError?.(err);
    }
  }, [dashboardId, updateWidgetPositions, savedDurationMs, onSave, onError]);

  const queueUpdate = useCallback((positions: WidgetPositionUpdate[]) => {
    pendingRef.current = positions;
    setStatus('pending');

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule save
    timeoutRef.current = setTimeout(() => {
      if (pendingRef.current) {
        save(pendingRef.current);
        pendingRef.current = null;
      }
    }, debounceMs);
  }, [debounceMs, save]);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingRef.current) {
      const positions = pendingRef.current;
      pendingRef.current = null;
      await save(positions);
    }
  }, [save]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = null;
    setStatus('idle');
  }, []);

  return {
    queueUpdate,
    status,
    error,
    flush,
    cancel,
  };
}
```

---

## Task 3: Auto-Save Indicator Component

**File:** `packages/react/src/components/AutoSaveIndicator/AutoSaveIndicator.tsx`

```tsx
import React from 'react';
import { SaveStatus } from '../../hooks/useDebouncedLayoutSave';
import './AutoSaveIndicator.css';

interface AutoSaveIndicatorProps {
  /** Current save status */
  status: SaveStatus;
  /** Error message if status is error */
  error?: Error | null;
  /** Additional CSS class */
  className?: string;
}

export function AutoSaveIndicator({
  status,
  error,
  className,
}: AutoSaveIndicatorProps): JSX.Element | null {
  // Don't render when idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div
      className={`prismiq-autosave-indicator ${status} ${className || ''}`}
      data-testid="save-indicator"
      role="status"
      aria-live="polite"
    >
      {status === 'pending' && (
        <>
          <span className="indicator-dot pending" />
          <span className="indicator-text">Unsaved changes</span>
        </>
      )}

      {status === 'saving' && (
        <>
          <span className="indicator-spinner" />
          <span className="indicator-text">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <span className="indicator-icon saved">✓</span>
          <span className="indicator-text">Saved</span>
        </>
      )}

      {status === 'error' && (
        <>
          <span className="indicator-icon error">!</span>
          <span className="indicator-text" title={error?.message}>
            Error saving
          </span>
        </>
      )}
    </div>
  );
}
```

**File:** `packages/react/src/components/AutoSaveIndicator/AutoSaveIndicator.css`

```css
.prismiq-autosave-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
  transition: opacity 0.2s, background-color 0.2s;
}

.prismiq-autosave-indicator.pending {
  background-color: var(--prismiq-warning-bg, #fef3cd);
  color: var(--prismiq-warning-text, #856404);
}

.prismiq-autosave-indicator.saving {
  background-color: var(--prismiq-info-bg, #cce5ff);
  color: var(--prismiq-info-text, #004085);
}

.prismiq-autosave-indicator.saved {
  background-color: var(--prismiq-success-bg, #d4edda);
  color: var(--prismiq-success-text, #155724);
}

.prismiq-autosave-indicator.error {
  background-color: var(--prismiq-error-bg, #f8d7da);
  color: var(--prismiq-error-text, #721c24);
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
}

.indicator-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.indicator-icon {
  font-weight: bold;
}

.indicator-icon.saved {
  color: var(--prismiq-success-text, #155724);
}

.indicator-icon.error {
  color: var(--prismiq-error-text, #721c24);
}
```

---

## Task 4: Update DashboardLayout with Auto-Save

**File:** Update `packages/react/src/dashboard/DashboardLayout/DashboardLayout.tsx`

```tsx
import React, { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Widget, WidgetPositionUpdate } from '../../types';
import { WidgetContainer } from '../Widget/WidgetContainer';
import { useDebouncedLayoutSave, SaveStatus } from '../../hooks/useDebouncedLayoutSave';
import { AutoSaveIndicator } from '../../components/AutoSaveIndicator/AutoSaveIndicator';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './DashboardLayout.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardLayoutProps {
  /** Dashboard ID for saving */
  dashboardId: string;
  /** Widgets to render */
  widgets: Widget[];
  /** Enable editing (drag, resize) */
  editable?: boolean;
  /** Layout configuration */
  columns?: number;
  rowHeight?: number;
  margin?: [number, number];
  /** Callbacks */
  onWidgetEdit?: (widget: Widget) => void;
  onWidgetDelete?: (widgetId: string) => void;
  /** Custom class */
  className?: string;
}

export function DashboardLayout({
  dashboardId,
  widgets,
  editable = false,
  columns = 12,
  rowHeight = 50,
  margin = [10, 10],
  onWidgetEdit,
  onWidgetDelete,
  className,
}: DashboardLayoutProps): JSX.Element {
  // Debounced save hook
  const { queueUpdate, status, error } = useDebouncedLayoutSave({
    dashboardId,
    debounceMs: 500,
    savedDurationMs: 2000,
  });

  // Convert widgets to react-grid-layout format
  const layout = useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.w,
        h: widget.position.h,
        minW: 2,
        minH: 2,
      })),
    [widgets]
  );

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      if (!editable) return;

      // Convert to our format and queue save
      const positions: WidgetPositionUpdate[] = newLayout.map((item) => ({
        widget_id: item.i,
        position: {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        },
      }));

      queueUpdate(positions);
    },
    [editable, queueUpdate]
  );

  return (
    <div className={`prismiq-dashboard-layout ${className || ''}`}>
      {editable && (
        <div className="dashboard-layout-status">
          <AutoSaveIndicator status={status} error={error} />
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: columns, md: columns, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={rowHeight}
        margin={margin}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
        resizeHandles={['se']}
      >
        {widgets.map((widget) => (
          <div key={widget.id} data-testid={`widget-${widget.id}`}>
            <WidgetContainer
              widget={widget}
              dashboardId={dashboardId}
              editable={editable}
              onEdit={onWidgetEdit}
              onDelete={onWidgetDelete}
            />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
```

---

## Task 5: Widget Container with Edit Controls

**File:** `packages/react/src/dashboard/Widget/WidgetContainer.tsx`

```tsx
import React, { useState } from 'react';
import { Widget } from '../../types';
import { WidgetHeader } from './WidgetHeader';
import { WidgetContent } from './WidgetContent';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import { Button } from '../../components/Button';
import { DropdownMenu } from '../../components/DropdownMenu';
import './WidgetContainer.css';

interface WidgetContainerProps {
  widget: Widget;
  dashboardId: string;
  editable?: boolean;
  onEdit?: (widget: Widget) => void;
  onDelete?: (widgetId: string) => void;
}

export function WidgetContainer({
  widget,
  dashboardId,
  editable = false,
  onEdit,
  onDelete,
}: WidgetContainerProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`prismiq-widget-container ${editable ? 'editable' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`widget-container-${widget.id}`}
    >
      {/* Drag handle for react-grid-layout */}
      {editable && (
        <div className="widget-drag-handle" title="Drag to move">
          ⋮⋮
        </div>
      )}

      {/* Widget content */}
      <WidgetErrorBoundary widgetId={widget.id}>
        <WidgetHeader
          title={widget.title}
          type={widget.type}
          showActions={!editable}
        />
        <WidgetContent
          widget={widget}
          dashboardId={dashboardId}
        />
      </WidgetErrorBoundary>

      {/* Edit controls overlay */}
      {editable && isHovered && (
        <div className="widget-edit-overlay">
          <div className="widget-edit-actions">
            {onEdit && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onEdit(widget)}
                data-testid="edit-widget-button"
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onDelete(widget.id)}
                data-testid="delete-widget-button"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**File:** `packages/react/src/dashboard/Widget/WidgetContainer.css`

```css
.prismiq-widget-container {
  position: relative;
  height: 100%;
  background: var(--prismiq-widget-bg, #fff);
  border: 1px solid var(--prismiq-border, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.prismiq-widget-container.editable {
  cursor: default;
}

.widget-drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--prismiq-muted, #f3f4f6);
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
  font-size: 12px;
  color: var(--prismiq-text-muted, #6b7280);
}

.prismiq-widget-container:hover .widget-drag-handle {
  opacity: 1;
}

.widget-drag-handle:active {
  cursor: grabbing;
}

.widget-edit-overlay {
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  z-index: 20;
}

.widget-edit-actions {
  display: flex;
  gap: 8px;
}

/* Resize handle styling */
.react-resizable-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  bottom: 0;
  right: 0;
  cursor: se-resize;
  background: transparent;
}

.prismiq-widget-container.editable .react-resizable-handle::after {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--prismiq-border, #e5e7eb);
  border-bottom: 2px solid var(--prismiq-border, #e5e7eb);
}
```

---

## Task 6: Optimistic Updates

**File:** `packages/react/src/hooks/useDashboard.ts`

Update to support optimistic position updates:

```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAnalytics } from '../context/AnalyticsProvider';
import { Dashboard, Widget, WidgetPositionUpdate } from '../types';

interface UseDashboardResult {
  dashboard: Dashboard | null;
  widgets: Widget[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  /** Optimistically update widget positions */
  updatePositionsOptimistic: (positions: WidgetPositionUpdate[]) => void;
}

export function useDashboard(id: string): UseDashboardResult {
  const { client } = useAnalytics();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track optimistic positions
  const optimisticPositionsRef = useRef<Map<string, WidgetPositionUpdate['position']>>(new Map());

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await client.getDashboard(id);
      setDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load dashboard'));
    } finally {
      setIsLoading(false);
    }
  }, [client, id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Apply optimistic positions to widgets
  const widgets = useMemo(() => {
    if (!dashboard?.widgets) return [];

    return dashboard.widgets.map((widget) => {
      const optimisticPos = optimisticPositionsRef.current.get(widget.id);
      if (optimisticPos) {
        return {
          ...widget,
          position: optimisticPos,
        };
      }
      return widget;
    });
  }, [dashboard?.widgets]);

  const updatePositionsOptimistic = useCallback((positions: WidgetPositionUpdate[]) => {
    // Store optimistic positions
    positions.forEach((p) => {
      optimisticPositionsRef.current.set(p.widget_id, p.position);
    });

    // Force re-render by updating dashboard reference
    setDashboard((prev) => (prev ? { ...prev } : null));
  }, []);

  return {
    dashboard,
    widgets,
    isLoading,
    error,
    refetch: fetchDashboard,
    updatePositionsOptimistic,
  };
}
```

---

## Task 7: E2E Layout Persistence Tests

**File:** `examples/demo/frontend/e2e/layout-persistence.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Layout Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a fresh dashboard
    await page.goto('/dashboard/sales-overview?edit=true');
    await page.waitForSelector('[data-testid="dashboard-container"]');
  });

  test('shows pending indicator when layout changes', async ({ page }) => {
    // Drag a widget
    const widget = page.locator('[data-testid^="widget-container-"]').first();
    await widget.hover();

    const dragHandle = widget.locator('.widget-drag-handle');
    await dragHandle.dragTo(page.locator('.prismiq-dashboard-layout'), {
      targetPosition: { x: 200, y: 100 },
    });

    // Should show pending indicator
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Unsaved');
  });

  test('shows saving then saved indicator', async ({ page }) => {
    // Drag a widget
    const widget = page.locator('[data-testid^="widget-container-"]').first();
    const dragHandle = widget.locator('.widget-drag-handle');
    await dragHandle.dragTo(page.locator('.prismiq-dashboard-layout'), {
      targetPosition: { x: 200, y: 100 },
    });

    // Wait for save to complete
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saving', {
      timeout: 1000,
    });
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saved', {
      timeout: 5000,
    });
  });

  test('layout persists after page reload', async ({ page, request }) => {
    // Create a test dashboard
    const createResponse = await request.post('http://localhost:8000/api/dashboards', {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
      data: { name: `Layout Test ${Date.now()}` },
    });
    const dashboard = await createResponse.json();

    // Add a widget
    await request.post(`http://localhost:8000/api/dashboards/${dashboard.id}/widgets`, {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
      data: {
        type: 'metric',
        title: 'Test Widget',
        position: { x: 0, y: 0, w: 3, h: 2 },
      },
    });

    // Navigate to dashboard in edit mode
    await page.goto(`/dashboard/${dashboard.id}?edit=true`);
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Get initial position
    const widget = page.locator('[data-testid^="widget-container-"]').first();
    const initialBox = await widget.boundingBox();

    // Drag to new position
    const dragHandle = widget.locator('.widget-drag-handle');
    await dragHandle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 300, initialBox!.y + 100);
    await page.mouse.up();

    // Wait for save
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saved', {
      timeout: 5000,
    });

    // Get new position
    const newBox = await widget.boundingBox();
    expect(newBox!.x).not.toBe(initialBox!.x);

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Verify position persisted
    const widgetAfterReload = page.locator('[data-testid^="widget-container-"]').first();
    const reloadedBox = await widgetAfterReload.boundingBox();

    expect(reloadedBox!.x).toBeCloseTo(newBox!.x, 10);
    expect(reloadedBox!.y).toBeCloseTo(newBox!.y, 10);

    // Cleanup
    await request.delete(`http://localhost:8000/api/dashboards/${dashboard.id}`, {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
    });
  });

  test('resize persists after page reload', async ({ page, request }) => {
    // Create test dashboard with widget
    const createResponse = await request.post('http://localhost:8000/api/dashboards', {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
      data: { name: `Resize Test ${Date.now()}` },
    });
    const dashboard = await createResponse.json();

    await request.post(`http://localhost:8000/api/dashboards/${dashboard.id}/widgets`, {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
      data: {
        type: 'bar_chart',
        title: 'Resizable Widget',
        position: { x: 0, y: 0, w: 4, h: 3 },
      },
    });

    // Navigate
    await page.goto(`/dashboard/${dashboard.id}?edit=true`);
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Get initial size
    const widget = page.locator('[data-testid^="widget-container-"]').first();
    const initialBox = await widget.boundingBox();

    // Resize using handle
    const resizeHandle = widget.locator('.react-resizable-handle');
    await resizeHandle.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + initialBox!.width + 100, initialBox!.y + initialBox!.height + 50);
    await page.mouse.up();

    // Wait for save
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saved', {
      timeout: 5000,
    });

    // Get new size
    const newBox = await widget.boundingBox();
    expect(newBox!.width).toBeGreaterThan(initialBox!.width);
    expect(newBox!.height).toBeGreaterThan(initialBox!.height);

    // Reload and verify
    await page.reload();
    await page.waitForSelector('[data-testid="dashboard-container"]');

    const reloadedWidget = page.locator('[data-testid^="widget-container-"]').first();
    const reloadedBox = await reloadedWidget.boundingBox();

    expect(reloadedBox!.width).toBeCloseTo(newBox!.width, 10);
    expect(reloadedBox!.height).toBeCloseTo(newBox!.height, 10);

    // Cleanup
    await request.delete(`http://localhost:8000/api/dashboards/${dashboard.id}`, {
      headers: {
        'X-Tenant-ID': 'demo-tenant',
        'X-User-ID': 'demo-user',
      },
    });
  });

  test('indicator disappears after idle', async ({ page }) => {
    // Drag a widget
    const widget = page.locator('[data-testid^="widget-container-"]').first();
    const dragHandle = widget.locator('.widget-drag-handle');
    await dragHandle.dragTo(page.locator('.prismiq-dashboard-layout'), {
      targetPosition: { x: 200, y: 100 },
    });

    // Wait for save and idle
    await expect(page.locator('[data-testid="save-indicator"]')).toContainText('Saved', {
      timeout: 5000,
    });

    // Wait for indicator to disappear
    await expect(page.locator('[data-testid="save-indicator"]')).not.toBeVisible({
      timeout: 5000,
    });
  });
});
```

---

## Completion Criteria

- [ ] `PATCH /dashboards/{id}/layout` endpoint accepts position updates
- [ ] `useDebouncedLayoutSave` hook with 500ms debounce
- [ ] `AutoSaveIndicator` shows pending/saving/saved/error states
- [ ] `DashboardLayout` integrates auto-save
- [ ] Widget containers show drag handle on hover
- [ ] Widget containers show edit/delete overlay on hover
- [ ] Optimistic updates make drag feel instant
- [ ] Layout persists after page reload
- [ ] Resize changes persist after page reload
- [ ] Indicator shows for 2 seconds then disappears
- [ ] Error state shows if save fails
- [ ] All E2E layout tests pass
