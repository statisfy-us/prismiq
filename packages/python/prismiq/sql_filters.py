"""Inject dashboard filter WHERE clauses into raw SQL queries.

Uses sqlglot to safely parse and modify SQL ASTs, following the same
pattern as ``qualify_table_schemas`` in ``executor.py``.  All filter
values are parameterised (``$N`` placeholders) — never interpolated —
to prevent SQL injection.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

import sqlglot
import sqlglot.errors
from sqlglot import exp

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.filter_merge import FilterValue

_logger = logging.getLogger(__name__)


def inject_dashboard_filters(
    sql: str,
    dashboard_filters: list[DashboardFilter],
    filter_values: list[FilterValue],
    known_tables: frozenset[str] | None = None,
    param_offset: int = 0,
) -> tuple[str, list[Any]]:
    """Inject dashboard filter conditions into a raw SQL query.

    Parses *sql* with sqlglot, determines which dashboard filters apply
    (by checking if the filter's table appears in the query), builds
    parameterised WHERE conditions, and merges them into the existing
    WHERE clause with ``AND``.

    Args:
        sql: Raw SQL query string.
        dashboard_filters: Dashboard-level filter definitions.
        filter_values: Current runtime filter values.
        known_tables: Optional set of known table names from schema
            introspection.  When provided, filters whose ``table`` is
            not in *known_tables* are silently skipped.
        param_offset: Starting index for ``$N`` parameter placeholders.
            Use this when the query already has user-supplied params so
            that injected params don't collide.

    Returns:
        Tuple of ``(modified_sql, param_values)`` where *param_values*
        is a list of values corresponding to the injected ``$N``
        placeholders.
    """
    if not dashboard_filters or not filter_values:
        return sql, []

    # Build a lookup from filter_id → value
    value_map: dict[str, Any] = {}
    for fv in filter_values:
        value_map[fv.filter_id] = fv.value

    # Parse the SQL
    try:
        parsed = sqlglot.parse_one(sql, dialect="postgres")
    except sqlglot.errors.SqlglotError:
        _logger.warning("Failed to parse SQL for filter injection; returning unmodified")
        return sql, []

    # Extract table names referenced in the query, mapping each to the
    # alias used in the SQL (or the bare name if not aliased). Lower-cased
    # for case-insensitive matching against ``dash_filter.table``.
    sql_tables: dict[str, str] = {}
    for table in parsed.find_all(exp.Table):
        if table.name:
            qualifier = table.alias or table.name
            sql_tables.setdefault(table.name.lower(), qualifier)

    # Build conditions and collect param values
    conditions: list[exp.Expression] = []
    params: list[Any] = []

    for dash_filter in dashboard_filters:
        value = value_map.get(dash_filter.id)
        if value is None or value == "" or value == []:
            continue

        # Check if the filter's table is referenced in the SQL, and resolve
        # the qualifier to use (alias if the SQL aliases the table, else the
        # bare table name). Without a qualifier, columns shared across joined
        # tables (e.g. shared custom fields on Account + Opportunity views)
        # produce 'column reference X is ambiguous'.
        qualifier: str | None = None
        if dash_filter.table:
            qualifier = sql_tables.get(dash_filter.table.lower())
            if qualifier is None:
                continue
        elif known_tables is not None and not any(t in known_tables for t in sql_tables):
            # No table specified on filter and no query table is in the
            # known schema — skip this filter.
            continue

        col = _build_column(dash_filter.field, qualifier)

        new_conditions = _build_filter_conditions(
            dash_filter.type, col, value, params, param_offset
        )
        conditions.extend(new_conditions)

    if not conditions:
        return sql, []

    # Combine all new conditions into a single AND expression
    combined = conditions[0]
    for cond in conditions[1:]:
        combined = exp.And(this=combined, expression=cond)

    # Merge into the existing WHERE clause
    existing_where = parsed.find(exp.Where)
    if existing_where:
        merged = exp.And(this=existing_where.this, expression=combined)
        existing_where.set("this", merged)
    else:
        parsed.set("where", exp.Where(this=combined))

    return parsed.sql(dialect="postgres"), params


def _build_filter_conditions(
    filter_type: DashboardFilterType,
    col: exp.Column,
    value: Any,
    params: list[Any],
    param_offset: int,
) -> list[exp.Expression]:
    """Build SQL conditions for a single dashboard filter.

    Appends parameter values to *params* and returns a list of sqlglot
    expression nodes.  Parameter placeholders are numbered starting from
    ``param_offset + len(params) + 1`` (1-based, matching asyncpg ``$N``).
    """
    conditions: list[exp.Expression] = []

    def _next_param(val: Any) -> exp.Parameter:
        params.append(val)
        return _param(param_offset + len(params))

    if filter_type == DashboardFilterType.SELECT:
        if not isinstance(value, (str, int, float, bool)):
            return []
        conditions.append(exp.EQ(this=col, expression=_next_param(value)))

    elif filter_type == DashboardFilterType.MULTI_SELECT:
        if not isinstance(value, list) or len(value) == 0:
            return []
        conditions.append(
            exp.EQ(
                this=col,
                expression=exp.Anonymous(this="ANY", expressions=[_next_param(value)]),
            )
        )

    elif filter_type == DashboardFilterType.DATE_RANGE:
        if isinstance(value, dict):
            start = _parse_iso_date(value.get("start"))
            end = _parse_iso_date(value.get("end"))
            if start is not None and end is not None:
                conditions.append(exp.GTE(this=col, expression=_next_param(start)))
                conditions.append(exp.LTE(this=col, expression=_next_param(end)))

    elif filter_type == DashboardFilterType.TEXT:
        if not isinstance(value, str) or not value.strip():
            return []
        conditions.append(exp.ILike(this=col, expression=_next_param(f"%{value}%")))

    elif filter_type == DashboardFilterType.NUMBER_RANGE:
        if not isinstance(value, dict):
            return []
        min_val = value.get("min")
        max_val = value.get("max")
        if min_val is not None:
            conditions.append(exp.GTE(this=col, expression=_next_param(min_val)))
        if max_val is not None:
            conditions.append(exp.LTE(this=col, expression=_next_param(max_val)))

    return conditions


def _param(index: int) -> exp.Parameter:
    """Create a ``$N`` parameter placeholder."""
    return exp.Parameter(this=exp.Literal.number(index))


def _build_column(field: str, qualifier: str | None) -> exp.Column:
    """Build a (optionally table-qualified) column reference."""
    column = exp.Column(this=exp.Identifier(this=field, quoted=True))
    if qualifier:
        column.set("table", exp.Identifier(this=qualifier, quoted=True))
    return column


def _parse_iso_date(value: Any) -> date | datetime | None:
    """Parse an ISO date/datetime string into a Python ``date`` or ``datetime``.

    asyncpg refuses to bind a ``str`` to a ``DATE``/``TIMESTAMP`` column, so
    DATE_RANGE filter values arriving as ISO strings from the frontend must be
    coerced before being appended to the parameter list.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            if "T" in value or " " in value:
                return datetime.fromisoformat(value.replace(" ", "T"))
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None
