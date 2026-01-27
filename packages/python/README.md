# Prismiq

Open-source embedded analytics engine for Python.

## Installation

```bash
pip install prismiq
```

## Quick Start

```python
from prismiq import PrismiqEngine

# Connect to your database
engine = await PrismiqEngine.create(
    database_url="postgresql://user:pass@localhost/mydb",
    exposed_tables=["customers", "orders", "products"]
)

# Get schema
schema = await engine.get_schema()

# Execute a query
result = await engine.execute({
    "tables": [{"id": "t1", "name": "orders"}],
    "columns": [
        {"table_id": "t1", "name": "status"},
        {"table_id": "t1", "name": "total", "aggregation": "sum"}
    ],
    "group_by": [{"table_id": "t1", "column": "status"}]
})
```

## Features

- **Schema introspection** - Discover tables, columns, and relationships
- **Visual query building** - Build SQL from JSON query definitions
- **Async execution** - Non-blocking database operations with asyncpg
- **Type safe** - Full type hints with Pydantic models
- **Multi-tenant support** - Schema-based isolation with Alembic integration

## Multi-Tenant Integration

For applications with schema-based multi-tenancy, Prismiq provides SQLAlchemy declarative models and sync table creation:

```python
from sqlalchemy import create_engine
from prismiq import ensure_tables_sync, PrismiqBase

engine = create_engine("postgresql://user:pass@localhost/db")

# Create tables in a tenant-specific schema
with engine.connect() as conn:
    ensure_tables_sync(conn, schema_name="tenant_123")
    conn.commit()

# For Alembic integration, access the metadata:
# PrismiqBase.metadata.tables contains all Prismiq table definitions
```

See [Multi-Tenant Integration Guide](../../docs/multi-tenant-integration.md) for complete documentation.

## Documentation

See the [main repository](https://github.com/prismiq/prismiq) for full documentation.

## License

MIT
