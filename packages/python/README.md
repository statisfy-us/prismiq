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

## Documentation

See the [main repository](https://github.com/prismiq/prismiq) for full documentation.

## License

MIT
