# Getting Started with Prismiq

Prismiq is an open-source embedded analytics platform that lets you add interactive dashboards and visualizations to your application—no iframes, no semantic layer, just direct table access with visual query building.

## Installation

### Python Backend

```bash
pip install prismiq
# or with uv (recommended)
uv add prismiq
```

### React SDK

```bash
npm install @prismiq/react
# or
pnpm add @prismiq/react
```

## Quick Start

### 1. Set Up the Backend

Create a FastAPI application with Prismiq:

```python
from fastapi import FastAPI
from prismiq import PrismiqEngine, create_router

app = FastAPI()
engine: PrismiqEngine | None = None

@app.on_event("startup")
async def startup():
    global engine
    engine = PrismiqEngine(
        database_url="postgresql://user:password@localhost:5432/mydb",
        persist_dashboards=True,  # Store dashboards in PostgreSQL
    )
    await engine.startup()

    router = create_router(engine)
    app.include_router(router, prefix="/api/analytics")

@app.on_event("shutdown")
async def shutdown():
    if engine:
        await engine.shutdown()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Run it:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/mydb python main.py
```

### 2. Connect from React

Wrap your app with providers:

```tsx
import { AnalyticsProvider, ThemeProvider } from '@prismiq/react';

function App() {
  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider
        config={{ endpoint: 'http://localhost:8000/api/analytics' }}
        tenantId="my-tenant"
        userId="my-user"
      >
        <MyDashboard />
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
```

### 3. Display Data

Use hooks to query your database:

```tsx
import { useQuery, BarChart } from '@prismiq/react';

function MyDashboard() {
  const query = {
    tables: [{ id: 't1', name: 'orders' }],
    columns: [
      { table_id: 't1', column: 'status', aggregation: 'none' },
      { table_id: 't1', column: 'amount', aggregation: 'sum' }
    ],
    group_by: [{ table_id: 't1', column: 'status' }]
  };

  const { data, isLoading, error } = useQuery(query);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Orders by Status</h1>
      <BarChart data={data} xAxis="status" yAxis={['amount']} />
    </div>
  );
}
```

## Core Concepts

### Query Definition

Prismiq uses a declarative query format that maps directly to SQL:

```typescript
const query = {
  // Tables to query
  tables: [
    { id: 't1', name: 'orders' },
    { id: 't2', name: 'customers' }
  ],

  // Joins between tables
  joins: [{
    from_table_id: 't1',
    from_column: 'customer_id',
    to_table_id: 't2',
    to_column: 'id',
    join_type: 'LEFT'
  }],

  // Columns to select (with optional aggregation)
  columns: [
    { table_id: 't2', column: 'name', aggregation: 'none' },
    { table_id: 't1', column: 'amount', aggregation: 'sum' }
  ],

  // Filters (WHERE clause)
  filters: [
    { table_id: 't1', column: 'status', operator: 'eq', value: 'completed' }
  ],

  // Group by
  group_by: [{ table_id: 't2', column: 'name' }],

  // Order by
  order_by: [{ table_id: 't1', column: 'amount', direction: 'DESC' }],

  // Limit results
  limit: 10
};
```

### Schema Discovery

The backend automatically discovers your database schema:

```tsx
import { useSchema } from '@prismiq/react';

function SchemaExplorer() {
  const { schema, isLoading, error } = useSchema();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Available Tables</h2>
      <ul>
        {schema.tables.map(table => (
          <li key={table.name}>
            <strong>{table.name}</strong> ({table.columns.length} columns)
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Dashboard Management

Create and display dashboards:

```tsx
import { Dashboard, useDashboardMutations } from '@prismiq/react';

// Display an existing dashboard
function DashboardView({ id }: { id: string }) {
  return <Dashboard id={id} showFilters showTitle />;
}

// Create a new dashboard
function CreateDashboard() {
  const { createDashboard, isCreating } = useDashboardMutations();

  const handleCreate = async () => {
    const dashboard = await createDashboard({
      name: 'My Dashboard',
      description: 'Sales metrics overview'
    });
    console.log('Created:', dashboard.id);
  };

  return (
    <button onClick={handleCreate} disabled={isCreating}>
      Create Dashboard
    </button>
  );
}
```

### Multi-Tenancy

All data is isolated by tenant:

```tsx
<AnalyticsProvider
  config={{ endpoint: '/api/analytics' }}
  tenantId="org_12345"      // Required: isolates all data
  userId="user_67890"       // Optional: for ownership
  schemaName="org_12345"    // Optional: per-tenant PostgreSQL schema
>
```

## Available Chart Types

| Component | Description |
|-----------|-------------|
| `BarChart` | Vertical/horizontal bar charts |
| `LineChart` | Line charts with multi-series |
| `AreaChart` | Filled area charts |
| `PieChart` | Pie and donut charts |
| `ScatterChart` | Scatter plots |
| `MetricCard` | KPI cards with trends |
| `ResultsTable` | Data tables with pagination |

## Next Steps

- [Integration Guide](./integration-guide.md) - Complete setup and configuration
- [SQL Mode & AI Assistant](./sql-mode.md) - Custom SQL editing and LLM-powered query generation
- [Hooks Reference](./hooks-reference.md) - All available React hooks
- [API Reference](./api-reference.md) - Backend API endpoints
- [Types Reference](./types-reference.md) - TypeScript type definitions
- [Multi-Tenant Integration](./multi-tenant-integration.md) - Multi-tenancy patterns
- [Dashboard Pinning](./dashboard-pinning.md) - Pin feature documentation
