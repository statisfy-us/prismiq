# Week 2: React SDK - Query Builder UI & Theming

## Overview
Build the visual query builder components and implement a comprehensive theming system for the Prismiq React SDK.

## Prerequisites
- Week 1 complete (types, client, provider, hooks)
- Node.js 18+

## Validation Command
```bash
cd packages/react && npm run typecheck && npm run build
```

---

## Task 1: Theme System

**Goal:** Create a comprehensive theming system with CSS variables.

**Files:**
- `packages/react/src/theme/types.ts`
- `packages/react/src/theme/defaults.ts`
- `packages/react/src/theme/ThemeProvider.tsx`
- `packages/react/src/theme/useTheme.ts`
- `packages/react/src/theme/index.ts`

**Types:**

```typescript
// types.ts
export interface PrismiqTheme {
  name: string;
  colors: {
    primary: string;
    primaryHover: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    textInverse: string;
    border: string;
    borderFocus: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  chart: {
    colors: string[];
    gridColor: string;
    axisColor: string;
    tooltipBackground: string;
  };
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: PrismiqTheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: 'light' | 'dark';
}
```

**Default themes:**

```typescript
// defaults.ts
export const lightTheme: PrismiqTheme = {
  name: 'light',
  colors: {
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceHover: '#f3f4f6',
    text: '#111827',
    textMuted: '#6b7280',
    textInverse: '#ffffff',
    border: '#e5e7eb',
    borderFocus: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  // ... rest of theme
};

export const darkTheme: PrismiqTheme = {
  name: 'dark',
  // ... dark mode values
};
```

**ThemeProvider:**
- Inject CSS variables into document root
- Handle system preference detection
- Listen for system preference changes
- Merge custom theme with defaults

**Requirements:**
- CSS variables prefixed with `--prismiq-`
- System mode detects `prefers-color-scheme`
- Theme persists to localStorage
- Deep merge custom themes with defaults

**Tests:** Basic component rendering tests

---

## Task 2: Base UI Components

**Goal:** Create foundational UI components used across the query builder.

**Files:**
- `packages/react/src/components/ui/Button.tsx`
- `packages/react/src/components/ui/Input.tsx`
- `packages/react/src/components/ui/Select.tsx`
- `packages/react/src/components/ui/Checkbox.tsx`
- `packages/react/src/components/ui/Badge.tsx`
- `packages/react/src/components/ui/Tooltip.tsx`
- `packages/react/src/components/ui/Dropdown.tsx`
- `packages/react/src/components/ui/Icon.tsx`
- `packages/react/src/components/ui/index.ts`

**Component Requirements:**

```typescript
// Button
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

// Select
interface SelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}

// Dropdown
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
}
```

**Requirements:**
- All components use CSS variables from theme
- Keyboard accessible (Tab, Enter, Escape)
- Support `className` prop for customization
- Forward refs properly
- No external UI library dependencies

---

## Task 3: Schema Explorer

**Goal:** Create a tree view for exploring database tables and columns.

**Files:**
- `packages/react/src/components/SchemaExplorer/SchemaExplorer.tsx`
- `packages/react/src/components/SchemaExplorer/TableNode.tsx`
- `packages/react/src/components/SchemaExplorer/ColumnNode.tsx`
- `packages/react/src/components/SchemaExplorer/index.ts`

**Props:**

```typescript
interface SchemaExplorerProps {
  onTableSelect?: (table: TableSchema) => void;
  onColumnSelect?: (table: TableSchema, column: ColumnSchema) => void;
  onColumnDragStart?: (table: TableSchema, column: ColumnSchema) => void;
  selectedTable?: string;
  selectedColumns?: Array<{ table: string; column: string }>;
  searchable?: boolean;
  collapsible?: boolean;
  className?: string;
}
```

**Features:**
- Tree view with expandable tables
- Search/filter tables and columns
- Show column data types with icons
- Indicate primary keys and foreign keys
- Support drag-and-drop columns to query builder
- Highlight selected columns
- Show display names from schema config

**Requirements:**
- Uses `useSchema` hook for data
- Renders loading skeleton while loading
- Shows error state if schema fails to load
- Keyboard navigable (arrow keys)

---

## Task 4: Column Selector

**Goal:** Create a component for selecting and ordering columns in a query.

**Files:**
- `packages/react/src/components/ColumnSelector/ColumnSelector.tsx`
- `packages/react/src/components/ColumnSelector/SelectedColumn.tsx`
- `packages/react/src/components/ColumnSelector/index.ts`

**Props:**

```typescript
interface ColumnSelectorProps {
  tables: QueryTable[];
  columns: ColumnSelection[];
  onChange: (columns: ColumnSelection[]) => void;
  schema: DatabaseSchema;
  className?: string;
}

interface SelectedColumnProps {
  column: ColumnSelection;
  table: QueryTable;
  tableSchema: TableSchema;
  onRemove: () => void;
  onUpdate: (column: ColumnSelection) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
}
```

**Features:**
- List of selected columns with drag-to-reorder
- Each column shows: table name, column name, aggregation
- Click to edit aggregation
- Remove button on each column
- Drop zone for columns from SchemaExplorer
- Alias input field

**Requirements:**
- Drag-and-drop reordering (native HTML5 drag)
- Keyboard accessible
- Shows column data type

---

## Task 5: Filter Builder

**Goal:** Create a visual filter condition builder.

**Files:**
- `packages/react/src/components/FilterBuilder/FilterBuilder.tsx`
- `packages/react/src/components/FilterBuilder/FilterRow.tsx`
- `packages/react/src/components/FilterBuilder/FilterValueInput.tsx`
- `packages/react/src/components/FilterBuilder/index.ts`

**Props:**

```typescript
interface FilterBuilderProps {
  tables: QueryTable[];
  filters: FilterDefinition[];
  onChange: (filters: FilterDefinition[]) => void;
  schema: DatabaseSchema;
  className?: string;
}

interface FilterRowProps {
  filter: FilterDefinition;
  tables: QueryTable[];
  schema: DatabaseSchema;
  onChange: (filter: FilterDefinition) => void;
  onRemove: () => void;
}
```

**Features:**
- Add/remove filter conditions
- Column dropdown (grouped by table)
- Operator dropdown (context-sensitive based on data type)
- Value input (type-appropriate: text, number, date picker, multi-select for IN)
- AND/OR logic groups (optional, can be simplified to AND only)

**Operator mapping by type:**
- String: eq, neq, like, ilike, in_, not_in, is_null, is_not_null
- Number: eq, neq, gt, gte, lt, lte, between, in_, is_null, is_not_null
- Date: eq, neq, gt, gte, lt, lte, between, is_null, is_not_null
- Boolean: eq, neq, is_null, is_not_null

**Requirements:**
- Smart defaults when adding new filter
- Validate value matches column type
- Clear button to reset filter
- Support `between` operator with two inputs

---

## Task 6: Sort Builder

**Goal:** Create a component for defining sort order.

**Files:**
- `packages/react/src/components/SortBuilder/SortBuilder.tsx`
- `packages/react/src/components/SortBuilder/SortRow.tsx`
- `packages/react/src/components/SortBuilder/index.ts`

**Props:**

```typescript
interface SortBuilderProps {
  tables: QueryTable[];
  sorts: SortDefinition[];
  onChange: (sorts: SortDefinition[]) => void;
  schema: DatabaseSchema;
  maxSorts?: number;
  className?: string;
}
```

**Features:**
- Add/remove sort conditions
- Column dropdown (grouped by table)
- Direction toggle (ASC/DESC)
- Drag to reorder sort priority
- Limit number of sorts (default: 3)

**Requirements:**
- First sort has priority 1, etc.
- Visual indicator of sort order
- Prevent duplicate columns

---

## Task 7: Aggregation Picker

**Goal:** Create a dropdown for selecting column aggregations.

**Files:**
- `packages/react/src/components/AggregationPicker/AggregationPicker.tsx`
- `packages/react/src/components/AggregationPicker/index.ts`

**Props:**

```typescript
interface AggregationPickerProps {
  value: AggregationType;
  onChange: (aggregation: AggregationType) => void;
  columnType: string;
  disabled?: boolean;
  className?: string;
}
```

**Features:**
- Dropdown with aggregation options
- Filter options based on column type:
  - Numeric: all aggregations
  - String: count, count_distinct
  - Date: count, count_distinct, min, max
  - Boolean: count, count_distinct
- Show icons for each aggregation
- "None" option for raw values

**Requirements:**
- Accessible dropdown
- Tooltips explaining each aggregation
- Highlight current selection

---

## Task 8: Results Table

**Goal:** Create a data grid for displaying query results.

**Files:**
- `packages/react/src/components/ResultsTable/ResultsTable.tsx`
- `packages/react/src/components/ResultsTable/TableHeader.tsx`
- `packages/react/src/components/ResultsTable/TableRow.tsx`
- `packages/react/src/components/ResultsTable/TableCell.tsx`
- `packages/react/src/components/ResultsTable/Pagination.tsx`
- `packages/react/src/components/ResultsTable/index.ts`

**Props:**

```typescript
interface ResultsTableProps {
  result: QueryResult | null;
  loading?: boolean;
  error?: Error | null;
  pageSize?: number;
  sortable?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: any[], index: number) => void;
  formatters?: Record<string, (value: any) => string>;
  className?: string;
}
```

**Features:**
- Column headers with sort indicators
- Client-side pagination
- Loading skeleton
- Empty state
- Error state
- Column resizing (optional)
- Sticky header
- Format values based on column type
- Truncate long text with tooltip

**Requirements:**
- Virtualize rows if > 100 (optional, can defer)
- Accessible table markup
- Keyboard navigation
- Show row count and "truncated" warning

---

## Task 9: Query Builder Container

**Goal:** Create the main QueryBuilder component that combines all query building components.

**Files:**
- `packages/react/src/components/QueryBuilder/QueryBuilder.tsx`
- `packages/react/src/components/QueryBuilder/QueryBuilderToolbar.tsx`
- `packages/react/src/components/QueryBuilder/QueryPreview.tsx`
- `packages/react/src/components/QueryBuilder/index.ts`

**Props:**

```typescript
interface QueryBuilderProps {
  initialQuery?: QueryDefinition;
  onQueryChange?: (query: QueryDefinition) => void;
  onExecute?: (result: QueryResult) => void;
  onError?: (error: Error) => void;
  autoExecute?: boolean;
  autoExecuteDelay?: number;
  showSqlPreview?: boolean;
  showResultsTable?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

interface QueryBuilderState {
  query: QueryDefinition;
  result: QueryResult | null;
  isExecuting: boolean;
  error: Error | null;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ QueryBuilder                                                │
├──────────────┬──────────────────────────────────────────────┤
│              │  Columns: [drag columns here]                │
│ Schema       │  Filters: [add filter conditions]            │
│ Explorer     │  Sort: [add sort]                            │
│              ├──────────────────────────────────────────────┤
│              │  [Execute] [Preview] [Clear]                 │
│              ├──────────────────────────────────────────────┤
│              │  SQL Preview (collapsible)                   │
│              ├──────────────────────────────────────────────┤
│              │  Results Table                               │
└──────────────┴──────────────────────────────────────────────┘
```

**Features:**
- Table selection from schema
- Drag columns from explorer to selector
- Build filters and sorts
- Execute button
- Preview button (limited rows)
- Clear button
- SQL preview (read-only, syntax highlighted)
- Results table
- Validation errors displayed inline

**Requirements:**
- Auto-execute on query change (debounced, optional)
- Keyboard shortcut: Cmd/Ctrl+Enter to execute
- State managed internally, exposed via callbacks
- Can be controlled or uncontrolled

---

## Task 10: Event Callbacks System

**Goal:** Add comprehensive event callbacks throughout components.

**Add callbacks to components:**

```typescript
// Analytics Provider level callbacks
interface AnalyticsProviderProps {
  config: ClientConfig;
  theme?: Partial<PrismiqTheme>;
  mode?: ThemeMode;
  onQueryExecute?: (query: QueryDefinition, result: QueryResult) => void;
  onQueryError?: (query: QueryDefinition, error: Error) => void;
  onSchemaLoad?: (schema: DatabaseSchema) => void;
  onSchemaError?: (error: Error) => void;
  children: React.ReactNode;
}

// Query Builder callbacks (already defined above)
onQueryChange?: (query: QueryDefinition) => void;
onExecute?: (result: QueryResult) => void;
onError?: (error: Error) => void;

// Results Table callbacks
onRowClick?: (row: any[], index: number) => void;
onCellClick?: (value: any, column: string, rowIndex: number) => void;
onExport?: (format: 'csv' | 'json') => void;
```

**Requirements:**
- All callbacks are optional
- Callbacks fire after internal handling
- Include relevant context in callback args

---

## Task 11: Update Index Exports

**File:** `packages/react/src/index.ts`

**Export all new components and types:**

```typescript
// Theme
export { ThemeProvider, useTheme } from './theme';
export type { PrismiqTheme, ThemeMode, ThemeContextValue } from './theme';
export { lightTheme, darkTheme } from './theme';

// UI Components
export { Button, Input, Select, Checkbox, Badge, Tooltip, Dropdown } from './components/ui';

// Query Builder Components
export { SchemaExplorer } from './components/SchemaExplorer';
export { ColumnSelector } from './components/ColumnSelector';
export { FilterBuilder } from './components/FilterBuilder';
export { SortBuilder } from './components/SortBuilder';
export { AggregationPicker } from './components/AggregationPicker';
export { ResultsTable } from './components/ResultsTable';
export { QueryBuilder } from './components/QueryBuilder';
```

---

## Completion Criteria

All tasks complete when:
- [ ] Theme system with light/dark/system modes works
- [ ] All UI components render correctly
- [ ] SchemaExplorer displays tables and columns
- [ ] ColumnSelector supports drag-and-drop
- [ ] FilterBuilder creates valid filter definitions
- [ ] SortBuilder creates valid sort definitions
- [ ] ResultsTable displays query results with pagination
- [ ] QueryBuilder combines all components and executes queries
- [ ] All event callbacks fire correctly
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
