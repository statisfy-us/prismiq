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

## Individual Commands

```bash
# Start just the database
make demo-db

# Seed/reseed data
make demo-seed

# Start backend only (requires DB)
make demo-backend

# Start frontend only (requires backend)
make demo-frontend
```

## Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   React App      │───>│   FastAPI        │───>│   PostgreSQL     │
│   (port 5173)    │    │   (port 8000)    │    │   (port 5432)    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                        │                       │
                        ├── /api/schema         ├── customers
                        ├── /api/query/execute  ├── products
                        ├── /api/dashboards     ├── orders
                        └── /api/health         ├── order_items
                                                └── events
```

## Customization

### Add Your Own Data

Edit `backend/seed_data.py` to customize the sample data generation.

```python
# Increase data volume
customer_ids = await seed_customers(conn, count=1000)
product_ids = await seed_products(conn, count=200)
await seed_orders(conn, customer_ids, product_ids, order_count=5000)
```

### Create New Dashboards

Use the Dashboard API to create dashboards programmatically, or modify `backend/seed_dashboards.py`.

```python
from prismiq import DashboardCreate, WidgetCreate, WidgetType, WidgetPosition

# Create a dashboard
dashboard = await store.create_dashboard(
    DashboardCreate(
        name="My Dashboard",
        description="Custom analytics"
    )
)

# Add a widget
await store.add_widget(
    dashboard.id,
    WidgetCreate(
        type=WidgetType.BAR_CHART,
        title="Revenue by Region",
        position=WidgetPosition(x=0, y=0, w=6, h=4),
        query=QueryDefinition(...)
    )
)
```

### Connect to Your Database

Set the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/mydb make demo-backend
```

Or edit `examples/demo/.env`:

```
DATABASE_URL=postgresql://user:pass@host:5432/mydb
```

## API Endpoints

The backend exposes these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check with DB status |
| `GET /api/schema` | Database schema (tables, columns, relationships) |
| `GET /api/tables` | List of table names |
| `GET /api/tables/{name}` | Single table schema |
| `POST /api/query/execute` | Execute a query |
| `POST /api/query/preview` | Execute with row limit |
| `POST /api/query/validate` | Validate query syntax |
| `GET /api/dashboards` | List dashboards |
| `GET /api/dashboards/{id}` | Get dashboard by ID |
| `POST /api/dashboards` | Create dashboard |
| `POST /api/dashboards/{id}/widgets` | Add widget |

See full API documentation at http://localhost:8000/docs

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
docker compose -f examples/demo/docker-compose.yml logs postgres
```

### Frontend not loading

Check that the backend is running on port 8000:

```bash
curl http://localhost:8000/api/health
```

### Module not found errors

Ensure dependencies are installed:

```bash
# From repo root
make install

# Or manually
cd packages/python && uv sync --dev
cd packages/react && npm install
cd examples/demo/frontend && npm install
```

### Docker not available

If you don't have Docker, use an external PostgreSQL:

```bash
# With cloud DB (Neon, Supabase, etc.)
DATABASE_URL=postgresql://user:pass@host/db make demo-seed
DATABASE_URL=postgresql://user:pass@host/db make demo-backend
```

## File Structure

```
examples/demo/
├── backend/
│   ├── __init__.py
│   ├── main.py           # FastAPI application
│   ├── seed_data.py      # Sample data generator
│   └── seed_dashboards.py # Dashboard definitions
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   └── pages/
│   │       ├── DashboardPage.tsx
│   │       ├── ExplorePage.tsx
│   │       └── SchemaPage.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml    # PostgreSQL container
├── .env                  # Environment variables
└── README.md             # This file
```

## Development

To modify the demo:

1. **Backend changes**: Edit files in `backend/`, restart with `make demo-backend`
2. **Frontend changes**: Vite hot-reloads automatically
3. **Data changes**: Modify `seed_data.py`, then `make demo-seed`
4. **Dashboard changes**: Modify `seed_dashboards.py`, restart backend
