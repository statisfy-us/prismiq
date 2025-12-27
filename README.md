# Prismiq

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**Open-source embedded analytics platform.** Add interactive dashboards to your app with React components and a Python backend. No iframes, no semantic layer — direct PostgreSQL access with a visual query builder.

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Docs</a> •
  <a href="#examples">Examples</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

- **🔌 Embedded React Components** — Drop charts and tables into your app, not iframes
- **🗄️ Direct Database Access** — Query PostgreSQL tables without a semantic layer
- **🎨 Visual Query Builder** — Joins, filters, aggregations — all from the UI
- **📊 Apache ECharts** — Beautiful, performant visualizations (100K+ data points)
- **🔒 Row-Level Security** — Filter data per-user with context injection
- **⚡ Fast** — Async Python, connection pooling, result caching

## Quick Start

### Install

```bash
# Python backend
pip install prismiq

# React SDK
npm install @prismiq/react
```

### Backend

```python
from prismiq import PrismiqEngine

engine = PrismiqEngine(
    database_url="postgresql://user:pass@localhost:5432/mydb",
    allowed_schemas=["public"],
)
engine.run(port=8000)
```

### Frontend

```tsx
import { AnalyticsProvider, useQuery } from '@prismiq/react';

function App() {
  return (
    <AnalyticsProvider baseUrl="http://localhost:8000">
      <SalesChart />
    </AnalyticsProvider>
  );
}

function SalesChart() {
  const { data, loading } = useQuery({
    tables: [{ schema: 'public', table: 'orders' }],
    columns: [
      { table: 'orders', column: 'status' },
      { table: 'orders', column: 'total', aggregation: 'SUM' },
    ],
    groupBy: [{ table: 'orders', column: 'status' }],
  });

  if (loading) return <div>Loading...</div>;
  
  return <BarChart data={data} />;
}
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md) *(coming soon)*
- [Security & Access Control](./docs/security.md) *(coming soon)*

## Examples

See the [`examples/`](./examples/) directory:

- **[basic-dashboard](./examples/basic-dashboard/)** — Minimal setup with schema explorer and query execution

## Architecture

```
┌─────────────────┐     HTTP/REST     ┌──────────────────┐
│  React App      │◄────────────────►│  Prismiq API     │
│  @prismiq/react │                   │  (FastAPI)       │
└─────────────────┘                   └────────┬─────────┘
                                               │
                                               │ asyncpg
                                               ▼
                                      ┌──────────────────┐
                                      │  PostgreSQL      │
                                      │  (your tables)   │
                                      └──────────────────┘
```

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`prismiq`](./packages/python/) | Python backend (FastAPI + asyncpg + SQLAlchemy Core) | 🚧 In Development |
| [`@prismiq/react`](./packages/react/) | React SDK for embedding | 🚧 In Development |

## Project Structure

```
prismiq/
├── packages/
│   ├── python/              # Python backend
│   │   ├── prismiq/         # Main package
│   │   └── tests/           # pytest tests
│   └── react/               # React SDK (@prismiq/react)
│       └── src/
├── docs/                    # Documentation
├── examples/                # Example applications
│   └── basic-dashboard/
├── .claude/                 # Claude Code agents/skills
├── tasks/                   # Sprint task definitions
├── CLAUDE.md                # Project memory for Claude Code
├── CONTRIBUTING.md          # Contribution guidelines
└── LICENSE                  # MIT License
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup
- Code style guidelines
- Pull request process

## License

[MIT](./LICENSE) — use it however you want.

---

<details>
<summary><strong>🤖 Development with Claude Code</strong></summary>

This repo includes Claude Code configuration for autonomous development:

- **Orchestrator + Subagents** — Multi-agent workflow for parallel development
- **Sprint Commands** — `/sprint week1-python` to run tasks autonomously
- **Plugins** — `feature-dev`, `pr-review-toolkit`, `frontend-design`

See [`CLAUDE.md`](./CLAUDE.md) for full details.

</details>
