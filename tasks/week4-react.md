# Week 4: React SDK - Dashboard System

## Overview
Build the dashboard layout system with react-grid-layout, global filters, widget management, and responsive design.

## Prerequisites
- Week 3 complete (charts)
- Node.js 18+

## Setup
```bash
cd packages/react
npm install react-grid-layout @types/react-grid-layout
```

## Validation Command
```bash
cd packages/react && npm run typecheck && npm run build
```

---

## Task 1: Dashboard Types

**Goal:** Create TypeScript types for dashboards, widgets, and filters.

**File:** `packages/react/src/dashboard/types.ts`

**Types:**

```typescript
// Widget types
export type WidgetType =
  | 'metric'
  | 'bar_chart'
  | 'line_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'scatter_chart'
  | 'table'
  | 'text';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetConfig {
  // Chart options
  x_axis?: string;
  y_axis?: string[];
  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  show_legend?: boolean;
  show_data_labels?: boolean;
  colors?: string[];

  // MetricCard options
  format?: 'number' | 'currency' | 'percent' | 'compact';
  trend_comparison?: string;

  // Table options
  page_size?: number;
  sortable?: boolean;

  // Text options
  content?: string;
  markdown?: boolean;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  query: QueryDefinition | null;
  position: WidgetPosition;
  config: WidgetConfig;
}

// Filter types
export type DashboardFilterType =
  | 'date_range'
  | 'select'
  | 'multi_select'
  | 'text'
  | 'number_range';

export interface DashboardFilter {
  id: string;
  type: DashboardFilterType;
  label: string;
  field: string;
  table?: string;
  default_value?: any;
  options?: Array<{ value: string; label: string }>;
  date_preset?: string;
}

export interface FilterValue {
  filter_id: string;
  value: any;
}

// Dashboard types
export interface DashboardLayout {
  columns: number;
  row_height: number;
  margin: [number, number];
  compact_type: 'vertical' | 'horizontal' | null;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: Widget[];
  filters: DashboardFilter[];
  is_public: boolean;
}

// Context types
export interface DashboardContextValue {
  dashboard: Dashboard | null;
  isLoading: boolean;
  error: Error | null;
  filterValues: FilterValue[];
  widgetResults: Record<string, QueryResult>;
  widgetErrors: Record<string, Error>;
  widgetLoading: Record<string, boolean>;

  // Actions
  setFilterValue: (filterId: string, value: any) => void;
  refreshDashboard: () => Promise<void>;
  refreshWidget: (widgetId: string) => Promise<void>;
}

export interface DashboardEditorContextValue extends DashboardContextValue {
  isEditing: boolean;
  hasChanges: boolean;

  // Editor actions
  addWidget: (widget: Omit<Widget, 'id'>) => void;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  removeWidget: (widgetId: string) => void;
  duplicateWidget: (widgetId: string) => void;
  updateLayout: (positions: Record<string, WidgetPosition>) => void;
  save: () => Promise<void>;
  cancel: () => void;
}
```

---

## Task 2: Dashboard Provider and Hooks

**Goal:** Create context and hooks for dashboard state management.

**Files:**
- `packages/react/src/dashboard/DashboardProvider.tsx`
- `packages/react/src/dashboard/useDashboard.ts`
- `packages/react/src/dashboard/useDashboardFilters.ts`
- `packages/react/src/dashboard/useWidget.ts`
- `packages/react/src/dashboard/index.ts`

**DashboardProvider:**

```typescript
interface DashboardProviderProps {
  dashboardId: string;
  refreshInterval?: number;  // Auto-refresh in ms
  children: React.ReactNode;
}

function DashboardProvider(props: DashboardProviderProps): JSX.Element
```

**Behavior:**
- Fetch dashboard on mount
- Execute all widget queries with merged filters
- Re-execute when filters change
- Optional auto-refresh

**Hooks:**

```typescript
// useDashboard - access full dashboard context
function useDashboard(): DashboardContextValue

// useDashboardFilters - manage filter state
interface UseDashboardFiltersResult {
  filters: DashboardFilter[];
  values: FilterValue[];
  setValue: (filterId: string, value: any) => void;
  resetAll: () => void;
  resetFilter: (filterId: string) => void;
}
function useDashboardFilters(): UseDashboardFiltersResult

// useWidget - access single widget state
interface UseWidgetResult {
  widget: Widget;
  result: QueryResult | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
function useWidget(widgetId: string): UseWidgetResult
```

---

## Task 3: Dashboard Layout Component

**Goal:** Create the grid layout container using react-grid-layout.

**Files:**
- `packages/react/src/dashboard/DashboardLayout/DashboardLayout.tsx`
- `packages/react/src/dashboard/DashboardLayout/index.ts`

**Props:**

```typescript
interface DashboardLayoutProps {
  widgets: Widget[];
  layout: DashboardLayout;
  editable?: boolean;
  onLayoutChange?: (positions: Record<string, WidgetPosition>) => void;
  renderWidget: (widget: Widget) => React.ReactNode;
  className?: string;
}
```

**Features:**
- Grid-based layout with react-grid-layout
- Drag-and-drop positioning (when editable)
- Resize handles (when editable)
- Responsive breakpoints (lg, md, sm, xs)
- Collision detection
- Compact layout (vertical)

**Requirements:**
- Map Widget positions to react-grid-layout format
- Convert layout changes back to Widget positions
- Handle responsive breakpoints
- Apply Prismiq theme styling

---

## Task 4: Widget Container Component

**Goal:** Create the widget wrapper with header and actions.

**Files:**
- `packages/react/src/dashboard/Widget/Widget.tsx`
- `packages/react/src/dashboard/Widget/WidgetHeader.tsx`
- `packages/react/src/dashboard/Widget/WidgetMenu.tsx`
- `packages/react/src/dashboard/Widget/WidgetContent.tsx`
- `packages/react/src/dashboard/Widget/index.ts`

**Props:**

```typescript
interface WidgetProps {
  widget: Widget;
  result: QueryResult | null;
  isLoading?: boolean;
  error?: Error | null;
  editable?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onRefresh?: () => void;
  onFullscreen?: () => void;
  className?: string;
}

interface WidgetHeaderProps {
  title: string;
  editable?: boolean;
  isLoading?: boolean;
  onMenuAction?: (action: string) => void;
}
```

**Features:**
- Title bar with widget name
- Loading spinner in header
- Dropdown menu (Edit, Duplicate, Remove, Refresh, Fullscreen)
- Error display overlay
- Content area for chart/table/metric

**WidgetContent rendering by type:**
- metric → MetricCard
- bar_chart → BarChart
- line_chart → LineChart
- area_chart → AreaChart
- pie_chart → PieChart
- scatter_chart → ScatterChart
- table → ResultsTable
- text → Markdown renderer

---

## Task 5: Dashboard Filter Components

**Goal:** Create filter input components for the filter bar.

**Files:**
- `packages/react/src/dashboard/Filters/FilterBar.tsx`
- `packages/react/src/dashboard/Filters/DateRangeFilter.tsx`
- `packages/react/src/dashboard/Filters/SelectFilter.tsx`
- `packages/react/src/dashboard/Filters/MultiSelectFilter.tsx`
- `packages/react/src/dashboard/Filters/TextFilter.tsx`
- `packages/react/src/dashboard/Filters/index.ts`

**FilterBar:**

```typescript
interface FilterBarProps {
  filters: DashboardFilter[];
  values: FilterValue[];
  onChange: (filterId: string, value: any) => void;
  onReset?: () => void;
  className?: string;
}
```

**DateRangeFilter:**

```typescript
interface DateRangeFilterProps {
  filter: DashboardFilter;
  value: { start: string; end: string } | string;  // string for presets
  onChange: (value: any) => void;
}
```

**Features:**
- Date picker with preset options (Today, Last 7 days, etc.)
- Custom date range selection
- Select dropdown with search
- Multi-select with checkboxes
- Text input with debounce
- Clear/reset button

---

## Task 6: Dashboard Component (Read-only)

**Goal:** Create the main read-only dashboard component for embedding.

**Files:**
- `packages/react/src/dashboard/Dashboard/Dashboard.tsx`
- `packages/react/src/dashboard/Dashboard/index.ts`

**Props:**

```typescript
interface DashboardProps {
  id: string;
  showFilters?: boolean;
  showTitle?: boolean;
  refreshInterval?: number;
  onWidgetClick?: (widget: Widget, result: QueryResult) => void;
  className?: string;
}
```

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Dashboard Title                               [Refresh] ⛶  │
├────────────────────────────────────────────────────────────┤
│ [Date Range ▼] [Region ▼] [Category ▼]      [Reset Filters]│
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│ │ Metric 1 │ │ Metric 2 │ │ Metric 3 │ │                  ││
│ └──────────┘ └──────────┘ └──────────┘ │                  ││
│ ┌─────────────────────────────────────┐│   Pie Chart      ││
│ │                                     ││                  ││
│ │         Bar Chart                   ││                  ││
│ │                                     │└──────────────────┘│
│ └─────────────────────────────────────┘                    │
│ ┌──────────────────────────────────────────────────────────┤
│ │                     Data Table                           │
│ └──────────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-load dashboard by ID
- Display filter bar
- Render all widgets in grid
- Loading state for entire dashboard
- Error state
- Refresh button
- Fullscreen toggle

---

## Task 7: Dashboard Editor Component

**Goal:** Create the dashboard editing interface.

**Files:**
- `packages/react/src/dashboard/DashboardEditor/DashboardEditor.tsx`
- `packages/react/src/dashboard/DashboardEditor/EditorToolbar.tsx`
- `packages/react/src/dashboard/DashboardEditor/WidgetPalette.tsx`
- `packages/react/src/dashboard/DashboardEditor/WidgetEditor.tsx`
- `packages/react/src/dashboard/DashboardEditor/index.ts`

**Props:**

```typescript
interface DashboardEditorProps {
  dashboardId?: string;  // Omit for new dashboard
  onSave?: (dashboard: Dashboard) => void;
  onCancel?: () => void;
  className?: string;
}

interface WidgetPaletteProps {
  onAddWidget: (type: WidgetType) => void;
}

interface WidgetEditorProps {
  widget: Widget;
  schema: DatabaseSchema;
  onSave: (widget: Widget) => void;
  onCancel: () => void;
}
```

**Features:**
- Drag widgets from palette to grid
- Edit widget properties (query, config)
- Resize and reposition widgets
- Add/edit/remove dashboard filters
- Save/cancel buttons
- Unsaved changes warning

**EditorToolbar:**
- Add widget button
- Edit filters button
- Dashboard settings button
- Save / Cancel buttons

**WidgetEditor (modal):**
- Widget title input
- Query builder for widget query
- Widget-specific config options
- Preview result

---

## Task 8: Auto-Refresh and Fullscreen

**Goal:** Add auto-refresh and fullscreen capabilities.

**Files:**
- `packages/react/src/dashboard/hooks/useAutoRefresh.ts`
- `packages/react/src/dashboard/hooks/useFullscreen.ts`
- `packages/react/src/dashboard/FullscreenWidget.tsx`

**useAutoRefresh:**

```typescript
interface UseAutoRefreshOptions {
  interval: number;  // ms
  enabled?: boolean;
  onRefresh: () => Promise<void>;
}

function useAutoRefresh(options: UseAutoRefreshOptions): {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  pause: () => void;
  resume: () => void;
}
```

**useFullscreen:**

```typescript
function useFullscreen(elementRef: RefObject<HTMLElement>): {
  isFullscreen: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}
```

**FullscreenWidget:**
- Maximized single widget view
- Close button
- Widget content fills screen
- Escape to exit

---

## Task 9: Responsive Layout

**Goal:** Make dashboards mobile-friendly.

**File:** Update `packages/react/src/dashboard/DashboardLayout/DashboardLayout.tsx`

**Breakpoints:**

```typescript
const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
};

const COLS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
};
```

**Features:**
- Responsive column counts
- Stack widgets on mobile
- Touch-friendly interactions
- Hide filter bar on mobile (show as dropdown)
- Adjust widget heights for mobile

**Requirements:**
- Use react-grid-layout's responsive features
- Provide sensible defaults for each breakpoint
- Allow layout override per breakpoint

---

## Task 10: Update Index Exports

**File:** `packages/react/src/index.ts`

**Export all dashboard components:**

```typescript
// Dashboard
export {
  Dashboard,
  DashboardEditor,
  DashboardProvider,
  DashboardLayout,
} from './dashboard';

export {
  useDashboard,
  useDashboardFilters,
  useWidget,
} from './dashboard';

export {
  Widget,
  WidgetHeader,
  FilterBar,
  DateRangeFilter,
  SelectFilter,
} from './dashboard';

// Types
export type {
  Dashboard as DashboardType,
  Widget as WidgetType,
  WidgetConfig,
  WidgetPosition,
  DashboardFilter,
  FilterValue,
  DashboardLayout as DashboardLayoutConfig,
  DashboardContextValue,
  DashboardEditorContextValue,
} from './dashboard';
```

---

## Completion Criteria

All tasks complete when:
- [ ] Dashboard loads and displays widgets correctly
- [ ] Filters update all widget data
- [ ] Widgets render appropriate chart/table/metric
- [ ] Grid layout supports drag-and-drop editing
- [ ] Editor can add/edit/remove widgets
- [ ] Auto-refresh works
- [ ] Fullscreen mode works
- [ ] Responsive layout works on mobile
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
