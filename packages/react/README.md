# @prismiq/react

React components and hooks for embedded analytics.

## Installation

```bash
npm install @prismiq/react
```

## Quick Start

```tsx
import { AnalyticsProvider, useSchema, useQuery } from '@prismiq/react';

function App() {
  return (
    <AnalyticsProvider endpoint="http://localhost:8000">
      <Dashboard />
    </AnalyticsProvider>
  );
}

function Dashboard() {
  const { schema, isLoading } = useSchema();

  const { data, error } = useQuery({
    tables: [{ id: 't1', name: 'orders' }],
    columns: [
      { tableId: 't1', name: 'status' },
      { tableId: 't1', name: 'total', aggregation: 'sum' }
    ],
    groupBy: [{ tableId: 't1', column: 'status' }]
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Orders by Status</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

## Features

- **React hooks** - `useSchema`, `useQuery` for data fetching
- **Provider pattern** - Configure once, use everywhere
- **TypeScript** - Full type safety
- **Apache ECharts** - High-performance charting (coming soon)

## Documentation

See the [main repository](https://github.com/prismiq/prismiq) for full documentation.

## License

MIT
