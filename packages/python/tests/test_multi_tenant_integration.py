"""Integration tests for multi-tenant schema isolation.

These tests verify that PrismiqEngine correctly isolates data between
tenant schemas — covering structured queries (QueryDefinition), raw SQL
(the LLM SQL assistant path), and schema introspection.

Requires a running PostgreSQL instance. Set DATABASE_URL to run:

    DATABASE_URL=postgresql://prismiq:prismiq_dev@localhost:5432/prismiq_dev \
      uv run pytest packages/python/tests/test_multi_tenant_integration.py -v -m integration
"""

from __future__ import annotations

from typing import Any

import pytest

from prismiq.engine import PrismiqEngine
from prismiq.types import (
    AggregationType,
    ColumnSelection,
    QueryDefinition,
    QueryTable,
)

# ---------------------------------------------------------------------------
# DDL & seed data
# ---------------------------------------------------------------------------

CUSTOMERS_DDL = """
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    revenue NUMERIC(12,2) NOT NULL DEFAULT 0
)
"""

TENANT_A_SEED = """
INSERT INTO customers (name, region, revenue) VALUES
    ('Alice', 'US', 1000.00),
    ('Bob',   'US', 2000.00),
    ('Carol', 'US', 3000.00)
"""

TENANT_B_SEED = """
INSERT INTO customers (name, region, revenue) VALUES
    ('Erik',  'EU', 500.00),
    ('Fiona', 'EU', 750.00)
"""

SCHEMA_A = "test_tenant_a"
SCHEMA_B = "test_tenant_b"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def tenant_schemas(real_pool: Any) -> Any:
    """Create two tenant schemas with isolated seed data.

    Yields a dict mapping logical names to schema names.
    Drops both schemas on teardown.
    """
    async with real_pool.acquire() as conn:
        for schema in [SCHEMA_A, SCHEMA_B]:
            await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
            await conn.execute(f'CREATE SCHEMA "{schema}"')

        # Tenant A — 3 US customers
        await conn.execute(f'SET search_path = "{SCHEMA_A}"')
        await conn.execute(CUSTOMERS_DDL)
        await conn.execute(TENANT_A_SEED)

        # Tenant B — 2 EU customers
        await conn.execute(f'SET search_path = "{SCHEMA_B}"')
        await conn.execute(CUSTOMERS_DDL)
        await conn.execute(TENANT_B_SEED)

        await conn.execute("RESET search_path")

    yield {"tenant_a": SCHEMA_A, "tenant_b": SCHEMA_B}

    # Teardown
    async with real_pool.acquire() as conn:
        for schema in [SCHEMA_A, SCHEMA_B]:
            await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')


@pytest.fixture
async def engine_a(database_url: str | None, tenant_schemas: dict[str, str]) -> Any:
    """PrismiqEngine pointed at tenant A's schema."""
    assert database_url is not None
    engine = PrismiqEngine(
        database_url=database_url,
        schema_name=tenant_schemas["tenant_a"],
        exposed_tables=["customers"],
    )
    await engine.startup()
    yield engine
    await engine.shutdown()


@pytest.fixture
async def engine_b(database_url: str | None, tenant_schemas: dict[str, str]) -> Any:
    """PrismiqEngine pointed at tenant B's schema."""
    assert database_url is not None
    engine = PrismiqEngine(
        database_url=database_url,
        schema_name=tenant_schemas["tenant_b"],
        exposed_tables=["customers"],
    )
    await engine.startup()
    yield engine
    await engine.shutdown()


@pytest.fixture
async def shared_engine(database_url: str | None, tenant_schemas: dict[str, str]) -> Any:
    """Single PrismiqEngine pointed at tenant A, used for cross-schema queries."""
    assert database_url is not None
    engine = PrismiqEngine(
        database_url=database_url,
        schema_name=tenant_schemas["tenant_a"],
        exposed_tables=["customers"],
    )
    await engine.startup()
    yield engine
    await engine.shutdown()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _customers_query() -> QueryDefinition:
    """Simple SELECT * FROM customers query."""
    return QueryDefinition(
        tables=[QueryTable(id="t1", name="customers")],
        columns=[
            ColumnSelection(table_id="t1", column="name"),
            ColumnSelection(table_id="t1", column="region"),
            ColumnSelection(table_id="t1", column="revenue"),
        ],
    )


def _count_query() -> QueryDefinition:
    """SELECT COUNT(*) FROM customers."""
    return QueryDefinition(
        tables=[QueryTable(id="t1", name="customers")],
        columns=[
            ColumnSelection(
                table_id="t1",
                column="id",
                aggregation=AggregationType.COUNT,
            ),
        ],
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestSchemaIsolation:
    """Verify data isolation between tenant schemas."""

    async def test_structured_query_returns_correct_tenant_data(
        self,
        engine_a: PrismiqEngine,
        engine_b: PrismiqEngine,
    ) -> None:
        """Execute the same QueryDefinition against both schemas and verify different results."""
        result_a = await engine_a.execute_query(_customers_query())
        result_b = await engine_b.execute_query(_customers_query())

        # Tenant A has 3 US customers
        assert result_a.row_count == 3
        regions_a = {row[1] for row in result_a.rows}
        assert regions_a == {"US"}

        # Tenant B has 2 EU customers
        assert result_b.row_count == 2
        regions_b = {row[1] for row in result_b.rows}
        assert regions_b == {"EU"}

    async def test_structured_count_query_isolated(
        self,
        engine_a: PrismiqEngine,
        engine_b: PrismiqEngine,
    ) -> None:
        """COUNT aggregation reflects per-tenant row counts."""
        result_a = await engine_a.execute_query(_count_query())
        result_b = await engine_b.execute_query(_count_query())

        assert result_a.rows[0][0] == 3
        assert result_b.rows[0][0] == 2

    async def test_raw_sql_returns_correct_tenant_data(
        self,
        engine_a: PrismiqEngine,
        engine_b: PrismiqEngine,
    ) -> None:
        """Raw SQL (LLM SQL assistant path) returns correct data per tenant."""
        sql = 'SELECT name, region FROM "customers" ORDER BY name'

        result_a = await engine_a.execute_raw_sql(sql)
        result_b = await engine_b.execute_raw_sql(sql)

        names_a = [row[0] for row in result_a.rows]
        names_b = [row[0] for row in result_b.rows]

        assert names_a == ["Alice", "Bob", "Carol"]
        assert names_b == ["Erik", "Fiona"]

    async def test_sql_is_schema_qualified(
        self,
        shared_engine: PrismiqEngine,
        tenant_schemas: dict[str, str],
    ) -> None:
        """Verify generated SQL contains the tenant schema prefix."""
        # When querying a non-default schema, generate_sql_async creates a
        # schema-aware QueryBuilder that produces fully-qualified SQL.
        sql_b = await shared_engine.generate_sql_async(
            _customers_query(),
            schema_name=tenant_schemas["tenant_b"],
        )
        assert f'"{SCHEMA_B}"."customers"' in sql_b

    async def test_schema_introspection_isolated(
        self,
        engine_a: PrismiqEngine,
        engine_b: PrismiqEngine,
    ) -> None:
        """get_schema() for each tenant returns only that tenant's tables."""
        schema_a = await engine_a.get_schema()
        schema_b = await engine_b.get_schema()

        table_names_a = {t.name for t in schema_a.tables}
        table_names_b = {t.name for t in schema_b.tables}

        assert "customers" in table_names_a
        assert "customers" in table_names_b

        # Both schemas should report the same schema_name as their respective tenant
        assert schema_a.tables[0].schema_name == SCHEMA_A
        assert schema_b.tables[0].schema_name == SCHEMA_B

    async def test_cross_tenant_no_leakage(
        self,
        shared_engine: PrismiqEngine,
        tenant_schemas: dict[str, str],
    ) -> None:
        """Query tenant_a then tenant_b on the same engine — verify no data leaks."""
        # Query via default schema (tenant_a)
        result_a = await shared_engine.execute_query(_customers_query())
        assert result_a.row_count == 3

        # Now query tenant_b via schema_name override
        result_b = await shared_engine.execute_query(
            _customers_query(),
            schema_name=tenant_schemas["tenant_b"],
        )
        assert result_b.row_count == 2
        regions_b = {row[1] for row in result_b.rows}
        assert regions_b == {"EU"}

        # Query tenant_a again to ensure no state leaked
        result_a2 = await shared_engine.execute_query(_customers_query())
        assert result_a2.row_count == 3
        regions_a = {row[1] for row in result_a2.rows}
        assert regions_a == {"US"}

    async def test_raw_sql_cross_tenant_no_leakage(
        self,
        shared_engine: PrismiqEngine,
        tenant_schemas: dict[str, str],
    ) -> None:
        """Raw SQL queries don't leak data across sequential tenant switches."""
        sql = 'SELECT COUNT(*) AS cnt FROM "customers"'

        # Default schema (tenant_a)
        result_a = await shared_engine.execute_raw_sql(sql)
        assert result_a.rows[0][0] == 3

        # Override to tenant_b
        result_b = await shared_engine.execute_raw_sql(
            sql,
            schema_name=tenant_schemas["tenant_b"],
        )
        assert result_b.rows[0][0] == 2

        # Back to default (tenant_a) — no leakage
        result_a2 = await shared_engine.execute_raw_sql(sql)
        assert result_a2.rows[0][0] == 3
