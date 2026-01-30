# Hooks Reference

Complete reference for all React hooks provided by `@prismiq/react`.

## Table of Contents

- [Context Hooks](#context-hooks)
- [Data Hooks](#data-hooks)
- [Dashboard Hooks](#dashboard-hooks)
- [Pin Hooks](#pin-hooks)
- [Utility Hooks](#utility-hooks)

---

## Context Hooks

### useAnalytics

Access the main analytics context including the client and schema.

```tsx
import { useAnalytics } from '@prismiq/react';

function MyComponent() {
  const {
    client,        // PrismiqClient instance
    schema,        // DatabaseSchema | null
    isLoading,     // boolean - schema loading state
    error,         // Error | null - schema load error
    refetchSchema, // () => Promise<void> - refresh schema
    tenantId,      // string - current tenant ID
    userId,        // string | undefined - current user ID
    schemaName,    // string | undefined - PostgreSQL schema name
  } = useAnalytics();

  // ...
}
```

**Returns:** `AnalyticsContextValue`

| Property | Type | Description |
|----------|------|-------------|
| `client` | `PrismiqClient` | API client instance |
| `schema` | `DatabaseSchema \| null` | Database schema (null while loading) |
| `isLoading` | `boolean` | Whether schema is loading |
| `error` | `Error \| null` | Schema load error if any |
| `refetchSchema` | `() => Promise<void>` | Manually refresh schema |
| `tenantId` | `string` | Current tenant ID |
| `userId` | `string \| undefined` | Current user ID |
| `schemaName` | `string \| undefined` | PostgreSQL schema name |

---

### useTenant

Convenience hook for accessing tenant/user information.

```tsx
import { useTenant } from '@prismiq/react';

function TenantInfo() {
  const { tenantId, userId, schemaName } = useTenant();

  return (
    <div>
      Tenant: {tenantId}
      {userId && <span>, User: {userId}</span>}
    </div>
  );
}
```

**Returns:** `{ tenantId: string; userId?: string; schemaName?: string }`

---

### useTheme

Access theme context for customization and mode switching.

```tsx
import { useTheme } from '@prismiq/react';

function ThemeToggle() {
  const {
    theme,         // PrismiqTheme - current theme object
    mode,          // ThemeMode - 'light' | 'dark' | 'system'
    setMode,       // (mode: ThemeMode) => void
    resolvedMode,  // 'light' | 'dark' - actual mode after system detection
  } = useTheme();

  return (
    <button onClick={() => setMode(resolvedMode === 'dark' ? 'light' : 'dark')}>
      Switch to {resolvedMode === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
```

**Returns:** `ThemeContextValue`

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `PrismiqTheme` | Current theme object with all values |
| `mode` | `'light' \| 'dark' \| 'system'` | User-selected mode |
| `setMode` | `(mode) => void` | Change theme mode |
| `resolvedMode` | `'light' \| 'dark'` | Actual mode (after system detection) |

---

## Data Hooks

### useSchema

Load and access the database schema.

```tsx
import { useSchema } from '@prismiq/react';

function SchemaExplorer() {
  const { schema, isLoading, error, refetch } = useSchema();

  if (isLoading) return <div>Loading schema...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Tables ({schema.tables.length})</h2>
      <ul>
        {schema.tables.map(table => (
          <li key={table.name}>
            <strong>{table.name}</strong>
            <ul>
              {table.columns.map(col => (
                <li key={col.name}>
                  {col.name}: {col.data_type}
                  {col.is_primary_key && ' (PK)'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `schema` | `DatabaseSchema \| null` | Schema with tables and relationships |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if load failed |
| `refetch` | `() => Promise<void>` | Refresh schema |

---

### useQuery

Execute a query definition and get results.

```tsx
import { useQuery } from '@prismiq/react';

function SalesChart() {
  const query = {
    tables: [{ id: 't1', name: 'orders' }],
    columns: [
      { table_id: 't1', column: 'region', aggregation: 'none' },
      { table_id: 't1', column: 'amount', aggregation: 'sum' }
    ],
    group_by: [{ table_id: 't1', column: 'region' }]
  };

  const { data, isLoading, error, refetch } = useQuery(query);

  // Can also pass options
  const { data: freshData } = useQuery(query, { bypassCache: true });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <BarChart data={data} xAxis="region" yAxis={['amount']} />;
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `QueryDefinition \| null` | Query to execute (null skips execution) |
| `options.bypassCache` | `boolean` | Skip cache and fetch fresh data |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `QueryResult \| null` | Query results |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if query failed |
| `refetch` | `() => Promise<void>` | Re-execute query |

---

### useCustomSQL

Execute raw SQL queries.

```tsx
import { useCustomSQL } from '@prismiq/react';

function CustomReport() {
  const sql = `
    SELECT
      DATE_TRUNC('month', created_at) as month,
      SUM(amount) as total
    FROM orders
    WHERE status = 'completed'
    GROUP BY month
    ORDER BY month
  `;

  const { data, isLoading, error, refetch } = useCustomSQL(sql);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <LineChart data={data} xAxis="month" yAxis={['total']} />;
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sql` | `string \| null` | SQL query to execute (SELECT only) |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `QueryResult \| null` | Query results |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if query failed |
| `refetch` | `() => Promise<void>` | Re-execute query |

---

### useChartData

Get query data formatted for chart consumption.

```tsx
import { useChartData } from '@prismiq/react';

function FormattedChart() {
  const query = {
    tables: [{ id: 't1', name: 'sales' }],
    columns: [
      { table_id: 't1', column: 'category', aggregation: 'none' },
      { table_id: 't1', column: 'revenue', aggregation: 'sum' }
    ],
    group_by: [{ table_id: 't1', column: 'category' }]
  };

  const { chartData, isLoading, error } = useChartData(query);

  // chartData is formatted as array of objects:
  // [{ category: 'A', revenue: 100 }, { category: 'B', revenue: 200 }]

  if (isLoading) return <div>Loading...</div>;
  return <BarChart data={chartData} />;
}
```

---

## Dashboard Hooks

### useDashboard

Load a single dashboard by ID.

```tsx
import { useDashboard } from '@prismiq/react';

function DashboardView({ id }: { id: string }) {
  const { dashboard, isLoading, error, refetch } = useDashboard(id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{dashboard.name}</h1>
      <p>{dashboard.description}</p>
      <div>Widgets: {dashboard.widgets.length}</div>
      <div>Created: {new Date(dashboard.created_at).toLocaleDateString()}</div>
    </div>
  );
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Dashboard ID |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `dashboard` | `Dashboard \| null` | Dashboard with widgets |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if load failed |
| `refetch` | `() => Promise<void>` | Reload dashboard |

---

### useDashboards

List all dashboards with optional filtering.

```tsx
import { useDashboards } from '@prismiq/react';

function DashboardList() {
  const { dashboards, isLoading, error, refetch } = useDashboards();

  // With options
  const { dashboards: myDashboards } = useDashboards({
    ownedByMe: true,  // Only dashboards I own
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {dashboards.map(dashboard => (
        <li key={dashboard.id}>
          <a href={`/dashboard/${dashboard.id}`}>{dashboard.name}</a>
          <span>{dashboard.widgets.length} widgets</span>
        </li>
      ))}
    </ul>
  );
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.ownedByMe` | `boolean` | Filter to dashboards owned by current user |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `dashboards` | `Dashboard[]` | List of dashboards |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if load failed |
| `refetch` | `() => Promise<void>` | Reload list |

---

### useDashboardMutations

Create, update, and delete dashboards.

```tsx
import { useDashboardMutations } from '@prismiq/react';

function DashboardManager() {
  const {
    createDashboard,
    updateDashboard,
    deleteDashboard,
    isCreating,
    isUpdating,
    isDeleting,
    error,
  } = useDashboardMutations();

  const handleCreate = async () => {
    try {
      const dashboard = await createDashboard({
        name: 'New Dashboard',
        description: 'Description here',
      });
      console.log('Created:', dashboard.id);
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const handleUpdate = async (id: string) => {
    await updateDashboard(id, {
      name: 'Updated Name',
      description: 'Updated description',
      is_public: true,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this dashboard?')) {
      await deleteDashboard(id);
    }
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Create Dashboard'}
      </button>
    </div>
  );
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `createDashboard` | `(data: DashboardCreate) => Promise<Dashboard>` | Create new dashboard |
| `updateDashboard` | `(id: string, data: DashboardUpdate) => Promise<Dashboard>` | Update dashboard |
| `deleteDashboard` | `(id: string) => Promise<void>` | Delete dashboard |
| `isCreating` | `boolean` | Create in progress |
| `isUpdating` | `boolean` | Update in progress |
| `isDeleting` | `boolean` | Delete in progress |
| `error` | `Error \| null` | Last error |

---

### useDashboardFilters

Manage dashboard filter state.

```tsx
import { useDashboardFilters } from '@prismiq/react';

function DashboardWithFilters({ dashboardId }: { dashboardId: string }) {
  const {
    filters,           // Current filter values
    setFilter,         // Set single filter value
    setFilters,        // Set multiple filters
    clearFilters,      // Clear all filters
    getFilteredQuery,  // Apply filters to a query
  } = useDashboardFilters(dashboardId);

  return (
    <div>
      <select
        value={filters.region ?? ''}
        onChange={(e) => setFilter('region', e.target.value || null)}
      >
        <option value="">All Regions</option>
        <option value="US">US</option>
        <option value="EU">EU</option>
      </select>

      <button onClick={clearFilters}>Clear Filters</button>
    </div>
  );
}
```

---

### useSavedQueries

List and manage saved queries.

```tsx
import { useSavedQueries } from '@prismiq/react';

function SavedQueryList() {
  const { queries, isLoading, error, refetch } = useSavedQueries();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {queries.map(query => (
        <li key={query.id}>
          <strong>{query.name}</strong>
          <p>{query.description}</p>
          {query.is_shared && <span>Shared</span>}
        </li>
      ))}
    </ul>
  );
}
```

---

### useDebouncedLayoutSave

Auto-save dashboard layout changes with debouncing.

```tsx
import { useDebouncedLayoutSave } from '@prismiq/react';

function EditableDashboard({ dashboardId }: { dashboardId: string }) {
  const {
    saveLayout,
    isSaving,
    lastSaved,
    error,
  } = useDebouncedLayoutSave({
    dashboardId,
    debounceMs: 1000,  // Wait 1 second after last change
  });

  const handleLayoutChange = (newLayout: WidgetPosition[]) => {
    saveLayout(newLayout);  // Debounced - won't fire immediately
  };

  return (
    <div>
      {isSaving && <span>Saving...</span>}
      {lastSaved && <span>Saved at {lastSaved.toLocaleTimeString()}</span>}
      {/* Dashboard grid here */}
    </div>
  );
}
```

---

## Pin Hooks

### usePinnedDashboards

Get dashboards pinned to a specific context.

```tsx
import { usePinnedDashboards } from '@prismiq/react';

function FavoritesDashboards() {
  const {
    dashboards,  // Dashboard[] - pinned dashboards in order
    pins,        // PinnedDashboard[] - pin metadata
    isLoading,
    error,
    refetch,
  } = usePinnedDashboards('favorites');

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {dashboards.map((dashboard, index) => (
        <li key={dashboard.id}>
          {index + 1}. {dashboard.name}
          <small>Pinned: {new Date(pins[index].pinned_at).toLocaleDateString()}</small>
        </li>
      ))}
    </ul>
  );
}
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `string` | Context name (e.g., "favorites", "accounts") |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `dashboards` | `Dashboard[]` | Pinned dashboards in order |
| `pins` | `PinnedDashboard[]` | Pin metadata |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| null` | Error if load failed |
| `refetch` | `() => Promise<void>` | Reload pins |

---

### useDashboardPinStatus

Check if a dashboard is pinned to specific contexts.

```tsx
import { useDashboardPinStatus } from '@prismiq/react';

function PinIndicator({ dashboardId }: { dashboardId: string }) {
  const {
    contexts,    // string[] - contexts where pinned
    isPinned,    // (context: string) => boolean
    isLoading,
  } = useDashboardPinStatus(dashboardId);

  return (
    <div>
      {isPinned('favorites') && <span>Favorited</span>}
      {isPinned('accounts') && <span>Pinned to Accounts</span>}
      <small>Pinned to: {contexts.join(', ') || 'nowhere'}</small>
    </div>
  );
}
```

---

### usePinMutations

Pin and unpin dashboards.

```tsx
import { usePinMutations } from '@prismiq/react';

function PinButton({ dashboardId }: { dashboardId: string }) {
  const {
    pin,
    unpin,
    reorder,
    isPinning,
    isUnpinning,
    error,
  } = usePinMutations();

  const handlePin = async () => {
    await pin(dashboardId, 'favorites');
  };

  const handleUnpin = async () => {
    await unpin(dashboardId, 'favorites');
  };

  const handleReorder = async (dashboardIds: string[]) => {
    await reorder('favorites', dashboardIds);
  };

  return (
    <button onClick={handlePin} disabled={isPinning}>
      {isPinning ? 'Pinning...' : 'Pin to Favorites'}
    </button>
  );
}
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `pin` | `(dashboardId, context, position?) => Promise<PinnedDashboard>` | Pin dashboard |
| `unpin` | `(dashboardId, context) => Promise<void>` | Unpin dashboard |
| `reorder` | `(context, dashboardIds) => Promise<void>` | Reorder pins |
| `isPinning` | `boolean` | Pin in progress |
| `isUnpinning` | `boolean` | Unpin in progress |
| `error` | `Error \| null` | Last error |

---

## Utility Hooks

### useExport

Export query data to CSV or Excel.

```tsx
import { useExport } from '@prismiq/react';

function ExportButtons({ data }: { data: QueryResult }) {
  const { exportToCSV, exportToExcel, isExporting } = useExport();

  return (
    <div>
      <button
        onClick={() => exportToCSV(data, 'report.csv')}
        disabled={isExporting}
      >
        Export CSV
      </button>
      <button
        onClick={() => exportToExcel([{ name: 'Data', data }], 'report.xlsx')}
        disabled={isExporting}
      >
        Export Excel
      </button>
    </div>
  );
}
```

---

### useAutoRefresh

Automatically refresh query data at intervals.

```tsx
import { useAutoRefresh } from '@prismiq/react';

function LiveDashboard() {
  const { data, lastRefresh, pause, resume, isPaused } = useAutoRefresh({
    query: myQuery,
    intervalMs: 30000,  // Refresh every 30 seconds
    enabled: true,
  });

  return (
    <div>
      <span>Last updated: {lastRefresh?.toLocaleTimeString()}</span>
      <button onClick={isPaused ? resume : pause}>
        {isPaused ? 'Resume' : 'Pause'} Auto-Refresh
      </button>
      <BarChart data={data} />
    </div>
  );
}
```

---

### useFullscreen

Toggle fullscreen mode for widgets.

```tsx
import { useFullscreen } from '@prismiq/react';

function ExpandableWidget({ children }: { children: React.ReactNode }) {
  const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen, ref } =
    useFullscreen();

  return (
    <div ref={ref}>
      <button onClick={toggleFullscreen}>
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
      {children}
    </div>
  );
}
```

---

### useIsClient

Check if code is running on client (for SSR safety).

```tsx
import { useIsClient } from '@prismiq/react';

function ClientOnlyChart() {
  const isClient = useIsClient();

  if (!isClient) {
    return <div>Loading chart...</div>;
  }

  return <BarChart data={data} />;
}
```

---

### useWindowSize

Track window dimensions.

```tsx
import { useWindowSize } from '@prismiq/react';

function ResponsiveChart() {
  const { width, height } = useWindowSize();

  const chartHeight = height > 800 ? 500 : 300;

  return <BarChart data={data} height={chartHeight} />;
}
```

---

### useMediaQuery

Check if a media query matches.

```tsx
import { useMediaQuery } from '@prismiq/react';

function ResponsiveLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  return (
    <div className={isMobile ? 'mobile-layout' : 'desktop-layout'}>
      {/* ... */}
    </div>
  );
}
```

---

### useBreakpoint

Get current responsive breakpoint.

```tsx
import { useBreakpoint } from '@prismiq/react';

function AdaptiveUI() {
  const breakpoint = useBreakpoint(); // 'xs' | 'sm' | 'md' | 'lg' | 'xl'

  const columns = {
    xs: 1,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  }[breakpoint];

  return <Grid columns={columns}>{/* ... */}</Grid>;
}
```
