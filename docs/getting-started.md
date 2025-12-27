# Getting Started with Prismiq

Prismiq is an open-source embedded analytics platform that lets you add interactive dashboards and visualizations to your application.

## Installation

### Python Backend

```bash
pip install prismiq
```

### React SDK

```bash
npm install @prismiq/react
# or
pnpm add @prismiq/react
```

## Quick Start

### 1. Configure the Backend

```python
from prismiq import PrismiqEngine

# Initialize with your database connection
engine = PrismiqEngine(
    database_url="postgresql://user:pass@localhost:5432/mydb",
    allowed_schemas=["public", "analytics"],
)

# Start the API server
engine.run(host="0.0.0.0", port=8000)
```

### 2. Connect from React

```tsx
import { AnalyticsProvider, useQuery } from '@prismiq/react';

function App() {
  return (
    <AnalyticsProvider baseUrl="http://localhost:8000">
      <Dashboard />
    </AnalyticsProvider>
  );
}

function Dashboard() {
  const { data, loading, error } = useQuery({
    tables: [{ schema: 'public', table: 'orders' }],
    columns: [
      { table: 'orders', column: 'status' },
      { table: 'orders', column: 'total', aggregation: 'SUM' },
    ],
    groupBy: [{ table: 'orders', column: 'status' }],
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <table>
      <thead>
        <tr>
          {data.columns.map(col => <th key={col}>{col}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Core Concepts

### Query Definition

Prismiq uses a declarative query format that maps directly to SQL:

```typescript
interface QueryDefinition {
  tables: Array<{ schema: string; table: string; alias?: string }>;
  joins?: JoinDefinition[];
  columns: ColumnSelection[];
  filters?: FilterDefinition[];
  groupBy?: GroupByDefinition[];
  orderBy?: SortDefinition[];
  limit?: number;
  offset?: number;
}
```

### Schema Discovery

The backend automatically discovers your database schema:

```typescript
const { data: schema } = useSchema();

// schema.tables = [
//   { schema: 'public', name: 'orders', columns: [...] },
//   { schema: 'public', name: 'customers', columns: [...] },
// ]
```

## Next Steps

- [API Reference](./api-reference.md)
- [Examples](../examples/)
- [Security & Access Control](./security.md)
