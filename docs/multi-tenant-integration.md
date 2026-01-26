# Multi-Tenant Integration

Prismiq supports schema-based multi-tenancy where each tenant has isolated data in separate PostgreSQL schemas. This guide covers how to integrate Prismiq's persistence layer with your multi-tenant application.

## Overview

Prismiq stores dashboard and widget metadata in three tables:
- `prismiq_dashboards` - Dashboard definitions
- `prismiq_widgets` - Widget configurations
- `prismiq_saved_queries` - Reusable query definitions

For multi-tenant applications, these tables can be created in tenant-specific schemas (e.g., `tenant_123`) to ensure complete data isolation.

## Integration Options

### Option 1: Alembic Migrations (Recommended)

If your application uses Alembic for database migrations, you can integrate Prismiq tables into your existing migration workflow.

#### Step 1: Add Prismiq to Target Metadata

In your `env.py`, import `PrismiqBase` and add its tables to your target metadata:

```python
# env.py
from alembic import context
from your_app.models import Base  # Your existing models

# Import Prismiq declarative base
from prismiq import PrismiqBase

# Combine metadata from multiple sources
target_metadata = Base.metadata

# Add Prismiq tables to the migration target
for table in PrismiqBase.metadata.tables.values():
    table.to_metadata(target_metadata)
```

#### Step 2: Generate Migration

```bash
# For schema-based multi-tenancy
alembic -x tenant=tenant_123 revision -m "add prismiq tables" --autogenerate

# Review the generated migration
alembic -x tenant=tenant_123 upgrade head
```

The generated migration will include all Prismiq tables with proper indexes and constraints.

### Option 2: Programmatic Table Creation

For applications that create tenant schemas programmatically (e.g., during tenant provisioning), use `ensure_tables_sync`:

```python
from sqlalchemy import create_engine
from prismiq import ensure_tables_sync, TableCreationError

engine = create_engine("postgresql://user:pass@localhost/db")

def provision_tenant_tables(schema_name: str):
    """Create Prismiq tables in an existing tenant schema.

    The schema must already exist. This function only creates the Prismiq
    tables within the specified schema.

    Args:
        schema_name: Name of existing PostgreSQL schema (e.g., "tenant_123")

    Raises:
        ValueError: If schema_name is invalid (empty, special chars, reserved)
        TableCreationError: If schema doesn't exist or table creation fails
    """
    with engine.connect() as conn:
        # Create Prismiq tables in the tenant schema
        # Raises TableCreationError if schema doesn't exist
        ensure_tables_sync(conn, schema_name=schema_name)
        conn.commit()
```

> **Important:** The schema must exist before calling `ensure_tables_sync`. If the schema
> doesn't exist, a `TableCreationError` is raised. Create schemas as part of your tenant
> provisioning process before calling this function.

> **Note:** `ensure_tables_sync` validates the schema name and rejects:
> - Empty strings
> - Names with special characters (only alphanumeric and underscore allowed)
> - Reserved schemas (`public`, `information_schema`, `pg_catalog`, `pg_toast`)

### Option 3: Async Table Creation

For async applications using asyncpg directly, you need to execute the schema SQL within a connection that has the correct `search_path`:

```python
import asyncpg
from pathlib import Path

async def setup_tenant_tables(pool: asyncpg.Pool, schema_name: str):
    """Create Prismiq tables in an existing tenant schema using raw SQL.

    The schema must already exist. This reads schema.sql directly because
    ensure_tables() acquires a new connection that wouldn't inherit the
    search_path setting.

    Args:
        pool: asyncpg connection pool
        schema_name: Name of existing PostgreSQL schema

    Raises:
        asyncpg.InvalidSchemaNameError: If schema doesn't exist
    """
    # Read the schema SQL from prismiq package
    from prismiq.persistence.setup import _get_schema_sql
    schema_sql = _get_schema_sql()

    async with pool.acquire() as conn:
        # Set search path to existing schema and create tables
        await conn.execute(f'SET search_path TO "{schema_name}"')
        await conn.execute(schema_sql)
```

> **Important:** The schema must exist before calling this function. The `ensure_tables(pool)`
> function creates tables in the default schema because it acquires a fresh connection.
> For schema-based multi-tenancy with asyncpg, either use **Option 2** with SQLAlchemy,
> or execute the schema SQL directly as shown above.

## SQLAlchemy Declarative Models

Prismiq provides SQLAlchemy ORM models for use with Alembic and other SQLAlchemy-based tools:

```python
from prismiq import (
    PrismiqBase,      # Declarative base with separate metadata
    PrismiqDashboard, # Dashboard model
    PrismiqWidget,    # Widget model
    PrismiqSavedQuery # Saved query model
)

# Access the metadata containing all tables
tables = PrismiqBase.metadata.tables
# {'prismiq_dashboards': Table(...), 'prismiq_widgets': Table(...), 'prismiq_saved_queries': Table(...)}
```

### Model Definitions

#### PrismiqDashboard

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | VARCHAR(255) | Tenant identifier |
| `name` | VARCHAR(255) | Dashboard name (unique per tenant) |
| `description` | TEXT | Optional description |
| `layout` | JSONB | Grid layout config `{columns, rowHeight, margin}` |
| `filters` | JSONB | Dashboard-level filters |
| `owner_id` | VARCHAR(255) | Owner user ID |
| `is_public` | BOOLEAN | Visible to all tenant users |
| `allowed_viewers` | TEXT[] | User IDs with view permission |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last modified timestamp |

#### PrismiqWidget

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `dashboard_id` | UUID | Foreign key to dashboard (CASCADE delete) |
| `type` | VARCHAR(50) | Widget type (bar, line, table, etc.) |
| `title` | VARCHAR(255) | Widget title |
| `query` | JSONB | Query definition (null for text widgets) |
| `position` | JSONB | Grid position `{x, y, w, h}` |
| `config` | JSONB | Widget-specific configuration |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last modified timestamp |

#### PrismiqSavedQuery

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | VARCHAR(255) | Tenant identifier |
| `name` | VARCHAR(255) | Query name (unique per tenant) |
| `description` | TEXT | Optional description |
| `query` | JSONB | Query definition |
| `owner_id` | VARCHAR(255) | Owner user ID |
| `is_shared` | BOOLEAN | Visible to other tenant users |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last modified timestamp |

## Indexes

The following indexes are automatically created:

| Table | Index | Columns |
|-------|-------|---------|
| `prismiq_dashboards` | `idx_dashboards_tenant_id` | `tenant_id` |
| `prismiq_dashboards` | `idx_dashboards_owner_id` | `tenant_id, owner_id` |
| `prismiq_widgets` | `idx_widgets_dashboard_id` | `dashboard_id` |
| `prismiq_saved_queries` | `idx_saved_queries_tenant` | `tenant_id` |

## Schema Migration for Existing Tenants

When adding Prismiq to an existing multi-tenant application:

### 1. Create Initial Migration

```python
# migrations/versions/xxx_add_prismiq_tables.py
"""Add Prismiq analytics tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

def upgrade():
    # Create dashboards table
    op.create_table(
        'prismiq_dashboards',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        # ... other columns
    )
    # ... create other tables and indexes

def downgrade():
    op.drop_table('prismiq_widgets')
    op.drop_table('prismiq_dashboards')
    op.drop_table('prismiq_saved_queries')
```

### 2. Run Migration for All Tenants

```bash
# Script to run migration for all existing tenants
for tenant in $(get_all_tenant_ids); do
    alembic -x tenant=$tenant upgrade head
done
```

## Best Practices

1. **Always use schema isolation** - Create Prismiq tables in tenant-specific schemas to ensure data isolation.

2. **Include in tenant provisioning** - Add `ensure_tables_sync()` to your tenant creation workflow.

3. **Use Alembic for schema changes** - For production systems, manage schema changes through migrations rather than `create_all()`.

4. **Test migrations** - Always test migrations in a staging environment with production-like data.

5. **Backup before migration** - Take database backups before running migrations on production tenants.

## Troubleshooting

### Schema Does Not Exist

`ensure_tables_sync` requires the schema to exist beforehand. If you get a `TableCreationError`
about the schema not existing, create the schema first as part of your tenant provisioning:

```python
from sqlalchemy import text

# Create schema in your tenant provisioning code (separate from Prismiq)
with engine.connect() as conn:
    conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"'))
    conn.commit()

# Then create Prismiq tables
with engine.connect() as conn:
    ensure_tables_sync(conn, schema_name=schema_name)
    conn.commit()
```

### Invalid Schema Name Error

If you get a `ValueError` about invalid schema name, ensure your schema name:
- Starts with a letter or underscore
- Contains only alphanumeric characters and underscores
- Is not a reserved schema (`public`, `information_schema`, etc.)

### Foreign Key Conflicts

If you see foreign key errors, ensure tables are created in the correct order. The `PrismiqBase.metadata.create_all()` handles this automatically.

### Schema Not Found in Alembic

For Alembic with schema-based multi-tenancy, ensure your `env.py` sets the correct `search_path`:

```python
from sqlalchemy import text

def run_migrations_online():
    schema = context.get_x_argument(as_dictionary=True).get('tenant')
    if schema:
        connection.execute(text(f'SET search_path TO "{schema}"'))
```

### TableCreationError

If you get a `TableCreationError`, check:
1. **Schema doesn't exist** - The specified schema must exist before calling `ensure_tables_sync`.
   Create schemas as part of your tenant provisioning process.
2. **Permission denied** - The database user needs CREATE TABLE permissions in the schema.
3. **Connection issues** - Verify the database connection is valid and active.
