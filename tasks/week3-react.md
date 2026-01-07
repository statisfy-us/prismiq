# Week 3: React SDK - Charts & Visualizations

## Overview
Build a comprehensive chart library using Apache ECharts, including MetricCards, various chart types, and auto-suggestion.

## Prerequisites
- Week 2 complete (theme, UI components, query builder)
- Node.js 18+

## Setup
```bash
cd packages/react
npm install echarts echarts-for-react
```

## Validation Command
```bash
cd packages/react && npm run typecheck && npm run build
```

---

## Task 1: ECharts Integration

**Goal:** Create a base chart wrapper and utilities for ECharts.

**Files:**
- `packages/react/src/charts/EChartWrapper.tsx`
- `packages/react/src/charts/types.ts`
- `packages/react/src/charts/utils.ts`
- `packages/react/src/charts/index.ts`

**Types:**

```typescript
// types.ts
export interface ChartDataPoint {
  [key: string]: string | number | null;
}

export interface ChartSeries {
  name: string;
  data: (number | null)[];
  type?: 'bar' | 'line' | 'scatter' | 'pie';
  color?: string;
}

export interface BaseChartProps {
  data: QueryResult | ChartDataPoint[];
  loading?: boolean;
  error?: Error | null;
  height?: number | string;
  width?: number | string;
  className?: string;
  onDataPointClick?: (params: ChartClickParams) => void;
}

export interface ChartClickParams {
  seriesName: string;
  dataIndex: number;
  value: number | string;
  name: string;
}

export interface ReferenceLineConfig {
  value: number;
  label?: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}
```

**EChartWrapper:**

```typescript
interface EChartWrapperProps {
  option: EChartsOption;
  loading?: boolean;
  height?: number | string;
  width?: number | string;
  theme?: 'light' | 'dark';
  onEvents?: Record<string, (params: any) => void>;
  className?: string;
}

function EChartWrapper(props: EChartWrapperProps): JSX.Element
```

**Utilities:**

```typescript
// utils.ts
export function queryResultToChartData(
  result: QueryResult,
  xColumn: string,
  yColumns: string[],
): { categories: string[]; series: ChartSeries[] }

export function applyThemeToOption(
  option: EChartsOption,
  theme: PrismiqTheme,
): EChartsOption

export function formatAxisLabel(
  value: number,
  type: 'number' | 'currency' | 'percent',
): string

export function getChartColors(theme: PrismiqTheme, count: number): string[]
```

**Requirements:**
- Use `echarts-for-react` for React integration
- Handle resize automatically
- Apply Prismiq theme colors
- Show loading state with spinner
- Handle empty data gracefully

---

## Task 2: MetricCard Component

**Goal:** Create a KPI display component with trend indicator.

**Files:**
- `packages/react/src/charts/MetricCard/MetricCard.tsx`
- `packages/react/src/charts/MetricCard/TrendIndicator.tsx`
- `packages/react/src/charts/MetricCard/Sparkline.tsx`
- `packages/react/src/charts/MetricCard/index.ts`

**Props:**

```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  format?: 'number' | 'currency' | 'percent' | 'compact';
  currencySymbol?: string;
  decimals?: number;

  // Trend
  trend?: {
    value: number;       // Percent change
    direction: 'up' | 'down' | 'flat';
    label?: string;      // e.g., "vs last month"
  };
  trendPositive?: 'up' | 'down';  // Which direction is "good"

  // Sparkline
  sparklineData?: number[];
  sparklineColor?: string;

  // Styling
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}
```

**Layout:**
```
┌────────────────────────────┐
│ Revenue            ▲ 12.5% │
│ $1,234,567         vs LM   │
│ ╭──────────────────╮       │
│ │    ╱╲    ╱╲_╱    │       │
│ ╰──────────────────╯       │
└────────────────────────────┘
```

**Requirements:**
- Animate value on change (optional)
- Trend arrow colored (green up, red down, or configurable)
- Sparkline using ECharts (mini line chart)
- Responsive sizing
- Loading skeleton state

---

## Task 3: Bar Chart Component

**Goal:** Create a flexible bar chart with multiple variants.

**Files:**
- `packages/react/src/charts/BarChart/BarChart.tsx`
- `packages/react/src/charts/BarChart/index.ts`

**Props:**

```typescript
interface BarChartProps extends BaseChartProps {
  xAxis: string;                    // Column for X axis
  yAxis: string | string[];         // Column(s) for Y axis (multi-series)

  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  showDataLabels?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';

  referenceLines?: ReferenceLineConfig[];
  colors?: string[];

  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisFormat?: 'number' | 'currency' | 'percent' | 'compact';
}
```

**Features:**
- Vertical and horizontal bars
- Stacked bars
- Multi-series (grouped bars)
- Data labels on bars
- Reference lines
- Customizable colors
- Axis formatting

**Example:**
```tsx
<BarChart
  data={queryResult}
  xAxis="month"
  yAxis={["revenue", "cost"]}
  orientation="vertical"
  stacked={false}
  showDataLabels={true}
  referenceLines={[{ value: 100000, label: "Target" }]}
/>
```

---

## Task 4: Line Chart Component

**Goal:** Create a line chart with multi-series support.

**Files:**
- `packages/react/src/charts/LineChart/LineChart.tsx`
- `packages/react/src/charts/LineChart/index.ts`

**Props:**

```typescript
interface LineChartProps extends BaseChartProps {
  xAxis: string;
  yAxis: string | string[];

  smooth?: boolean;              // Curved lines
  showArea?: boolean;            // Fill area under line
  showPoints?: boolean;          // Show data points
  showDataLabels?: boolean;
  showLegend?: boolean;

  referenceLines?: ReferenceLineConfig[];
  colors?: string[];

  xAxisLabel?: string;
  yAxisLabel?: string;
  yAxisFormat?: 'number' | 'currency' | 'percent' | 'compact';
}
```

**Features:**
- Multiple series
- Smooth/curved lines
- Area fill option
- Data point markers
- Reference lines
- Zoom/pan (optional)

---

## Task 5: Area Chart Component

**Goal:** Create stacked area charts for time series.

**Files:**
- `packages/react/src/charts/AreaChart/AreaChart.tsx`
- `packages/react/src/charts/AreaChart/index.ts`

**Props:**

```typescript
interface AreaChartProps extends BaseChartProps {
  xAxis: string;
  yAxis: string | string[];

  stacked?: boolean;
  stackType?: 'normal' | 'percent';  // '100%' stacked
  smooth?: boolean;
  showLegend?: boolean;
  opacity?: number;

  colors?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}
```

**Features:**
- Stacked areas
- 100% stacked option
- Gradient fills
- Smooth curves

---

## Task 6: Pie Chart Component

**Goal:** Create pie and donut charts.

**Files:**
- `packages/react/src/charts/PieChart/PieChart.tsx`
- `packages/react/src/charts/PieChart/index.ts`

**Props:**

```typescript
interface PieChartProps extends BaseChartProps {
  labelColumn: string;      // Column for slice labels
  valueColumn: string;      // Column for slice values

  variant?: 'pie' | 'donut';
  donutRatio?: number;       // 0-1, inner radius for donut
  showLabels?: boolean;
  labelPosition?: 'inside' | 'outside';
  showPercentage?: boolean;
  showLegend?: boolean;

  colors?: string[];
  startAngle?: number;
  sortSlices?: 'asc' | 'desc' | 'none';
}
```

**Features:**
- Pie and donut variants
- Inside/outside labels
- Percentage display
- Custom start angle
- Sorted slices

---

## Task 7: Scatter Chart Component

**Goal:** Create scatter and bubble charts.

**Files:**
- `packages/react/src/charts/ScatterChart/ScatterChart.tsx`
- `packages/react/src/charts/ScatterChart/index.ts`

**Props:**

```typescript
interface ScatterChartProps extends BaseChartProps {
  xAxis: string;
  yAxis: string;
  sizeColumn?: string;        // For bubble size
  colorColumn?: string;       // For color coding

  minSize?: number;
  maxSize?: number;
  showLabels?: boolean;
  labelColumn?: string;
  showTrendline?: boolean;

  xAxisLabel?: string;
  yAxisLabel?: string;
}
```

**Features:**
- Basic scatter
- Bubble chart (sized points)
- Color-coded points
- Trendline (linear regression)
- Point labels

---

## Task 8: Chart Theme Integration

**Goal:** Ensure all charts use the Prismiq theme.

**File:** Update `packages/react/src/charts/utils.ts`

**Theme integration:**

```typescript
export function createChartTheme(theme: PrismiqTheme): object {
  return {
    color: theme.chart.colors,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: theme.fonts.sans,
      color: theme.colors.text,
    },
    title: {
      textStyle: {
        color: theme.colors.text,
        fontSize: 16,
      },
    },
    legend: {
      textStyle: {
        color: theme.colors.textMuted,
      },
    },
    xAxis: {
      axisLine: { lineStyle: { color: theme.chart.axisColor } },
      axisLabel: { color: theme.colors.textMuted },
      splitLine: { lineStyle: { color: theme.chart.gridColor } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: theme.chart.axisColor } },
      axisLabel: { color: theme.colors.textMuted },
      splitLine: { lineStyle: { color: theme.chart.gridColor } },
    },
    tooltip: {
      backgroundColor: theme.chart.tooltipBackground,
      borderColor: theme.colors.border,
      textStyle: { color: theme.colors.text },
    },
  };
}
```

**Requirements:**
- All charts automatically use current theme
- Charts update when theme changes
- Dark mode support

---

## Task 9: useChartData Hook

**Goal:** Create a hook for transforming QueryResult to chart-ready format.

**File:** `packages/react/src/hooks/useChartData.ts`

**Interface:**

```typescript
interface ChartDataOptions {
  xColumn: string;
  yColumns: string[];
  groupColumn?: string;
  sortBy?: 'x' | 'y' | 'none';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
}

interface ChartDataResult {
  categories: string[];
  series: ChartSeries[];
  isEmpty: boolean;
  totalRows: number;
}

function useChartData(
  result: QueryResult | null,
  options: ChartDataOptions,
): ChartDataResult
```

**Features:**
- Memoized transformation
- Handle null/undefined values
- Sort data
- Limit data points
- Group by column for multi-series

---

## Task 10: Auto Chart Suggestion

**Goal:** Create a utility to suggest the best chart type for data.

**File:** `packages/react/src/charts/autoSuggest.ts`

**Interface:**

```typescript
type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'metric';

interface ChartSuggestion {
  type: ChartType;
  confidence: number;  // 0-1
  reason: string;
  config: Partial<BarChartProps | LineChartProps | PieChartProps | ...>;
}

function suggestChartType(
  result: QueryResult,
  columns: ColumnSelection[],
): ChartSuggestion[]
```

**Rules:**
- Single value → MetricCard
- Date + numeric → Line/Area chart
- Category + numeric → Bar chart
- Category + numeric (few categories) → Pie chart
- Two numerics → Scatter chart
- Multiple numerics, no date → Grouped bar

**Requirements:**
- Return multiple suggestions ranked by confidence
- Include configuration recommendations
- Consider column data types

---

## Task 11: Update Index Exports

**File:** `packages/react/src/index.ts`

**Export all chart components:**

```typescript
// Charts
export { EChartWrapper } from './charts';
export { MetricCard } from './charts';
export { BarChart } from './charts';
export { LineChart } from './charts';
export { AreaChart } from './charts';
export { PieChart } from './charts';
export { ScatterChart } from './charts';

// Chart utilities
export { useChartData } from './hooks';
export { suggestChartType } from './charts';
export type {
  ChartDataPoint,
  ChartSeries,
  BaseChartProps,
  ChartClickParams,
  ReferenceLineConfig,
  ChartSuggestion,
} from './charts';
```

---

## Completion Criteria

All tasks complete when:
- [ ] ECharts wrapper handles loading/error states
- [ ] MetricCard displays value with trend and sparkline
- [ ] BarChart supports vertical/horizontal, stacked, multi-series
- [ ] LineChart supports smooth, area, multi-series
- [ ] AreaChart supports stacked and 100% stacked
- [ ] PieChart supports pie and donut variants
- [ ] ScatterChart supports bubble and color coding
- [ ] All charts use theme colors
- [ ] useChartData transforms data correctly
- [ ] Auto-suggest returns appropriate recommendations
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
