# Demo Implementation Tasks

## Overview
Build a reference implementation with FastAPI backend, React frontend, sample data, and default dashboards.

## Prerequisites
- Week 5 complete
- PostgreSQL available (Docker or local)

## Validation
```bash
make demo  # Should start everything
# Visit http://localhost:5173
```

---

## Task 1: Backend Setup

**Files:**
- `examples/demo/backend/main.py`
- `examples/demo/backend/__init__.py`

**Requirements:**
- FastAPI app with CORS enabled (allow localhost:5173)
- PrismiqEngine initialization from DATABASE_URL env var
- Include prismiq router at /api
- Startup: connect to DB, seed dashboards
- Shutdown: cleanup
- Run on port 8000

**Example structure:**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prismiq import PrismiqEngine, create_router, InMemoryDashboardStore
import os

app = FastAPI(title="Prismiq Demo")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)

engine: PrismiqEngine | None = None
dashboard_store = InMemoryDashboardStore()

@app.on_event("startup")
async def startup():
    global engine
    engine = PrismiqEngine(database_url=os.getenv("DATABASE_URL"))
    await engine.startup()
    router = create_router(engine, dashboard_store)
    app.include_router(router, prefix="/api")
    # Seed dashboards
    from seed_dashboards import seed_dashboards
    await seed_dashboards(dashboard_store)

@app.on_event("shutdown")
async def shutdown():
    if engine:
        await engine.shutdown()
```

---

## Task 2: Sample Data Generator

**File:** `examples/demo/backend/seed_data.py`

**Standalone script** that:
1. Connects to PostgreSQL via DATABASE_URL
2. Creates tables if not exist
3. Inserts sample data

**Tables to create:**

```sql
-- customers (100 rows)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    region VARCHAR(50),           -- North, South, East, West
    tier VARCHAR(20),             -- Gold, Silver, Bronze
    created_at TIMESTAMP DEFAULT NOW()
);

-- products (50 rows)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),         -- Electronics, Clothing, Home, Sports
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0
);

-- orders (500 rows, dates span last 90 days)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_date DATE NOT NULL,
    status VARCHAR(20),           -- pending, completed, cancelled
    total_amount DECIMAL(10,2),
    shipping_address TEXT
);

-- order_items (1500 rows)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- events (5000 rows for time series)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50),       -- page_view, signup, purchase, login
    user_id INTEGER,
    timestamp TIMESTAMP NOT NULL,
    properties JSONB
);
```

**Data generation:**
- Use `faker` library for realistic names/emails
- Randomize regions: ["North", "South", "East", "West"]
- Randomize tiers: ["Gold", "Silver", "Bronze"]
- Categories: ["Electronics", "Clothing", "Home", "Sports"]
- Order dates: random dates in last 90 days
- Order status: 70% completed, 20% pending, 10% cancelled
- Event types: ["page_view", "signup", "purchase", "login"]

**Run with:** `python seed_data.py` (uses asyncpg)

---

## Task 3: Dashboard Seeding

**File:** `examples/demo/backend/seed_dashboards.py`

**Function:** `async def seed_dashboards(store: DashboardStore) -> None`

Creates two dashboards with widgets:

**Dashboard 1: Sales Overview** (id: "sales-overview")

Widgets layout (12-column grid):
```
Row 0-2:  [Metric 3w] [Metric 3w] [Metric 3w] [Metric 3w]
Row 2-6:  [BarChart 6w        ] [PieChart 6w          ]
Row 6-10: [LineChart 8w               ] [Table 4w    ]
```

1. **Total Revenue** (metric, x:0 y:0 w:3 h:2)
   - Query: SELECT SUM(total_amount) FROM orders WHERE status='completed'

2. **Order Count** (metric, x:3 y:0 w:3 h:2)
   - Query: SELECT COUNT(*) FROM orders

3. **Avg Order Value** (metric, x:6 y:0 w:3 h:2)
   - Query: SELECT AVG(total_amount) FROM orders WHERE status='completed'

4. **Customer Count** (metric, x:9 y:0 w:3 h:2)
   - Query: SELECT COUNT(*) FROM customers

5. **Revenue by Region** (bar_chart, x:0 y:2 w:6 h:4)
   - Query: SELECT c.region, SUM(o.total_amount)
            FROM orders o JOIN customers c ON o.customer_id=c.id
            GROUP BY c.region

6. **Sales by Category** (pie_chart, x:6 y:2 w:6 h:4)
   - Query: SELECT p.category, SUM(oi.quantity * oi.unit_price)
            FROM order_items oi JOIN products p ON oi.product_id=p.id
            GROUP BY p.category

7. **Daily Revenue** (line_chart, x:0 y:6 w:8 h:4)
   - Query: SELECT order_date, SUM(total_amount)
            FROM orders WHERE status='completed'
            GROUP BY order_date ORDER BY order_date

8. **Top Customers** (table, x:8 y:6 w:4 h:4)
   - Query: SELECT c.name, SUM(o.total_amount) as total_spend
            FROM orders o JOIN customers c ON o.customer_id=c.id
            GROUP BY c.id, c.name ORDER BY total_spend DESC LIMIT 10

**Dashboard 2: Product Analytics** (id: "product-analytics")

1. **Total Products** (metric)
2. **Avg Price** (metric)
3. **Top Selling Products** (bar_chart)
4. **Revenue by Category Over Time** (area_chart)

---

## Task 4: Frontend Vite Project

**Directory:** `examples/demo/frontend/`

**Initialize:**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install react-router-dom
npm link ../../../packages/react  # Link local @prismiq/react
```

**Files to create/modify:**

**package.json:**
```json
{
  "name": "prismiq-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@prismiq/react": "link:../../../packages/react"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

**index.html:** Standard Vite template with div#root

**src/main.tsx:** React 18 createRoot entry point

---

## Task 5: Frontend Pages

**src/App.tsx:**
```tsx
import { AnalyticsProvider, ThemeProvider } from '@prismiq/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ExplorePage } from './pages/ExplorePage'
import { SchemaPage } from './pages/SchemaPage'

export function App() {
  return (
    <AnalyticsProvider config={{ endpoint: '/api' }}>
      <ThemeProvider defaultMode="system">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="schema" element={<SchemaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AnalyticsProvider>
  )
}
```

**src/components/Layout.tsx:**
- Sidebar navigation with links to Dashboard, Explore, Schema
- Theme toggle button (light/dark)
- Outlet for nested routes
- Clean, minimal styling

**src/pages/DashboardPage.tsx:**
```tsx
import { Dashboard } from '@prismiq/react'

export function DashboardPage() {
  return (
    <div style={{ padding: '24px' }}>
      <Dashboard
        id="sales-overview"
        showFilters={true}
        showTitle={true}
      />
    </div>
  )
}
```

**src/pages/ExplorePage.tsx:**
```tsx
import { QueryBuilder, ResultsTable, useQuery } from '@prismiq/react'
import { useState } from 'react'

export function ExplorePage() {
  const [query, setQuery] = useState(null)
  const { data, isLoading, error } = useQuery(query, { enabled: !!query })

  return (
    <div style={{ display: 'flex', gap: '24px', padding: '24px' }}>
      <div style={{ width: '400px' }}>
        <QueryBuilder onQueryChange={setQuery} />
      </div>
      <div style={{ flex: 1 }}>
        {data && <ResultsTable data={data} />}
        {isLoading && <div>Loading...</div>}
        {error && <div>Error: {error.message}</div>}
      </div>
    </div>
  )
}
```

**src/pages/SchemaPage.tsx:**
```tsx
import { SchemaExplorer } from '@prismiq/react'

export function SchemaPage() {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Database Schema</h1>
      <SchemaExplorer />
    </div>
  )
}
```

---

## Task 6: Docker Compose

**File:** `examples/demo/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: prismiq
      POSTGRES_PASSWORD: prismiq_demo
      POSTGRES_DB: prismiq_demo
    ports:
      - "5432:5432"
    volumes:
      - demo_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U prismiq -d prismiq_demo"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  demo_postgres_data:
```

**File:** `examples/demo/.env`
```
DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo
```

---

## Task 7: Makefile Integration

**Add to root Makefile:**

```makefile
# Demo targets
.PHONY: demo demo-backend demo-frontend demo-stop demo-seed

demo: demo-stop
	@echo "Starting Prismiq Demo..."
	@echo "1. Starting PostgreSQL..."
	docker compose -f examples/demo/docker-compose.yml up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3
	@echo "2. Seeding sample data..."
	cd examples/demo/backend && DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo uv run python seed_data.py
	@echo "3. Starting backend server..."
	cd examples/demo/backend && DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo uv run python main.py &
	@sleep 2
	@echo "4. Starting frontend..."
	cd examples/demo/frontend && npm install && npm run dev
	@echo ""
	@echo "Demo running at http://localhost:5173"

demo-stop:
	@echo "Stopping demo..."
	-docker compose -f examples/demo/docker-compose.yml down 2>/dev/null
	-pkill -f "examples/demo/backend/main.py" 2>/dev/null || true
	@echo "Demo stopped."

demo-seed:
	@echo "Seeding demo data..."
	cd examples/demo/backend && DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo uv run python seed_data.py
```

---

## Task 8: Documentation

**File:** `examples/demo/README.md`

```markdown
# Prismiq Demo

A complete reference implementation showcasing Prismiq's embedded analytics capabilities.

## Quick Start

```bash
# From repository root
make demo
```

This will:
1. Start PostgreSQL in Docker
2. Seed sample data (customers, orders, products)
3. Start the FastAPI backend on port 8000
4. Start the React frontend on port 5173

**Open http://localhost:5173 in your browser.**

## What's Included

### Sample Data
- **100 customers** with regions (North, South, East, West) and tiers (Gold, Silver, Bronze)
- **50 products** across categories (Electronics, Clothing, Home, Sports)
- **500 orders** from the last 90 days
- **1,500 order items** linking orders to products
- **5,000 events** for time-series analysis

### Default Dashboards

**Sales Overview** - Key business metrics
- Total Revenue, Order Count, Avg Order Value, Customer Count
- Revenue by Region (bar chart)
- Sales by Category (pie chart)
- Daily Revenue trend (line chart)
- Top Customers (table)

**Product Analytics** - Product performance
- Product counts and pricing
- Top selling products
- Category trends over time

### Pages

- **/dashboard** - Pre-built Sales Overview dashboard
- **/explore** - Query Builder for ad-hoc analysis
- **/schema** - Browse database tables and columns

## Stop the Demo

```bash
make demo-stop
```

## Customization

### Add Your Own Data

Edit `backend/seed_data.py` to customize the sample data generation.

### Create New Dashboards

Use the Dashboard API to create dashboards programmatically, or modify `backend/seed_dashboards.py`.

### Connect to Your Database

Set the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/mydb make demo
```

## Troubleshooting

### Port already in use
```bash
make demo-stop  # Stop any running demo
make demo       # Restart
```

### Database connection failed
Ensure PostgreSQL is running:
```bash
docker compose -f examples/demo/docker-compose.yml up -d postgres
```

### Frontend not loading
Check that the backend is running on port 8000:
```bash
curl http://localhost:8000/api/health
```
```

---

## Completion Criteria

- [ ] `make demo` starts DB, seeds data, runs backend and frontend
- [ ] http://localhost:5173 shows working dashboard
- [ ] All chart types render correctly (metric, bar, line, pie, table)
- [ ] Explore page executes custom queries
- [ ] Schema page shows table/column info
- [ ] Theme toggle switches light/dark
- [ ] `make demo-stop` cleanly stops everything
- [ ] README provides clear quick start instructions
