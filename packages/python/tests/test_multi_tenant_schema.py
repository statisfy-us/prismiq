"""Tests for per-request schema support in multi-tenant Prismiq.

These tests verify schema-qualified SQL generation, cache key isolation,
and multi-tenant schema routing.
"""

from __future__ import annotations

import pytest

from prismiq.auth import SimpleAuthContext
from prismiq.query import QueryBuilder
from prismiq.types import ColumnSchema, DatabaseSchema, QueryDefinition, QueryTable, TableSchema


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="email", data_type="text", is_nullable=True),
                ],
            ),
            TableSchema(
                name="orders",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="amount", data_type="numeric", is_nullable=True),
                ],
            ),
        ],
        relationships=[],
    )


class TestAuthContextSchemaName:
    """Tests for schema_name property in AuthContext."""

    def test_simple_auth_context_with_schema_name(self) -> None:
        """Test that SimpleAuthContext accepts schema_name."""
        auth = SimpleAuthContext(
            tenant_id="org_123",
            user_id="user_456",
            schema_name="org_123",
        )
        assert auth.tenant_id == "org_123"
        assert auth.user_id == "user_456"
        assert auth.schema_name == "org_123"

    def test_simple_auth_context_without_schema_name(self) -> None:
        """Test that SimpleAuthContext works without schema_name."""
        auth = SimpleAuthContext(
            tenant_id="org_123",
            user_id="user_456",
        )
        assert auth.tenant_id == "org_123"
        assert auth.user_id == "user_456"
        assert auth.schema_name is None


class TestQueryBuilderSchemaQualification:
    """Tests for schema-qualified SQL generation."""

    def test_build_without_schema_name(self, sample_schema: DatabaseSchema) -> None:
        """Test that QueryBuilder generates non-schema-qualified SQL by default."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[{"table_id": "t1", "column": "email"}],
        )
        sql, _ = builder.build(query)
        assert '"users"' in sql
        # Should NOT have schema qualification
        assert '"public"."users"' not in sql

    def test_build_with_schema_name(self, sample_schema: DatabaseSchema) -> None:
        """Test that QueryBuilder generates schema-qualified SQL when schema_name is set."""
        builder = QueryBuilder(sample_schema, schema_name="org_123")
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[{"table_id": "t1", "column": "email"}],
        )
        sql, _ = builder.build(query)
        # Should have schema qualification
        assert '"org_123"."users"' in sql

    def test_build_join_with_schema_name(self, sample_schema: DatabaseSchema) -> None:
        """Test schema-qualified SQL in JOIN clauses."""
        builder = QueryBuilder(sample_schema, schema_name="tenant_abc")
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[
                {"table_id": "t1", "column": "email"},
                {"table_id": "t2", "column": "amount"},
            ],
            joins=[
                {
                    "from_table_id": "t1",
                    "from_column": "id",
                    "to_table_id": "t2",
                    "to_column": "user_id",
                    "join_type": "INNER",
                }
            ],
        )
        sql, _ = builder.build(query)
        # Both tables should be schema-qualified
        assert '"tenant_abc"."users"' in sql
        assert '"tenant_abc"."orders"' in sql

    def test_quote_table_method(self, sample_schema: DatabaseSchema) -> None:
        """Test _quote_table helper method."""
        # Without schema_name
        builder_no_schema = QueryBuilder(sample_schema)
        assert builder_no_schema._quote_table("users") == '"users"'

        # With schema_name
        builder_with_schema = QueryBuilder(sample_schema, schema_name="my_schema")
        assert builder_with_schema._quote_table("users") == '"my_schema"."users"'

    def test_schema_name_with_special_characters(self, sample_schema: DatabaseSchema) -> None:
        """Test that schema names with special characters are properly escaped."""
        builder = QueryBuilder(sample_schema, schema_name='org"123')
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[{"table_id": "t1", "column": "email"}],
        )
        sql, _ = builder.build(query)
        # Double quotes should be escaped
        assert '"org""123"."users"' in sql


class TestCacheKeyIsolation:
    """Tests for schema-based cache key isolation."""

    def test_query_cache_different_keys_for_different_schemas(self) -> None:
        """Test that QueryCache generates different keys for different schemas."""
        from prismiq.cache import InMemoryCache, QueryCache

        backend = InMemoryCache()
        cache_public = QueryCache(backend, schema_name="public")
        cache_org123 = QueryCache(backend, schema_name="org_123")

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[{"table_id": "t1", "column": "email"}],
        )

        key_public = cache_public.make_key(query)
        key_org123 = cache_org123.make_key(query)

        # Keys should be different due to different schema_name
        assert key_public != key_org123
        assert "public" in key_public
        assert "org_123" in key_org123

    def test_schema_cache_different_keys_for_different_schemas(self) -> None:
        """Test that SchemaCache generates different keys for different schemas."""
        from prismiq.cache import InMemoryCache, SchemaCache

        backend = InMemoryCache()
        cache_public = SchemaCache(backend, schema_name="public")
        cache_org123 = SchemaCache(backend, schema_name="org_123")

        # Internal key generation should include schema name
        assert cache_public._make_key("full") == "schema:public:full"
        assert cache_org123._make_key("full") == "schema:org_123:full"


class TestSchemaIntrospectorMultiTenant:
    """Tests for SchemaIntrospector with different schemas."""

    def test_introspector_uses_provided_schema_name(self) -> None:
        """Test that SchemaIntrospector uses the provided schema_name."""
        from unittest.mock import MagicMock

        from prismiq.schema import SchemaIntrospector

        # Create mock pool
        pool = MagicMock()

        introspector = SchemaIntrospector(pool, schema_name="org_abc")
        assert introspector._schema_name == "org_abc"

    def test_introspector_default_schema_is_public(self) -> None:
        """Test that SchemaIntrospector defaults to public schema."""
        from unittest.mock import MagicMock

        from prismiq.schema import SchemaIntrospector

        pool = MagicMock()
        introspector = SchemaIntrospector(pool)
        assert introspector._schema_name == "public"
