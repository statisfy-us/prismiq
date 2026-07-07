"""Tests for raw-SQL dashboard filter injection."""

from __future__ import annotations

import pytest

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.filter_merge import FilterValue
from prismiq.sql_filters import inject_dashboard_filters


def _df(
    filter_id: str,
    type_: DashboardFilterType,
    field: str,
    table: str | None = "tasks",
) -> DashboardFilter:
    return DashboardFilter(
        id=filter_id, type=type_, label=field, field=field, table=table
    )


def _fv(filter_id: str, value: object) -> FilterValue:
    return FilterValue(filter_id=filter_id, value=value)


# ============================================================================
# Outer-scope isolation — the bug that produced
# "missing FROM-clause entry for table X"
# ============================================================================


def test_filter_qualifies_with_subquery_alias_when_passing_through() -> None:
    """Subquery exposes the filter's column → qualify with the subquery alias.

    This is the dashboard 100 regression: ``account_custom_fields_view`` is
    only inside a derived subquery aliased ``a``, but ``a`` does expose
    ``"AGP Owner"`` to the outer SELECT, so the filter must qualify with ``a``.
    """
    sql = (
        'SELECT o."Account Name", a."AGP Owner" '
        'FROM "crm_opportunity_fields_view" o '
        "LEFT JOIN ("
        '  SELECT "Account Name", "AGP Owner" FROM "account_custom_fields_view"'
        ') a ON o."Account Name" = a."Account Name"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.MULTI_SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", ["Alyssa"])]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == [["Alyssa"]]
    assert '"a"."AGP Owner"' in modified_sql
    # Must NOT reference the inner-only table at the outer scope.
    assert '"account_custom_fields_view"."AGP Owner"' not in modified_sql


def test_filter_skipped_when_subquery_does_not_expose_field() -> None:
    """Subquery sources from the filter's table but doesn't project the field → skip.

    Otherwise we'd reference a column the outer SELECT can't see.
    """
    sql = (
        'SELECT o."id", a."Account Name" '
        'FROM "tasks" o '
        "LEFT JOIN ("
        '  SELECT "Account Name" FROM "account_custom_fields_view"'
        ') a ON o."account_name" = a."Account Name"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",  # not in subquery's SELECT list
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", "Alyssa")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert (
        '"AGP Owner"'
        not in modified_sql.split("LEFT JOIN", 1)[0] + modified_sql.split(") a", 1)[1]
    )


def test_filter_respects_subquery_column_aliasing() -> None:
    """``SELECT col AS other`` exposes ``other``, not ``col``."""
    sql = (
        'SELECT a."Owner" '
        'FROM "tasks" o '
        "LEFT JOIN ("
        '  SELECT "AGP Owner" AS "Owner" FROM "account_custom_fields_view"'
        ') a ON o."id" = a."id"'
    )
    # Filter on the renamed column → should match.
    filters_renamed = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "Owner",
            table="account_custom_fields_view",
        )
    ]
    modified_sql, params = inject_dashboard_filters(
        sql, filters_renamed, [_fv("f1", "Alyssa")]
    )
    assert params == ["Alyssa"]
    assert '"a"."Owner"' in modified_sql

    # Filter on the original column name → should be skipped (outer can't see it).
    filters_original = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    modified_sql, params = inject_dashboard_filters(
        sql, filters_original, [_fv("f1", "Alyssa")]
    )
    assert params == []
    # Original SQL preserved (no WHERE clause appended).
    assert "WHERE" not in modified_sql.upper()


def test_filter_passes_through_select_star_subquery() -> None:
    """``SELECT *`` exposes everything — trust dashboard config."""
    sql = (
        'SELECT a."AGP Owner" '
        'FROM "tasks" o '
        "LEFT JOIN ("
        '  SELECT * FROM "account_custom_fields_view"'
        ') a ON o."id" = a."id"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", "Alyssa")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["Alyssa"]
    assert '"a"."AGP Owner"' in modified_sql


def test_filter_resolves_through_cte_reference() -> None:
    """A CTE referenced at outer scope acts like a derived subquery."""
    sql = (
        'WITH a AS (SELECT "AGP Owner" FROM "account_custom_fields_view") '
        'SELECT a."AGP Owner" FROM "tasks" o JOIN a ON o."id" = a."id"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", "Alyssa")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["Alyssa"]
    assert '"a"."AGP Owner"' in modified_sql


def test_filter_resolves_through_nested_subquery() -> None:
    """Source table buried two levels deep but column passed through both."""
    sql = (
        'SELECT a."AGP Owner" '
        'FROM "tasks" o '
        "LEFT JOIN ("
        '  SELECT "AGP Owner" FROM ('
        '    SELECT "AGP Owner" FROM "account_custom_fields_view"'
        "  ) inner_alias"
        ') a ON o."id" = a."id"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", "Alyssa")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["Alyssa"]
    assert '"a"."AGP Owner"' in modified_sql


def test_filter_skipped_when_multiple_subqueries_expose_same_column() -> None:
    """Two derived refs both source from the same table and expose the field → ambiguous."""
    sql = (
        'SELECT a1."AGP Owner", a2."AGP Owner" '
        "FROM ("
        '  SELECT "AGP Owner" FROM "account_custom_fields_view"'
        ") a1 "
        "JOIN ("
        '  SELECT "AGP Owner" FROM "account_custom_fields_view"'
        ') a2 ON a1."AGP Owner" = a2."AGP Owner"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", "Alyssa")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    # Original SQL preserved (no WHERE injected).
    assert "WHERE" not in modified_sql.upper()


def test_filter_applied_to_outer_table_with_subquery_present() -> None:
    """A filter on a table that IS in the outer FROM still works alongside a subquery."""
    sql = (
        'SELECT o."Account Name" '
        'FROM "crm_opportunity_fields_view" o '
        "LEFT JOIN ("
        '  SELECT "Account Name" FROM "account_custom_fields_view"'
        ') a ON o."Account Name" = a."Account Name"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.SELECT,
            "stage",
            table="crm_opportunity_fields_view",
        )
    ]
    values = [_fv("f1", "0. Cultivate")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["0. Cultivate"]
    # Qualifier should be the outer alias 'o'.
    assert '"o"."stage"' in modified_sql


def test_outer_where_is_extended_not_inner_where() -> None:
    """When the SQL has a WHERE inside a subquery, the new condition must
    be ANDed into the OUTER WHERE, not the subquery's."""
    sql = (
        'SELECT o."id" '
        'FROM "tasks" o '
        "LEFT JOIN ("
        '  SELECT "id" FROM "audits" WHERE "deleted" = FALSE'
        ') a ON o."id" = a."id" '
        "WHERE o.\"status\" = 'open'"
    )
    filters = [_df("f1", DashboardFilterType.SELECT, "owner", table="tasks")]
    values = [_fv("f1", "alice")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["alice"]
    # Outer WHERE should now contain the new condition AND-ed with the existing one.
    # The subquery's WHERE (deleted = FALSE) must remain untouched on the inner side.
    assert '"o"."owner"' in modified_sql
    # Sanity: the subquery's WHERE didn't absorb the new filter.
    assert modified_sql.count('"owner"') == 1


# ============================================================================
# Existing behaviour — basic regression coverage
# ============================================================================


def test_select_filter_qualifies_with_alias() -> None:
    sql = 'SELECT * FROM "tasks" AS t'
    filters = [_df("f1", DashboardFilterType.SELECT, "status", table="tasks")]
    values = [_fv("f1", "open")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["open"]
    assert '"t"."status"' in modified_sql


def test_filter_skipped_when_table_not_referenced_at_all() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.SELECT, "status", table="accounts")]
    values = [_fv("f1", "open")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql


def test_self_joined_table_skipped() -> None:
    """Dashboard filter has no way to disambiguate which alias to filter."""
    sql = 'SELECT * FROM "tasks" AS t1 JOIN "tasks" AS t2 ON t1."parent_id" = t2."id"'
    filters = [_df("f1", DashboardFilterType.SELECT, "status", table="tasks")]
    values = [_fv("f1", "open")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql


@pytest.mark.parametrize(
    "type_,value,expected_params",
    [
        (DashboardFilterType.SELECT, "open", ["open"]),
        (DashboardFilterType.MULTI_SELECT, ["a", "b"], [["a", "b"]]),
        (DashboardFilterType.TEXT, "urgent", ["%urgent%"]),
        (
            DashboardFilterType.NUMBER_RANGE,
            {"min": 1, "max": 5},
            [1, 5],
        ),
    ],
)
def test_scalar_filter_types(
    type_: DashboardFilterType, value: object, expected_params: list[object]
) -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", type_, "field", table="tasks")]
    values = [_fv("f1", value)]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == expected_params
