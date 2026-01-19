"""Filter merging utilities for Prismiq dashboards.

This module provides functions to merge dashboard filters with widget
queries, converting dashboard-level filters into query-level filters.
"""

from __future__ import annotations

import copy
from datetime import date
from typing import Any

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.dates import DatePreset, resolve_date_preset
from prismiq.types import (DatabaseSchema, FilterDefinition, FilterOperator,
                           QueryDefinition)
from pydantic import BaseModel, ConfigDict


class FilterValue(BaseModel):
    """Runtime value for a dashboard filter.

    Represents the current value of a filter as set by the user in the
    UI.
    """

    model_config = ConfigDict(strict=True)

    filter_id: str
    """ID of the dashboard filter this value applies to."""

    value: Any
    """The filter value. Type depends on filter type:
    - DATE_RANGE: dict with 'start' and 'end' date strings, or preset name
    - SELECT: single string value
    - MULTI_SELECT: list of string values
    - TEXT: string value
    - NUMBER_RANGE: dict with 'min' and/or 'max' numbers
    """


def merge_filters(
    query: QueryDefinition,
    dashboard_filters: list[DashboardFilter],
    filter_values: list[FilterValue],
    schema: DatabaseSchema,
) -> QueryDefinition:
    """Merge dashboard filter values into a widget query.

    Creates a new QueryDefinition with additional filters from the dashboard.
    Only applies filters whose fields exist in the query's tables.

    Args:
        query: The widget's base query definition.
        dashboard_filters: Dashboard filter definitions.
        filter_values: Current filter values from the UI.
        schema: Database schema for column lookup.

    Returns:
        New QueryDefinition with filters merged.

    Example:
        >>> merged = merge_filters(
        ...     query=widget.query,
        ...     dashboard_filters=dashboard.filters,
        ...     filter_values=[FilterValue(filter_id="f1", value="active")],
        ...     schema=schema,
        ... )
    """
    # Get applicable filters (those whose columns exist in the query)
    applicable = get_applicable_filters(query, dashboard_filters, schema)

    # Create filter value lookup
    value_map = {fv.filter_id: fv for fv in filter_values}

    # Convert dashboard filters to query filters
    new_filters: list[FilterDefinition] = []
    for dash_filter in applicable:
        filter_value = value_map.get(dash_filter.id)
        if filter_value is None:
            # Use default value if no runtime value provided
            if dash_filter.default_value is not None:
                filter_value = FilterValue(
                    filter_id=dash_filter.id, value=dash_filter.default_value
                )
            else:
                continue

        # Convert to query filter(s)
        query_filters = filter_to_query_filters(
            dash_filter, filter_value, query, schema
        )
        new_filters.extend(query_filters)

    if not new_filters:
        return query

    # Deep copy the query and add new filters
    return QueryDefinition(
        tables=copy.deepcopy(query.tables),
        joins=copy.deepcopy(query.joins),
        columns=copy.deepcopy(query.columns),
        filters=[*copy.deepcopy(query.filters), *new_filters],
        group_by=copy.deepcopy(query.group_by),
        order_by=copy.deepcopy(query.order_by),
        limit=query.limit,
        offset=query.offset,
        time_series=copy.deepcopy(query.time_series) if query.time_series else None,
    )


def filter_to_query_filter(
    dashboard_filter: DashboardFilter,
    value: FilterValue,
) -> FilterDefinition | None:
    """Convert a dashboard filter to a single query filter.

    This is a simplified version that doesn't resolve table IDs.
    Use filter_to_query_filters for full functionality.

    Args:
        dashboard_filter: The dashboard filter definition.
        value: The runtime filter value.

    Returns:
        A FilterDefinition, or None if filter shouldn't be applied.
    """
    # Handle empty or "all" values
    if value.value is None:
        return None

    if dashboard_filter.type == DashboardFilterType.SELECT:
        if value.value == "" or value.value == "__all__":
            return None
        return FilterDefinition(
            table_id="",  # Must be resolved by caller
            column=dashboard_filter.field,
            operator=FilterOperator.EQ,
            value=value.value,
        )

    if dashboard_filter.type == DashboardFilterType.MULTI_SELECT:
        if not value.value or len(value.value) == 0:
            return None
        return FilterDefinition(
            table_id="",
            column=dashboard_filter.field,
            operator=FilterOperator.IN,
            value=value.value,
        )

    if dashboard_filter.type == DashboardFilterType.TEXT:
        if not value.value or value.value == "":
            return None
        return FilterDefinition(
            table_id="",
            column=dashboard_filter.field,
            operator=FilterOperator.ILIKE,
            value=f"%{value.value}%",
        )

    # Date and number ranges require multiple filters, handled elsewhere
    return None


def filter_to_query_filters(
    dashboard_filter: DashboardFilter,
    value: FilterValue,
    query: QueryDefinition,
    schema: DatabaseSchema,
) -> list[FilterDefinition]:
    """Convert a dashboard filter to query filter(s).

    Handles date ranges (which need two filters) and resolves table IDs.

    Args:
        dashboard_filter: The dashboard filter definition.
        value: The runtime filter value.
        query: The query to merge into.
        schema: Database schema for column lookup.

    Returns:
        List of FilterDefinition objects (may be empty, one, or two).
    """
    # Find the table containing this column
    table_id = _find_table_for_column(
        query, dashboard_filter.field, dashboard_filter.table, schema
    )
    if table_id is None:
        return []

    # Handle empty or null values
    if value.value is None:
        return []

    filters: list[FilterDefinition] = []

    if dashboard_filter.type == DashboardFilterType.DATE_RANGE:
        date_range = resolve_date_filter(dashboard_filter, value)
        if date_range:
            start_date, end_date = date_range
            filters.append(
                FilterDefinition(
                    table_id=table_id,
                    column=dashboard_filter.field,
                    operator=FilterOperator.GTE,
                    value=start_date.isoformat(),
                )
            )
            filters.append(
                FilterDefinition(
                    table_id=table_id,
                    column=dashboard_filter.field,
                    operator=FilterOperator.LTE,
                    value=end_date.isoformat(),
                )
            )

    elif dashboard_filter.type == DashboardFilterType.SELECT:
        if value.value and value.value != "" and value.value != "__all__":
            filters.append(
                FilterDefinition(
                    table_id=table_id,
                    column=dashboard_filter.field,
                    operator=FilterOperator.EQ,
                    value=value.value,
                )
            )

    elif dashboard_filter.type == DashboardFilterType.MULTI_SELECT:
        if value.value and len(value.value) > 0:
            filters.append(
                FilterDefinition(
                    table_id=table_id,
                    column=dashboard_filter.field,
                    operator=FilterOperator.IN,
                    value=value.value,
                )
            )

    elif dashboard_filter.type == DashboardFilterType.TEXT:
        if value.value and value.value != "":
            filters.append(
                FilterDefinition(
                    table_id=table_id,
                    column=dashboard_filter.field,
                    operator=FilterOperator.ILIKE,
                    value=f"%{value.value}%",
                )
            )

    elif dashboard_filter.type == DashboardFilterType.NUMBER_RANGE:
        number_range = value.value
        if isinstance(number_range, dict):
            if "min" in number_range and number_range["min"] is not None:
                filters.append(
                    FilterDefinition(
                        table_id=table_id,
                        column=dashboard_filter.field,
                        operator=FilterOperator.GTE,
                        value=number_range["min"],
                    )
                )
            if "max" in number_range and number_range["max"] is not None:
                filters.append(
                    FilterDefinition(
                        table_id=table_id,
                        column=dashboard_filter.field,
                        operator=FilterOperator.LTE,
                        value=number_range["max"],
                    )
                )

    return filters


def get_applicable_filters(
    query: QueryDefinition,
    dashboard_filters: list[DashboardFilter],
    schema: DatabaseSchema,
) -> list[DashboardFilter]:
    """Get filters that apply to a specific query.

    Only returns filters whose field exists in one of the query's tables.

    Args:
        query: The widget's query definition.
        dashboard_filters: Dashboard filter definitions.
        schema: Database schema for column lookup.

    Returns:
        List of applicable DashboardFilter objects.
    """
    applicable: list[DashboardFilter] = []

    for dash_filter in dashboard_filters:
        table_id = _find_table_for_column(
            query, dash_filter.field, dash_filter.table, schema
        )
        if table_id is not None:
            applicable.append(dash_filter)

    return applicable


def resolve_date_filter(
    filter_def: DashboardFilter,
    value: FilterValue,
) -> tuple[date, date] | None:
    """Resolve a date range filter value to concrete dates.

    Handles both preset values (like "last_30_days") and explicit date ranges.

    Args:
        filter_def: The dashboard filter definition.
        value: The runtime filter value.

    Returns:
        Tuple of (start_date, end_date), or None if cannot be resolved.
    """
    filter_value = value.value

    if filter_value is None:
        # Try using the filter's date_preset default
        if filter_def.date_preset:
            preset = _str_to_date_preset(filter_def.date_preset)
            if preset:
                return resolve_date_preset(preset)
        return None

    # Handle string preset values
    if isinstance(filter_value, str):
        preset = _str_to_date_preset(filter_value)
        if preset:
            return resolve_date_preset(preset)
        return None

    # Handle dict with explicit start/end
    if isinstance(filter_value, dict):
        # Check for preset in dict
        if "preset" in filter_value:
            preset = _str_to_date_preset(filter_value["preset"])
            if preset:
                return resolve_date_preset(preset)
            return None

        # Check for explicit start/end dates
        start_str = filter_value.get("start")
        end_str = filter_value.get("end")

        if start_str and end_str:
            try:
                start_date = date.fromisoformat(str(start_str))
                end_date = date.fromisoformat(str(end_str))
                return (start_date, end_date)
            except ValueError:
                return None

    return None


def _str_to_date_preset(value: str) -> DatePreset | None:
    """Convert a string to a DatePreset enum value.

    Args:
        value: The string value to convert.

    Returns:
        The DatePreset enum value, or None if invalid.
    """
    try:
        return DatePreset(value)
    except ValueError:
        return None


def _find_table_for_column(
    query: QueryDefinition,
    column_name: str,
    table_hint: str | None,
    schema: DatabaseSchema,
) -> str | None:
    """Find the table ID containing a specific column.

    Args:
        query: The query to search in.
        column_name: Name of the column to find.
        table_hint: Optional table name hint from the filter.
        schema: Database schema for column lookup.

    Returns:
        The table ID containing the column, or None if not found.
    """
    for query_table in query.tables:
        # If table hint is provided, only check that table
        if table_hint and query_table.name != table_hint:
            continue

        table_schema = schema.get_table(query_table.name)
        if table_schema and table_schema.has_column(column_name):
            return query_table.id

    return None
