"""Inject dashboard filter WHERE clauses into raw SQL queries.

Uses sqlglot to safely parse and modify SQL ASTs, following the same
pattern as ``qualify_table_schemas`` in ``executor.py``.  All filter
values are parameterised (``$N`` placeholders) — never interpolated —
to prevent SQL injection.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import sqlglot
import sqlglot.errors
from sqlglot import exp

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.filter_merge import FilterValue

_logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _OuterRef:
    """A table or derived-table reference visible at the outer SELECT's scope.

    ``qualifier`` is what we put before the column in the injected WHERE clause
    (table alias if present, else table/derived name).

    ``source_tables`` is the set of underlying real-table names this reference
    ultimately reads from (lowercased). For a direct table reference it's that
    one table; for a subquery/CTE it's the set of tables found inside,
    recursively.

    ``exposed_columns`` is the set of column names this reference makes
    available at the outer scope, or ``None`` for a wildcard / unknown set
    (e.g. direct ``FROM tbl`` references — we trust dashboard config — or
    ``SELECT *`` subqueries where we can't statically enumerate columns).
    """

    qualifier: str
    source_tables: frozenset[str]
    exposed_columns: frozenset[str] | None


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
        _logger.warning(
            "Failed to parse SQL for filter injection; returning unmodified"
        )
        return sql, []

    # Enumerate references visible at the outer SELECT's scope. This includes
    # direct FROM/JOIN tables AND derived subqueries / CTE references, since
    # the latter can pass-through columns from inner tables to the outer scope.
    #
    # Example: ``LEFT JOIN (SELECT "AGP Owner" FROM "account_custom_fields_view") a``
    # exposes ``"a"."AGP Owner"`` at the outer scope. A dashboard filter
    # targeting ``account_custom_fields_view.AGP Owner`` should resolve to
    # qualifier ``"a"``.
    outer_refs = _collect_outer_refs(parsed)

    # Build conditions and collect param values
    conditions: list[exp.Expression] = []
    params: list[Any] = []

    for dash_filter in dashboard_filters:
        value = value_map.get(dash_filter.id)
        if value is None or value == "" or value == []:
            continue

        qualifier: str | None = None
        if dash_filter.table:
            qualifier = _resolve_qualifier(outer_refs, dash_filter)
            if qualifier is None:
                continue
        elif known_tables is not None:
            visible_sources = {src for ref in outer_refs for src in ref.source_tables}
            if not any(t in known_tables for t in visible_sources):
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

    # Merge into the **outer** SELECT's WHERE clause. ``parsed.find(exp.Where)``
    # would walk depth-first and could pick up a WHERE inside a CTE/subquery
    # instead, so we go through ``args`` directly.
    outer_where = parsed.args.get("where") if isinstance(parsed, exp.Select) else None
    if outer_where is not None:
        merged = exp.And(this=outer_where.this, expression=combined)
        outer_where.set("this", merged)
    else:
        parsed.set("where", exp.Where(this=combined))

    return parsed.sql(dialect="postgres"), params


def _collect_outer_refs(node: exp.Expression) -> list[_OuterRef]:
    """Build the list of references visible at the outer SELECT's scope.

    Each entry describes one FROM/JOIN target — either a direct table or a
    derived subquery / CTE reference — recording which underlying tables it
    sources from and (for derived refs) which columns it exposes.
    """
    if not isinstance(node, exp.Select):
        return []

    cte_inner: dict[str, exp.Select] = {}
    with_node = node.args.get("with_") or node.args.get("with")
    if with_node is not None:
        for cte in with_node.args.get("expressions") or []:
            if isinstance(cte, exp.CTE):
                inner = cte.this
                if isinstance(inner, exp.Select):
                    cte_inner[cte.alias.lower()] = inner

    refs: list[_OuterRef] = []

    targets: list[exp.Expression] = []
    from_clause = node.args.get("from_") or node.args.get("from")
    if from_clause is not None:
        targets.extend(_outer_targets(from_clause))
    for join in node.args.get("joins") or []:
        targets.extend(_outer_targets(join))

    for target in targets:
        ref = _build_outer_ref(target, cte_inner)
        if ref is not None:
            refs.append(ref)

    return refs


def _outer_targets(expr: exp.Expression) -> list[exp.Expression]:
    """Yield the table-or-subquery target nodes directly under a FROM/JOIN.

    Stops at subqueries (returns the Subquery node itself, doesn't descend).
    """
    found: list[exp.Expression] = []

    def _walk(e: exp.Expression) -> None:
        if isinstance(e, (exp.Table, exp.Subquery)):
            found.append(e)
            return
        # Don't descend into nested Selects via other arg paths.
        if isinstance(e, exp.Select):
            return
        for child in e.args.values():
            if isinstance(child, exp.Expression):
                _walk(child)
            elif isinstance(child, list):
                for item in child:
                    if isinstance(item, exp.Expression):
                        _walk(item)

    _walk(expr)
    return found


def _build_outer_ref(
    target: exp.Expression, cte_inner: dict[str, exp.Select]
) -> _OuterRef | None:
    """Convert a FROM/JOIN target into an ``_OuterRef``."""
    if isinstance(target, exp.Table):
        if not target.name:
            return None
        qualifier = target.alias or target.name
        name_lower = target.name.lower()
        # CTE reference: look up the CTE's inner SELECT and treat as derived.
        if name_lower in cte_inner:
            inner = cte_inner[name_lower]
            return _OuterRef(
                qualifier=qualifier,
                source_tables=_collect_inner_sources(inner, cte_inner),
                exposed_columns=_collect_projected_columns(inner),
            )
        # Real table reference: trust dashboard config for column existence.
        return _OuterRef(
            qualifier=qualifier,
            source_tables=frozenset({name_lower}),
            exposed_columns=None,
        )

    if isinstance(target, exp.Subquery):
        inner = target.this
        if not isinstance(inner, exp.Select):
            return None
        qualifier = target.alias_or_name or ""
        if not qualifier:
            return None
        return _OuterRef(
            qualifier=qualifier,
            source_tables=_collect_inner_sources(inner, cte_inner),
            exposed_columns=_collect_projected_columns(inner),
        )

    return None


def _collect_inner_sources(
    select_node: exp.Select, cte_inner: dict[str, exp.Select]
) -> frozenset[str]:
    """Recursively collect the underlying real-table names ``select_node`` reads.

    CTE references encountered inside are resolved to their definitions so
    we descend into them too.
    """
    sources: set[str] = set()
    seen_ctes: set[str] = set()

    def _visit(node: exp.Expression) -> None:
        for tbl in node.find_all(exp.Table):
            if not tbl.name:
                continue
            name_lower = tbl.name.lower()
            if name_lower in cte_inner:
                if name_lower in seen_ctes:
                    continue  # avoid recursion
                seen_ctes.add(name_lower)
                _visit(cte_inner[name_lower])
            else:
                sources.add(name_lower)

    _visit(select_node)
    return frozenset(sources)


def _collect_projected_columns(select_node: exp.Select) -> frozenset[str] | None:
    """Return the names of columns this SELECT projects to its caller.

    Handles ``AS`` aliasing (the projected name is the alias, not the source
    column). Returns ``None`` when projections include ``SELECT *`` (or any
    expansion we can't statically enumerate) — meaning "any column might be
    exposed; trust the caller".
    """
    expressions = select_node.args.get("expressions") or []
    if not expressions:
        return None

    cols: set[str] = set()
    for proj in expressions:
        if isinstance(proj, exp.Star):
            return None  # wildcard — unknown columns
        if isinstance(proj, exp.Alias):
            alias_id = proj.args.get("alias")
            if isinstance(alias_id, exp.Identifier):
                cols.add(alias_id.name)
            continue
        if isinstance(proj, exp.Column):
            cols.add(proj.name)
            continue
        # Other expression types (functions, literals, etc.) without aliases
        # don't contribute a name we can match against. Skip.
    return frozenset(cols)


def _resolve_qualifier(
    outer_refs: list[_OuterRef], dash_filter: DashboardFilter
) -> str | None:
    """Pick the qualifier (table alias or name) for a dashboard filter, or None.

    Returns ``None`` when:
    - the filter's table isn't reachable at the outer scope, or
    - multiple outer refs match (ambiguous — same column would be filtered on
      either side; we'd have no principled way to choose).
    """
    if not dash_filter.table:
        return None
    table_lower = dash_filter.table.lower()
    field = dash_filter.field

    candidates: list[str] = []
    for ref in outer_refs:
        if table_lower not in ref.source_tables:
            continue
        # Direct table refs (exposed_columns is None) — trust dash config.
        # Derived refs — verify column is actually exposed.
        if ref.exposed_columns is not None and field not in ref.exposed_columns:
            continue
        candidates.append(ref.qualifier)

    unique = set(candidates)
    if not unique:
        return None
    if len(unique) > 1:
        _logger.warning(
            "Skipping dashboard filter on %r: table %r is reachable via "
            "multiple outer references (%s) and cannot be disambiguated.",
            dash_filter.field,
            dash_filter.table,
            sorted(unique),
        )
        return None
    return next(iter(unique))


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
        # Normalise trailing 'Z' (UTC designator) to '+00:00'. Python's
        # ``datetime.fromisoformat`` only accepts the bare 'Z' suffix on
        # 3.11+, but the package targets 3.10.
        normalised = value
        if normalised.endswith("Z"):
            normalised = normalised[:-1] + "+00:00"
        try:
            if "T" in normalised or " " in normalised:
                return datetime.fromisoformat(normalised.replace(" ", "T"))
            return date.fromisoformat(normalised)
        except ValueError:
            return None
    return None
