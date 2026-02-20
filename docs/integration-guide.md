# Prismiq Integration Guide

Prismiq is an open-source embedded analytics platform that provides React components and a Python backend for building analytics features directly into your application—no iframes, no semantic layer, just direct table access with visual query building.

## Table of Contents

1. [Installation](#installation)
2. [Backend Setup (Python)](#backend-setup-python)
3. [Frontend Setup (React)](#frontend-setup-react)
4. [Provider Configuration](#provider-configuration)
5. [Building Queries](#building-queries)
6. [Displaying Charts](#displaying-charts)
7. [Dashboard Management](#dashboard-management)
8. [Multi-Tenancy](#multi-tenancy)
9. [Authentication](#authentication)
10. [Theming](#theming)
11. [Caching](#caching)

For detailed API reference, see:
- [Hooks Reference](./hooks-reference.md)
- [API Endpoints](./api-reference.md)
- [Types Reference](./types-reference.md)
- [SQL Mode & AI Assistant](./sql-mode.md)
- [Multi-Tenant Integration](./multi-tenant-integration.md)
- [Dashboard Pinning](./dashboard-pinning.md)

---

## Installation

### React SDK

```bash
npm install @prismiq/react
# or
pnpm add @prismiq/react
# or
yarn add @prismiq/react
```

### Python Backend

```bash
pip install prismiq
# or with uv (recommended)
uv add prismiq
```

---

## Backend Setup (Python)

### Minimal Setup

```python
from fastapi import FastAPI
from prismiq import PrismiqEngine, create_router

app = FastAPI()

# Initialize the engine
engine = PrismiqEngine(
    database_url="postgresql://user:password@localhost:5432/mydb"
)

@app.on_event("startup")
async def startup():
    await engine.startup()
    router = create_router(engine)
    app.include_router(router, prefix="/api/analytics")

@app.on_event("shutdown")
async def shutdown():
    await engine.shutdown()
```

### Full Configuration

```python
from prismiq import PrismiqEngine, create_router
from prismiq.cache import RedisCache

engine = PrismiqEngine(
    # Required
    database_url="postgresql://user:password@localhost:5432/mydb",

    # Table exposure (None = all tables)
    exposed_tables=["users", "orders", "products", "payments"],

    # Query limits
    query_timeout=30.0,      # Max execution time (seconds)
    max_rows=10000,          # Max rows per query

    # PostgreSQL schema (default: "public")
    schema_name="public",

    # Dashboard persistence (default: in-memory)
    persist_dashboards=True,  # Store dashboards in PostgreSQL

    # Caching (optional)
    cache=RedisCache("redis://localhost:6379/0"),
    query_cache_ttl=86400,   # Query cache TTL (24 hours)
    schema_cache_ttl=3600,   # Schema cache TTL (1 hour)

    # Monitoring
    enable_metrics=True,     # Prometheus metrics
)
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database_url` | `str` | Required | PostgreSQL connection URL |
| `exposed_tables` | `list[str] \| None` | `None` | Tables to expose (None = all) |
| `query_timeout` | `float` | `30.0` | Max query execution time in seconds |
| `max_rows` | `int` | `10000` | Maximum rows returned per query |
| `schema_name` | `str` | `"public"` | PostgreSQL schema name |
| `persist_dashboards` | `bool` | `False` | Store dashboards in PostgreSQL |
| `skip_table_creation` | `bool` | `False` | Skip auto-creating prismiq tables |
| `cache` | `CacheBackend \| None` | `None` | Cache backend (Redis, in-memory) |
| `query_cache_ttl` | `int` | `86400` | Query result cache TTL (seconds) |
| `schema_cache_ttl` | `int` | `3600` | Schema cache TTL (seconds) |
| `enable_metrics` | `bool` | `True` | Enable Prometheus metrics |
| `llm_config` | `LLMConfig \| None` | `None` | LLM config for AI SQL assistant ([details](./sql-mode.md)) |

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://your-app.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Using with Existing FastAPI App

```python
from fastapi import FastAPI, Depends
from prismiq import PrismiqEngine, create_router
from your_app.auth import get_current_user

app = FastAPI()
engine: PrismiqEngine | None = None

@app.on_event("startup")
async def startup():
    global engine
    engine = PrismiqEngine(database_url=os.getenv("DATABASE_URL"))
    await engine.startup()

    # Add authentication dependency to all analytics routes
    router = create_router(engine)
    app.include_router(
        router,
        prefix="/api/analytics",
        dependencies=[Depends(get_current_user)]
    )

@app.on_event("shutdown")
async def shutdown():
    if engine:
        await engine.shutdown()
```

---

## Frontend Setup (React)

### Basic Setup

```tsx
import { AnalyticsProvider, ThemeProvider, Dashboard } from '@prismiq/react';

function App() {
  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider
        config={{ endpoint: 'https://api.your-app.com/analytics' }}
        tenantId="your-tenant-id"
        userId="current-user-id"
      >
        <YourApp />
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
```

### Display a Dashboard

```tsx
import { Dashboard } from '@prismiq/react';

function AnalyticsPage() {
  return (
    <Dashboard
      id="dashboard-uuid"
      showFilters
      showTitle
    />
  );
}
```

### With Authentication

```tsx
import { AnalyticsProvider, ThemeProvider } from '@prismiq/react';
import { useAuth } from './auth'; // Your auth provider

function App() {
  const { user, getAccessToken } = useAuth();

  if (!user) return <LoginPage />;

  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider
        config={{
          endpoint: import.meta.env.VITE_API_URL + '/analytics',
          getToken: getAccessToken, // Called before each API request
        }}
        tenantId={user.organizationId}
        userId={user.id}
      >
        <AppRoutes />
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
```

---

## Provider Configuration

### AnalyticsProvider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config.endpoint` | `string` | Yes | Base URL of the Prismiq API |
| `tenantId` | `string` | Yes | Tenant ID for data isolation |
| `userId` | `string` | No | Current user ID for ownership |
| `schemaName` | `string` | No | PostgreSQL schema for per-tenant isolation |
| `config.getToken` | `() => Promise<string> \| string` | No | Function to get auth token |
| `onQueryExecute` | `(query, result) => void` | No | Callback after successful query |
| `onQueryError` | `(query, error) => void` | No | Callback on query error |
| `onSchemaLoad` | `(schema) => void` | No | Callback when schema loads |
| `onSchemaError` | `(error) => void` | No | Callback on schema load error |

### ThemeProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultMode` | `'light' \| 'dark' \| 'system'` | `'system'` | Initial theme mode |
| `lightTheme` | `DeepPartial<PrismiqTheme>` | - | Custom light theme overrides |
| `darkTheme` | `DeepPartial<PrismiqTheme>` | - | Custom dark theme overrides |
| `className` | `string` | - | CSS class for wrapper element |

### Using Context Hooks

```tsx
import { useAnalytics, useTenant, useTheme } from '@prismiq/react';

function MyComponent() {
  // Full analytics context
  const { client, schema, isLoading, error, refetchSchema } = useAnalytics();

  // Just tenant info
  const { tenantId, userId, schemaName } = useTenant();

  // Theme context
  const { theme, mode, setMode, resolvedMode } = useTheme();

  // ...
}
```

---

## Building Queries

### Query Definition Structure

```typescript
interface QueryDefinition {
  tables: QueryTable[];           // Tables to query
  joins?: JoinDefinition[];       // Table joins
  columns: ColumnSelection[];     // Columns to select
  filters?: FilterDefinition[];   // WHERE conditions
  group_by?: GroupByDefinition[]; // GROUP BY columns
  order_by?: SortDefinition[];    // ORDER BY columns
  limit?: number;                 // Row limit
  offset?: number;                // Pagination offset
  calculated_fields?: CalculatedField[];  // Computed columns
  time_series?: TimeSeriesConfig;         // Date bucketing
}
```

### Basic Query Example

```tsx
import { useQuery, BarChart } from '@prismiq/react';

function SalesByRegion() {
  const query = {
    tables: [{ id: 't1', name: 'orders' }],
    columns: [
      { table_id: 't1', column: 'region', aggregation: 'none' },
      { table_id: 't1', column: 'amount', aggregation: 'sum', alias: 'total_sales' }
    ],
    group_by: [{ table_id: 't1', column: 'region' }],
    order_by: [{ table_id: 't1', column: 'amount', direction: 'DESC' }]
  };

  const { data, isLoading, error } = useQuery(query);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <BarChart data={data} xAxis="region" yAxis={['total_sales']} />;
}
```

### Query with Joins

```tsx
const query = {
  tables: [
    { id: 't1', name: 'orders' },
    { id: 't2', name: 'customers' }
  ],
  joins: [{
    from_table_id: 't1',
    from_column: 'customer_id',
    to_table_id: 't2',
    to_column: 'id',
    join_type: 'LEFT'  // 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  }],
  columns: [
    { table_id: 't2', column: 'name', aggregation: 'none' },
    { table_id: 't1', column: 'amount', aggregation: 'sum' }
  ],
  group_by: [{ table_id: 't2', column: 'name' }]
};
```

### Query with Filters

```tsx
const query = {
  tables: [{ id: 't1', name: 'orders' }],
  columns: [
    { table_id: 't1', column: 'status', aggregation: 'none' },
    { table_id: 't1', column: 'id', aggregation: 'count' }
  ],
  filters: [
    // Equals
    { table_id: 't1', column: 'status', operator: 'eq', value: 'completed' },

    // Greater than
    { table_id: 't1', column: 'amount', operator: 'gt', value: 100 },

    // In list
    { table_id: 't1', column: 'region', operator: 'in_', value: ['US', 'CA', 'UK'] },

    // Between (date range)
    { table_id: 't1', column: 'created_at', operator: 'between', value: ['2024-01-01', '2024-12-31'] },

    // Pattern matching (case insensitive)
    { table_id: 't1', column: 'email', operator: 'ilike', value: '%@gmail.com' },

    // Null check
    { table_id: 't1', column: 'deleted_at', operator: 'is_null' }
  ],
  group_by: [{ table_id: 't1', column: 'status' }]
};
```

### Filter Operators

| Operator | Description | Value Type |
|----------|-------------|------------|
| `eq` | Equals | Single value |
| `neq` | Not equals | Single value |
| `gt` | Greater than | Single value |
| `gte` | Greater than or equal | Single value |
| `lt` | Less than | Single value |
| `lte` | Less than or equal | Single value |
| `in_` | In list | Array |
| `not_in` | Not in list | Array |
| `in_or_null` | In list or NULL | Array |
| `like` | Pattern match (case sensitive) | String with `%` wildcards |
| `ilike` | Pattern match (case insensitive) | String with `%` wildcards |
| `not_like` | Pattern not match (case sensitive) | String with `%` wildcards |
| `not_ilike` | Pattern not match (case insensitive) | String with `%` wildcards |
| `between` | Between range | `[min, max]` tuple |
| `is_null` | Is NULL | None |
| `is_not_null` | Is not NULL | None |

### Aggregation Types

| Type | SQL Equivalent | Description |
|------|---------------|-------------|
| `none` | No aggregation | Raw column value |
| `sum` | `SUM()` | Sum of values |
| `avg` | `AVG()` | Average of values |
| `count` | `COUNT()` | Count of rows |
| `count_distinct` | `COUNT(DISTINCT)` | Count of unique values |
| `min` | `MIN()` | Minimum value |
| `max` | `MAX()` | Maximum value |

### Time Series Query

```tsx
const query = {
  tables: [{ id: 't1', name: 'orders' }],
  columns: [
    { table_id: 't1', column: 'created_at', aggregation: 'none' },
    { table_id: 't1', column: 'amount', aggregation: 'sum' }
  ],
  time_series: {
    table_id: 't1',
    date_column: 'created_at',
    interval: 'month',      // 'year' | 'quarter' | 'month' | 'week' | 'day'
    fill_missing: true,     // Fill gaps with fill_value
    fill_value: 0
  }
};
```

### Date Truncation

```tsx
// Group by month without time_series config
const query = {
  tables: [{ id: 't1', name: 'orders' }],
  columns: [
    {
      table_id: 't1',
      column: 'created_at',
      aggregation: 'none',
      date_trunc: 'month'  // 'year' | 'quarter' | 'month' | 'week' | 'day'
    },
    { table_id: 't1', column: 'amount', aggregation: 'sum' }
  ],
  group_by: [{ table_id: 't1', column: 'created_at' }]
};
```

### Calculated Fields

```tsx
const query = {
  tables: [{ id: 't1', name: 'orders' }],
  calculated_fields: [
    {
      name: 'profit_margin',
      expression: '([revenue] - [cost]) / [revenue] * 100',
      data_type: 'number'
    },
    {
      name: 'order_year',
      expression: 'year([created_at])',
      data_type: 'number'
    },
    {
      name: 'is_high_value',
      expression: 'if([amount] > 1000, true, false)',
      data_type: 'boolean'
    }
  ],
  columns: [
    { table_id: 't1', column: 'region', aggregation: 'none' },
    { table_id: 't1', column: 'profit_margin', aggregation: 'avg' }
  ],
  group_by: [{ table_id: 't1', column: 'region' }]
};
```

### Custom SQL

Execute raw SQL queries programmatically:

```tsx
import { useCustomSQL } from '@prismiq/react';

function CustomReport() {
  const { data, isLoading, error } = useCustomSQL(`
    SELECT
      region,
      SUM(amount) as total,
      COUNT(*) as count
    FROM orders
    WHERE status = 'completed'
    GROUP BY region
    ORDER BY total DESC
  `);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <ResultsTable data={data} />;
}
```

The widget editor also includes a full **SQL Mode** with a built-in schema browser and an optional **AI SQL Assistant** that generates queries from natural language. See the [SQL Mode & AI Assistant](./sql-mode.md) guide for details.

#### Enabling the AI Assistant

```python
from prismiq import PrismiqEngine
from prismiq.llm import LLMConfig, LLMProviderType

engine = PrismiqEngine(
    database_url="postgresql://...",
    llm_config=LLMConfig(
        enabled=True,
        provider=LLMProviderType.GEMINI,
        model="gemini-2.0-flash",
        api_key="your-gemini-api-key",
    ),
)
```

When enabled, the chat panel appears in the widget editor's SQL mode. No frontend changes needed — the React SDK auto-detects LLM availability.

---

## Displaying Charts

### Available Chart Components

| Component | Description |
|-----------|-------------|
| `BarChart` | Vertical/horizontal bar charts with stacking |
| `LineChart` | Line charts with multi-series support |
| `AreaChart` | Area charts with fill and stacking |
| `PieChart` | Pie and donut charts |
| `ScatterChart` | Scatter plot charts |
| `MetricCard` | KPI cards with trend indicators |
| `ResultsTable` | Data tables with pagination |

### BarChart

```tsx
import { BarChart } from '@prismiq/react';

<BarChart
  data={queryResult}
  xAxis="category"
  yAxis={['sales', 'profit']}
  orientation="vertical"    // 'vertical' | 'horizontal'
  stacked={false}
  showLegend={true}
  showDataLabels={false}
  colors={['#3b82f6', '#10b981']}
  height={400}
  onDataPointClick={(params) => console.log('Clicked:', params)}
/>
```

### LineChart

```tsx
import { LineChart } from '@prismiq/react';

<LineChart
  data={queryResult}
  xAxis="date"
  yAxis={['revenue', 'expenses']}
  showPoints={true}
  smooth={false}
  showLegend={true}
  height={400}
/>
```

### AreaChart

```tsx
import { AreaChart } from '@prismiq/react';

<AreaChart
  data={queryResult}
  xAxis="month"
  yAxis={['users']}
  stacked={true}
  smooth={true}
  height={400}
/>
```

### PieChart

```tsx
import { PieChart } from '@prismiq/react';

<PieChart
  data={queryResult}
  categoryField="status"
  valueField="count"
  donut={true}            // false for regular pie
  showLabels={true}
  showLegend={true}
  height={400}
/>
```

### ScatterChart

```tsx
import { ScatterChart } from '@prismiq/react';

<ScatterChart
  data={queryResult}
  xAxis="price"
  yAxis="quantity"
  sizeField="revenue"      // Optional: bubble size
  categoryField="region"   // Optional: color by category
  height={400}
/>
```

### MetricCard

```tsx
import { MetricCard } from '@prismiq/react';

<MetricCard
  data={queryResult}
  valueColumn="total_revenue"
  format="currency"           // 'number' | 'currency' | 'percent' | 'compact'
  currencySymbol="$"
  decimalDigits={2}
  showTrend={true}
  trendColumn="growth"
  sparklineData={sparklineResult}
  title="Total Revenue"
/>
```

### ResultsTable

```tsx
import { ResultsTable } from '@prismiq/react';

<ResultsTable
  data={queryResult}
  striped={true}
  sortable={true}
  pageSize={25}
  showPagination={true}
/>
```

### Common Chart Props

All chart components accept these common props:

| Prop | Type | Description |
|------|------|-------------|
| `data` | `QueryResult` | Query result data |
| `height` | `number \| string` | Chart height |
| `width` | `number \| string` | Chart width (default: 100%) |
| `loading` | `boolean` | Show loading state |
| `error` | `Error \| null` | Show error state |
| `onDataPointClick` | `(params) => void` | Click handler |
| `colors` | `string[]` | Custom color palette |
| `showLegend` | `boolean` | Show/hide legend |

---

## Dashboard Management

### List Dashboards

```tsx
import { useDashboards } from '@prismiq/react';

function DashboardList() {
  const { dashboards, isLoading, error } = useDashboards();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {dashboards.map(dashboard => (
        <li key={dashboard.id}>
          <a href={`/dashboard/${dashboard.id}`}>{dashboard.name}</a>
        </li>
      ))}
    </ul>
  );
}
```

### Load Single Dashboard

```tsx
import { useDashboard, Dashboard } from '@prismiq/react';

function DashboardPage({ id }: { id: string }) {
  const { dashboard, isLoading, error } = useDashboard(id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{dashboard.name}</h1>
      <Dashboard id={id} showFilters showTitle />
    </div>
  );
}
```

### Create/Update/Delete Dashboards

```tsx
import { useDashboardMutations } from '@prismiq/react';

function DashboardActions() {
  const {
    createDashboard,
    updateDashboard,
    deleteDashboard,
    isCreating,
    isUpdating,
    isDeleting
  } = useDashboardMutations();

  const handleCreate = async () => {
    const dashboard = await createDashboard({
      name: 'Sales Dashboard',
      description: 'Monthly sales overview'
    });
    console.log('Created:', dashboard.id);
  };

  const handleUpdate = async (id: string) => {
    await updateDashboard(id, {
      name: 'Updated Dashboard Name'
    });
  };

  const handleDelete = async (id: string) => {
    await deleteDashboard(id);
  };

  // ...
}
```

### Dashboard Editor Component

```tsx
import { DashboardEditor } from '@prismiq/react';

function EditDashboardPage({ dashboardId }: { dashboardId: string }) {
  return (
    <DashboardEditor
      dashboardId={dashboardId}
      onSave={(dashboard) => {
        console.log('Saved:', dashboard);
        navigate(`/dashboard/${dashboard.id}`);
      }}
      onCancel={() => navigate('/dashboards')}
    />
  );
}
```

### Widget Editor Component

```tsx
import { WidgetEditor } from '@prismiq/react';

function AddWidgetPage({ dashboardId }: { dashboardId: string }) {
  return (
    <WidgetEditor
      dashboardId={dashboardId}
      onSave={(widget) => {
        console.log('Widget added:', widget);
        navigate(`/dashboard/${dashboardId}`);
      }}
      onCancel={() => navigate(`/dashboard/${dashboardId}`)}
    />
  );
}
```

### Dashboard Pinning

Pin dashboards to different contexts (pages/sections) in your app:

```tsx
import { PinButton, PinnedDashboardList, usePinnedDashboards } from '@prismiq/react';

// Add pin button to dashboard
function DashboardHeader({ dashboard }) {
  return (
    <div>
      <h1>{dashboard.name}</h1>
      <PinButton dashboardId={dashboard.id} context="favorites" />
    </div>
  );
}

// List pinned dashboards
function FavoritesDashboards() {
  const { dashboards, isLoading } = usePinnedDashboards('favorites');

  return (
    <PinnedDashboardList
      context="favorites"
      onSelect={(dashboard) => navigate(`/dashboard/${dashboard.id}`)}
    />
  );
}
```

See [Dashboard Pinning Guide](./dashboard-pinning.md) for complete documentation.

---

## Multi-Tenancy

Prismiq supports two levels of multi-tenancy:

### Header-Based Tenant Isolation

All API calls automatically include tenant headers:

```tsx
<AnalyticsProvider
  config={{ endpoint: '/api/analytics' }}
  tenantId="org_12345"    // Sent as X-Tenant-ID header
  userId="user_67890"     // Sent as X-User-ID header
>
```

The backend automatically filters all data by tenant:
- Dashboards are scoped to the tenant
- Saved queries are tenant-isolated
- Pins are per-tenant per-user

### Per-Tenant PostgreSQL Schemas

For stronger isolation, use separate PostgreSQL schemas per tenant:

```tsx
<AnalyticsProvider
  config={{ endpoint: '/api/analytics' }}
  tenantId="org_12345"
  userId="user_67890"
  schemaName="org_12345"   // Sent as X-Schema-Name header
>
```

The backend queries use the specified schema:

```sql
SELECT * FROM "org_12345"."orders" WHERE ...
```

See [Multi-Tenant Integration Guide](./multi-tenant-integration.md) for complete documentation.

---

## Authentication

### Token-Based Authentication

```tsx
import { AnalyticsProvider } from '@prismiq/react';
import { useAuth } from 'your-auth-library';

function App() {
  const { user, getAccessToken } = useAuth();

  return (
    <AnalyticsProvider
      config={{
        endpoint: '/api/analytics',
        getToken: async () => {
          // Called before each API request
          const token = await getAccessToken();
          return token;
        }
      }}
      tenantId={user.orgId}
      userId={user.id}
    >
      <Dashboard />
    </AnalyticsProvider>
  );
}
```

The token is sent as `Authorization: Bearer <token>` header on every request.

### Backend Authentication Middleware

```python
from fastapi import Depends, HTTPException, Header
from prismiq import create_router

async def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(401, "Missing authorization header")

    token = authorization.replace("Bearer ", "")
    try:
        payload = decode_jwt(token)  # Your JWT verification
        return payload
    except Exception:
        raise HTTPException(401, "Invalid token")

# Apply to all analytics routes
router = create_router(engine)
app.include_router(
    router,
    prefix="/api/analytics",
    dependencies=[Depends(verify_token)]
)
```

---

## Theming

### Theme Provider

```tsx
import { ThemeProvider } from '@prismiq/react';

<ThemeProvider
  defaultMode="system"  // 'light' | 'dark' | 'system'
  lightTheme={{
    colors: {
      primary: '#6366f1',
      primaryHover: '#4f46e5',
    },
    chart: {
      colors: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'],
    },
  }}
  darkTheme={{
    colors: {
      primary: '#818cf8',
      background: '#0f0f23',
    },
  }}
>
  <App />
</ThemeProvider>
```

### Theme Structure

```typescript
interface PrismiqTheme {
  name: string;
  colors: {
    primary: string;        // Brand color
    primaryHover: string;   // Hover state
    background: string;     // Page background
    surface: string;        // Card background
    surfaceHover: string;   // Card hover
    text: string;           // Primary text
    textMuted: string;      // Secondary text
    textInverse: string;    // Text on primary background
    border: string;         // Borders
    borderFocus: string;    // Focus rings
    success: string;        // Success state
    warning: string;        // Warning state
    error: string;          // Error state
    info: string;           // Info state
  };
  fonts: {
    sans: string;           // Body font stack
    mono: string;           // Code font stack
  };
  fontSizes: {
    xs: string;   // 10px
    sm: string;   // 12px
    base: string; // 14px
    lg: string;   // 16px
    xl: string;   // 18px
    '2xl': string; // 20px
  };
  spacing: {
    xs: string;   // 4px
    sm: string;   // 8px
    md: string;   // 12px
    lg: string;   // 16px
    xl: string;   // 24px
  };
  radius: {
    none: string; // 0
    sm: string;   // 2px
    md: string;   // 4px
    lg: string;   // 8px
    full: string; // 9999px
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  chart: {
    colors: string[];           // Chart color palette (10 colors)
    gridColor: string;          // Grid lines
    axisColor: string;          // Axis labels
    tooltipBackground: string;  // Tooltip background
  };
}
```

### Using Theme in Components

```tsx
import { useTheme } from '@prismiq/react';

function ThemeSwitcher() {
  const { mode, setMode, resolvedMode, theme } = useTheme();

  return (
    <div>
      <p>Current mode: {resolvedMode}</p>
      <button onClick={() => setMode('light')}>Light</button>
      <button onClick={() => setMode('dark')}>Dark</button>
      <button onClick={() => setMode('system')}>System</button>
    </div>
  );
}
```

### CSS Variables

ThemeProvider injects CSS variables that you can use in your styles:

```css
.my-component {
  color: var(--prismiq-color-text);
  background: var(--prismiq-color-surface);
  border: 1px solid var(--prismiq-color-border);
  border-radius: var(--prismiq-radius-md);
  padding: var(--prismiq-spacing-md);
  font-family: var(--prismiq-font-sans);
  font-size: var(--prismiq-font-size-base);
  box-shadow: var(--prismiq-shadow-sm);
}

.chart-container {
  --chart-color-1: var(--prismiq-chart-color-1);
  --chart-color-2: var(--prismiq-chart-color-2);
}
```

### Default Color Palettes

**Light Theme:**
- Primary: `#3b82f6` (blue)
- Background: `#ffffff`
- Surface: `#f9fafb`
- Text: `#111827`
- Chart colors: blue, emerald, amber, red, violet, cyan, orange, lime, pink, indigo

**Dark Theme:**
- Primary: `#60a5fa` (light blue)
- Background: `#111827`
- Surface: `#1f2937`
- Text: `#f9fafb`
- Chart colors: lighter variants of light theme

---

## Caching

### Redis Cache

```python
from prismiq import PrismiqEngine
from prismiq.cache import RedisCache

# Initialize Redis cache
redis_cache = RedisCache("redis://localhost:6379/0")
await redis_cache.connect()

engine = PrismiqEngine(
    database_url="...",
    cache=redis_cache,
    query_cache_ttl=86400,   # 24 hours for query results
    schema_cache_ttl=3600,   # 1 hour for schema
)

# Don't forget to disconnect on shutdown
await redis_cache.disconnect()
```

### In-Memory Cache

```python
from prismiq import PrismiqEngine
from prismiq.cache import InMemoryCache

engine = PrismiqEngine(
    database_url="...",
    cache=InMemoryCache(max_size=1000),
)
```

### Bypass Cache (Client-Side)

```tsx
import { useQuery } from '@prismiq/react';

function RefreshableChart() {
  const [bypassCache, setBypassCache] = useState(false);
  const { data, refetch } = useQuery(query, { bypassCache });

  const handleRefresh = () => {
    setBypassCache(true);
    refetch();
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh Data</button>
      <BarChart data={data} />
    </div>
  );
}
```

### Bypass Cache (Direct Client)

```tsx
const { client } = useAnalytics();

// Force fresh data
const result = await client.executeQuery(query, true); // bypassCache = true
```

---

## Complete Example

```tsx
// App.tsx
import { AnalyticsProvider, ThemeProvider } from '@prismiq/react';
import { useAuth } from './auth';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export function App() {
  const { user, getAccessToken } = useAuth();

  if (!user) return <LoginPage />;

  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider
        config={{
          endpoint: import.meta.env.VITE_API_URL + '/analytics',
          getToken: getAccessToken,
        }}
        tenantId={user.organizationId}
        userId={user.id}
        onQueryError={(query, error) => {
          console.error('Query failed:', error);
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/dashboards" element={<DashboardListPage />} />
            <Route path="/dashboard/:id" element={<DashboardPage />} />
            <Route path="/dashboard/:id/edit" element={<EditDashboardPage />} />
            <Route path="/explore" element={<ExplorePage />} />
          </Routes>
        </BrowserRouter>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

// pages/DashboardPage.tsx
import { Dashboard, useDashboard, PinButton } from '@prismiq/react';
import { useParams } from 'react-router-dom';

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { dashboard, isLoading, error } = useDashboard(id!);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{dashboard.name}</h1>
        <PinButton dashboardId={id!} context="favorites" />
      </div>
      <Dashboard id={id!} showFilters />
    </div>
  );
}

// pages/ExplorePage.tsx
import { useSchema, useQuery, BarChart, QueryBuilder } from '@prismiq/react';
import { useState } from 'react';

export function ExplorePage() {
  const { schema, isLoading: schemaLoading } = useSchema();
  const [query, setQuery] = useState<QueryDefinition | null>(null);
  const { data, isLoading, error } = useQuery(query);

  if (schemaLoading) return <Spinner />;

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold mb-4">Query Builder</h2>
        <QueryBuilder
          schema={schema}
          value={query}
          onChange={setQuery}
        />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        {isLoading && <Spinner />}
        {error && <ErrorMessage error={error} />}
        {data && (
          <BarChart
            data={data}
            xAxis={data.columns[0]}
            yAxis={[data.columns[1]]}
          />
        )}
      </div>
    </div>
  );
}
```

---

## Next Steps

- [SQL Mode & AI Assistant](./sql-mode.md) - Custom SQL editing and LLM-powered query generation
- [Hooks Reference](./hooks-reference.md) - Complete hooks documentation
- [API Reference](./api-reference.md) - Backend API endpoints
- [Types Reference](./types-reference.md) - TypeScript type definitions
- [Multi-Tenant Integration](./multi-tenant-integration.md) - Multi-tenancy patterns
- [Dashboard Pinning](./dashboard-pinning.md) - Pin feature documentation
