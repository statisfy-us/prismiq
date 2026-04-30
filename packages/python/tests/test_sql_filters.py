"""Tests for raw-SQL dashboard filter injection."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.filter_merge import FilterValue
from prismiq.sql_filters import _parse_iso_date, inject_dashboard_filters


def _df(
    filter_id: str, type_: DashboardFilterType, field: str, table: str = "tasks"
) -> DashboardFilter:
    return DashboardFilter(
        id=filter_id, type=type_, label=field, field=field, table=table
    )


def _fv(filter_id: str, value: object) -> FilterValue:
    return FilterValue(filter_id=filter_id, value=value)


# ============================================================================
# DATE_RANGE — the bug we're fixing
# ============================================================================


def test_date_range_coerces_iso_strings_to_date() -> None:
    """ISO date strings must be passed to asyncpg as date objects."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date")]
    values = [_fv("f1", {"start": "2026-04-29", "end": "2026-05-01"})]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == [date(2026, 4, 29), date(2026, 5, 1)]
    assert "$1" in modified_sql and "$2" in modified_sql


def test_date_range_coerces_iso_datetimes_to_datetime() -> None:
    """ISO datetime strings (with T separator) must produce datetime objects."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date")]
    values = [_fv("f1", {"start": "2026-04-29T00:00:00", "end": "2026-05-01T23:59:59"})]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == [
        datetime(2026, 4, 29, 0, 0, 0),
        datetime(2026, 5, 1, 23, 59, 59),
    ]


def test_date_range_skips_when_unparseable() -> None:
    """Garbage date strings produce no condition (rather than raising)."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date")]
    values = [_fv("f1", {"start": "not-a-date", "end": "2026-05-01"})]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql or "WHERE" not in modified_sql.upper().split("FROM")[1]


def test_date_range_with_param_offset() -> None:
    """$N placeholders must respect the param_offset."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date")]
    values = [_fv("f1", {"start": "2026-04-29", "end": "2026-05-01"})]

    modified_sql, params = inject_dashboard_filters(
        sql, filters, values, param_offset=3
    )

    assert params == [date(2026, 4, 29), date(2026, 5, 1)]
    assert "$4" in modified_sql and "$5" in modified_sql


# ============================================================================
# Other filter types — guard against regression in the same code path
# ============================================================================


def test_select_filter() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.SELECT, "status")]
    values = [_fv("f1", "open")]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["open"]


def test_multi_select_filter() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.MULTI_SELECT, "status")]
    values = [_fv("f1", ["open", "in_progress"])]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == [["open", "in_progress"]]


def test_text_filter_wraps_in_wildcards() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.TEXT, "title")]
    values = [_fv("f1", "urgent")]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == ["%urgent%"]


def test_number_range_filter() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.NUMBER_RANGE, "priority")]
    values = [_fv("f1", {"min": 1, "max": 5})]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == [1, 5]


def test_filter_skipped_when_table_not_in_sql() -> None:
    """Filter with table=accounts is skipped if SQL only references tasks."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date", table="accounts")]
    values = [_fv("f1", {"start": "2026-04-29", "end": "2026-05-01"})]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql


def test_empty_values_short_circuits() -> None:
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.SELECT, "status")]
    values = [_fv("f1", "")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql


# ============================================================================
# Column qualification — disambiguate columns shared across joined tables
# ============================================================================


def test_qualifies_column_with_table_name_when_no_alias() -> None:
    """When the SQL doesn't alias the table, the bare table name is used."""
    sql = (
        'SELECT * FROM "account_custom_fields_view" '
        'JOIN "opportunity_custom_fields_view" '
        'ON "account_custom_fields_view"."account_id" = "opportunity_custom_fields_view"."account_id"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.MULTI_SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", ["John"])]

    modified_sql, _ = inject_dashboard_filters(sql, filters, values)

    assert '"account_custom_fields_view"."AGP Owner"' in modified_sql
    # The other table's column must NOT be referenced
    assert '"opportunity_custom_fields_view"."AGP Owner"' not in modified_sql


def test_qualifies_column_with_alias_when_table_aliased() -> None:
    """When the SQL aliases the table, the alias must be used (Postgres rejects the bare name on aliased tables)."""
    sql = (
        'SELECT * FROM "account_custom_fields_view" AS a '
        'JOIN "opportunity_custom_fields_view" AS o ON a."account_id" = o."account_id"'
    )
    filters = [
        _df(
            "f1",
            DashboardFilterType.MULTI_SELECT,
            "AGP Owner",
            table="account_custom_fields_view",
        )
    ]
    values = [_fv("f1", ["John"])]

    modified_sql, _ = inject_dashboard_filters(sql, filters, values)

    assert '"a"."AGP Owner"' in modified_sql
    assert '"account_custom_fields_view"."AGP Owner"' not in modified_sql


def test_unqualified_when_filter_has_no_table() -> None:
    """If the filter has no table specified, the column stays unqualified (existing behavior)."""
    sql = 'SELECT * FROM "tasks"'
    filters = [
        DashboardFilter(
            id="f1", type=DashboardFilterType.SELECT, label="status", field="status"
        )
    ]
    values = [_fv("f1", "open")]

    modified_sql, _ = inject_dashboard_filters(
        sql, filters, values, known_tables=frozenset({"tasks"})
    )

    assert '"status"' in modified_sql
    # No table qualifier prefixed
    assert '"tasks"."status"' not in modified_sql


# ============================================================================
# _parse_iso_date helper
# ============================================================================


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, None),
        ("", None),
        ("garbage", None),
        ("2026-04-29", date(2026, 4, 29)),
        ("2026-04-29T12:30:00", datetime(2026, 4, 29, 12, 30, 0)),
        ("2026-04-29 12:30:00", datetime(2026, 4, 29, 12, 30, 0)),
        (
            "2026-04-29T12:30:00Z",
            datetime(2026, 4, 29, 12, 30, 0, tzinfo=timezone.utc),
        ),
        (
            "2026-04-29T12:30:00+00:00",
            datetime(2026, 4, 29, 12, 30, 0, tzinfo=timezone.utc),
        ),
        (date(2026, 4, 29), date(2026, 4, 29)),
        (datetime(2026, 4, 29, 12, 0), datetime(2026, 4, 29, 12, 0)),
        (12345, None),  # unsupported types fall through to None
    ],
)
def test_parse_iso_date(value: object, expected: object) -> None:
    assert _parse_iso_date(value) == expected


def test_date_range_accepts_z_suffixed_datetime() -> None:
    """Frontend ISO datetimes ending in 'Z' must round-trip through DATE_RANGE."""
    sql = 'SELECT * FROM "tasks"'
    filters = [_df("f1", DashboardFilterType.DATE_RANGE, "due_date")]
    values = [
        _fv("f1", {"start": "2026-04-29T00:00:00Z", "end": "2026-05-01T23:59:59Z"})
    ]

    _, params = inject_dashboard_filters(sql, filters, values)

    assert params == [
        datetime(2026, 4, 29, 0, 0, 0, tzinfo=timezone.utc),
        datetime(2026, 5, 1, 23, 59, 59, tzinfo=timezone.utc),
    ]


def test_self_joined_table_filter_skipped() -> None:
    """A dashboard filter on a self-joined table can't disambiguate aliases — must skip."""
    sql = 'SELECT * FROM "tasks" AS t1 JOIN "tasks" AS t2 ON t1."parent_id" = t2."id"'
    filters = [_df("f1", DashboardFilterType.SELECT, "status", table="tasks")]
    values = [_fv("f1", "open")]

    modified_sql, params = inject_dashboard_filters(sql, filters, values)

    assert params == []
    assert modified_sql == sql
