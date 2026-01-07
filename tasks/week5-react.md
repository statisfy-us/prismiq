# Week 5: React SDK - Production Ready

## Overview
Add loading states, error handling, exports, accessibility, and SSR support for production use.

## Prerequisites
- Week 4 complete (dashboard system)
- Node.js 18+

## Validation Command
```bash
cd packages/react && npm run typecheck && npm run build
```

---

## Task 1: Loading Skeletons

**Goal:** Create shimmer placeholder components for loading states.

**Files:**
- `packages/react/src/components/Skeleton/Skeleton.tsx`
- `packages/react/src/components/Skeleton/SkeletonText.tsx`
- `packages/react/src/components/Skeleton/SkeletonChart.tsx`
- `packages/react/src/components/Skeleton/SkeletonTable.tsx`
- `packages/react/src/components/Skeleton/SkeletonMetricCard.tsx`
- `packages/react/src/components/Skeleton/index.ts`

**Props:**

```typescript
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  animate?: boolean;
  className?: string;
}

interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}

interface SkeletonChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  height?: number;
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}
```

**Features:**
- CSS shimmer animation
- Theme-aware colors
- Responsive sizing
- Preset skeletons for charts, tables, metrics

**CSS Animation:**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-border) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Task 2: Error Boundaries

**Goal:** Create error boundary components with recovery options.

**Files:**
- `packages/react/src/components/ErrorBoundary/ErrorBoundary.tsx`
- `packages/react/src/components/ErrorBoundary/ErrorFallback.tsx`
- `packages/react/src/components/ErrorBoundary/WidgetErrorBoundary.tsx`
- `packages/react/src/components/ErrorBoundary/index.ts`

**Props:**

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: any[];  // Reset when these values change
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  title?: string;
  showDetails?: boolean;
}

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetTitle?: string;
  onError?: (error: Error) => void;
}
```

**Features:**
- Error capture with React.Component lifecycle
- Retry functionality
- Error details toggle
- Reset on key change
- Report error callback
- Widget-specific error display

---

## Task 3: Empty States

**Goal:** Create empty state components with illustrations.

**Files:**
- `packages/react/src/components/EmptyState/EmptyState.tsx`
- `packages/react/src/components/EmptyState/NoData.tsx`
- `packages/react/src/components/EmptyState/NoResults.tsx`
- `packages/react/src/components/EmptyState/EmptyDashboard.tsx`
- `packages/react/src/components/EmptyState/index.ts`

**Props:**

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// Preset components
interface NoDataProps {
  message?: string;
  onRefresh?: () => void;
}

interface NoResultsProps {
  searchQuery?: string;
  onClearFilters?: () => void;
}
```

**Features:**
- SVG illustrations (simple, theme-aware)
- Action button option
- Customizable messages
- Preset variations for common cases

---

## Task 4: Export to CSV

**Goal:** Client-side CSV export functionality.

**Files:**
- `packages/react/src/export/csv.ts`
- `packages/react/src/export/types.ts`
- `packages/react/src/export/index.ts`

**Functions:**

```typescript
interface ExportOptions {
  filename?: string;
  columns?: string[];  // Subset of columns
  headers?: Record<string, string>;  // Column header overrides
  dateFormat?: string;
  numberFormat?: Intl.NumberFormatOptions;
}

function exportToCSV(
  data: QueryResult | Record<string, any>[],
  options?: ExportOptions
): void;

function generateCSV(
  data: Record<string, any>[],
  columns: string[],
  headers: Record<string, string>
): string;

function downloadFile(content: string, filename: string, mimeType: string): void;
```

**Features:**
- Escape CSV special characters
- Handle dates and numbers
- Custom column selection
- Custom headers
- Trigger browser download

---

## Task 5: Export to Excel

**Goal:** Excel export with formatting.

**File:** `packages/react/src/export/excel.ts`

**Note:** Use SheetJS (xlsx) library.

```bash
npm install xlsx
```

**Functions:**

```typescript
interface ExcelExportOptions extends ExportOptions {
  sheetName?: string;
  styles?: {
    header?: ExcelStyle;
    data?: ExcelStyle;
  };
  columnWidths?: Record<string, number>;
  freezeHeader?: boolean;
}

interface ExcelStyle {
  bold?: boolean;
  fill?: string;  // Hex color
  align?: 'left' | 'center' | 'right';
}

function exportToExcel(
  data: QueryResult | Record<string, any>[],
  options?: ExcelExportOptions
): void;
```

**Features:**
- Column width auto-sizing
- Header styling
- Number/date formatting
- Freeze header row
- Multiple sheets (for dashboards)

---

## Task 6: Export Hook

**Goal:** Create useExport hook for components.

**File:** `packages/react/src/hooks/useExport.ts`

**Hook:**

```typescript
interface UseExportOptions {
  data: QueryResult | null;
  filename?: string;
  columns?: string[];
}

interface UseExportResult {
  exportCSV: () => void;
  exportExcel: () => void;
  isExporting: boolean;
  canExport: boolean;
}

function useExport(options: UseExportOptions): UseExportResult;
```

**Features:**
- Memoized export functions
- Loading state during export
- Disable when no data

---

## Task 7: Accessibility Improvements

**Goal:** Add ARIA attributes and keyboard navigation.

**Files:** Update existing components

**Requirements:**

1. **Focus Management:**
   - Visible focus indicators
   - Logical tab order
   - Focus trap in modals

2. **ARIA Attributes:**
   - `role` attributes for custom widgets
   - `aria-label` for interactive elements
   - `aria-live` for dynamic content
   - `aria-expanded` for dropdowns

3. **Keyboard Navigation:**
   - Escape to close modals/menus
   - Arrow keys for menus and tables
   - Enter/Space to activate buttons
   - Tab through form fields

**Components to update:**
- FilterBar (dropdown navigation)
- ResultsTable (row selection, column sorting)
- Dashboard (widget focus)
- Widget menu (arrow key navigation)
- All form inputs (proper labels)

**Create:** `packages/react/src/utils/accessibility.ts`

```typescript
function useFocusTrap(containerRef: RefObject<HTMLElement>): void;
function useArrowNavigation(items: HTMLElement[]): number;
function announceToScreenReader(message: string): void;
```

---

## Task 8: SSR Support

**Goal:** Ensure components work with server-side rendering (Next.js).

**Files:**
- Update all components with `use client` where needed
- `packages/react/src/ssr/index.ts`

**Changes:**

1. **Client-only components:**
   Add `'use client'` directive to components using:
   - `useState`, `useEffect`
   - `window`, `document`
   - `localStorage`, `sessionStorage`
   - ECharts (DOM rendering)

2. **Hydration-safe hooks:**
   ```typescript
   function useIsClient(): boolean {
     const [isClient, setIsClient] = useState(false);
     useEffect(() => setIsClient(true), []);
     return isClient;
   }
   ```

3. **Lazy loading for charts:**
   ```typescript
   const BarChart = dynamic(() => import('./charts/BarChart'), {
     ssr: false,
     loading: () => <SkeletonChart type="bar" />
   });
   ```

4. **Safe window access:**
   ```typescript
   function getWindowWidth(): number {
     if (typeof window === 'undefined') return 1200;
     return window.innerWidth;
   }
   ```

**Test:**
- Create a test Next.js app
- Verify no hydration mismatch errors
- Verify charts load after mount

---

## Task 9: Bundle Optimization

**Goal:** Optimize bundle size with tree-shaking and lazy loading.

**Files:**
- `packages/react/tsup.config.ts`
- `packages/react/package.json`

**Changes:**

1. **Modular exports in package.json:**
   ```json
   {
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js",
         "require": "./dist/index.cjs"
       },
       "./charts": {
         "types": "./dist/charts/index.d.ts",
         "import": "./dist/charts/index.js"
       },
       "./dashboard": {
         "types": "./dist/dashboard/index.d.ts",
         "import": "./dist/dashboard/index.js"
       },
       "./query-builder": {
         "types": "./dist/query-builder/index.d.ts",
         "import": "./dist/query-builder/index.js"
       }
     }
   }
   ```

2. **Separate entry points in tsup:**
   ```typescript
   export default defineConfig({
     entry: {
       index: 'src/index.ts',
       'charts/index': 'src/charts/index.ts',
       'dashboard/index': 'src/dashboard/index.ts',
       'query-builder/index': 'src/query-builder/index.ts',
     },
     splitting: true,
     treeshake: true,
   });
   ```

3. **Mark external dependencies:**
   ```typescript
   external: ['react', 'react-dom', 'echarts', 'echarts-for-react']
   ```

4. **Measure bundle size:**
   ```bash
   npm run build && du -h dist/
   ```

**Target:** < 200KB gzipped (excluding ECharts)

---

## Task 10: Update Index Exports

**File:** `packages/react/src/index.ts`

**Export new components:**

```typescript
// Skeletons
export {
  Skeleton,
  SkeletonText,
  SkeletonChart,
  SkeletonTable,
  SkeletonMetricCard,
} from './components/Skeleton';

// Error handling
export {
  ErrorBoundary,
  ErrorFallback,
  WidgetErrorBoundary,
} from './components/ErrorBoundary';

// Empty states
export {
  EmptyState,
  NoData,
  NoResults,
  EmptyDashboard,
} from './components/EmptyState';

// Export utilities
export { exportToCSV, exportToExcel, useExport } from './export';

// Accessibility utilities
export { useFocusTrap, useArrowNavigation, announceToScreenReader } from './utils/accessibility';

// SSR utilities
export { useIsClient } from './ssr';

// Types
export type {
  SkeletonProps,
  ErrorBoundaryProps,
  EmptyStateProps,
  ExportOptions,
  ExcelExportOptions,
} from './types';
```

---

## Completion Criteria

All tasks complete when:
- [ ] Loading skeletons animate smoothly
- [ ] Error boundaries catch and display errors gracefully
- [ ] Empty states show appropriate messages
- [ ] CSV export works with all data types
- [ ] Excel export includes formatting
- [ ] useExport hook works in components
- [ ] ARIA attributes added to interactive elements
- [ ] Keyboard navigation works
- [ ] Components work with Next.js SSR
- [ ] Bundle can be imported in parts
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
