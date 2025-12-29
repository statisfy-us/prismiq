"""
Dashboard and Widget models for Prismiq.

This module provides Pydantic models for dashboards, widgets, and filters.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from prismiq.types import QueryDefinition


def _utc_now() -> datetime:
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


# ============================================================================
# Widget Types
# ============================================================================


class WidgetType(str, Enum):
    """Types of dashboard widgets."""

    METRIC = "metric"
    BAR_CHART = "bar_chart"
    LINE_CHART = "line_chart"
    AREA_CHART = "area_chart"
    PIE_CHART = "pie_chart"
    SCATTER_CHART = "scatter_chart"
    TABLE = "table"
    TEXT = "text"


class WidgetPosition(BaseModel):
    """Widget position in grid layout."""

    model_config = ConfigDict()

    x: int = Field(ge=0)
    """X position in grid units."""

    y: int = Field(ge=0)
    """Y position in grid units."""

    w: int = Field(ge=1)
    """Width in grid units."""

    h: int = Field(ge=1)
    """Height in grid units."""


class WidgetConfig(BaseModel):
    """Widget-specific configuration."""

    model_config = ConfigDict()

    # Chart-specific options
    x_axis: str | None = None
    """Column to use for X axis."""

    y_axis: list[str] | None = None
    """Columns to use for Y axis (multi-series)."""

    orientation: str | None = None
    """Chart orientation: 'horizontal' or 'vertical'."""

    stacked: bool | None = None
    """Whether to stack bars/areas."""

    show_legend: bool | None = None
    """Whether to show chart legend."""

    show_data_labels: bool | None = None
    """Whether to show data labels on chart."""

    colors: list[str] | None = None
    """Custom color palette for the chart."""

    # MetricCard options
    format: str | None = None
    """Number format for metric values."""

    trend_comparison: str | None = None
    """Period for trend comparison."""

    # Table options
    page_size: int | None = None
    """Number of rows per page."""

    sortable: bool | None = None
    """Whether table columns are sortable."""

    # Text options
    content: str | None = None
    """Text content for text widgets."""

    markdown: bool | None = None
    """Whether to render content as markdown."""


class Widget(BaseModel):
    """A dashboard widget."""

    model_config = ConfigDict()

    id: str
    """Unique widget identifier."""

    type: WidgetType
    """Type of widget."""

    title: str
    """Widget title."""

    query: QueryDefinition | None = None
    """Query definition for data. None for text widgets."""

    position: WidgetPosition
    """Position and size in grid layout."""

    config: WidgetConfig = Field(default_factory=WidgetConfig)
    """Widget-specific configuration."""

    created_at: datetime = Field(default_factory=_utc_now)
    """When the widget was created."""

    updated_at: datetime = Field(default_factory=_utc_now)
    """When the widget was last updated."""


# ============================================================================
# Dashboard Filter Types
# ============================================================================


class DashboardFilterType(str, Enum):
    """Types of dashboard filters."""

    DATE_RANGE = "date_range"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    TEXT = "text"
    NUMBER_RANGE = "number_range"


class DashboardFilter(BaseModel):
    """A global dashboard filter."""

    model_config = ConfigDict()

    id: str
    """Unique filter identifier."""

    type: DashboardFilterType
    """Type of filter."""

    label: str
    """Display label for the filter."""

    field: str
    """Column to filter."""

    table: str | None = None
    """Table name (if ambiguous across tables)."""

    # Type-specific options
    default_value: Any | None = None
    """Default value for the filter."""

    options: list[dict[str, str]] | None = None
    """Available options for select types."""

    date_preset: str | None = None
    """Date preset for date_range type."""


# ============================================================================
# Dashboard Layout
# ============================================================================


class DashboardLayout(BaseModel):
    """Dashboard layout configuration."""

    model_config = ConfigDict()

    columns: int = 12
    """Number of grid columns."""

    row_height: int = 50
    """Height of each grid row in pixels."""

    margin: tuple[int, int] = (10, 10)
    """Margin between widgets (x, y)."""

    compact_type: str | None = "vertical"
    """Compaction direction: 'vertical', 'horizontal', or None."""


# ============================================================================
# Dashboard Model
# ============================================================================


class Dashboard(BaseModel):
    """A complete dashboard."""

    model_config = ConfigDict()

    id: str
    """Unique dashboard identifier."""

    name: str
    """Dashboard name."""

    description: str | None = None
    """Dashboard description."""

    layout: DashboardLayout = Field(default_factory=DashboardLayout)
    """Layout configuration."""

    widgets: list[Widget] = Field(default_factory=list)
    """Widgets in the dashboard."""

    filters: list[DashboardFilter] = Field(default_factory=list)
    """Global filters for the dashboard."""

    owner_id: str | None = None
    """ID of the dashboard owner."""

    created_at: datetime = Field(default_factory=_utc_now)
    """When the dashboard was created."""

    updated_at: datetime = Field(default_factory=_utc_now)
    """When the dashboard was last updated."""

    # Permissions
    is_public: bool = False
    """Whether the dashboard is publicly accessible."""

    allowed_viewers: list[str] = Field(default_factory=list)
    """List of user IDs allowed to view this dashboard."""

    def get_widget(self, widget_id: str) -> Widget | None:
        """Get a widget by ID."""
        for widget in self.widgets:
            if widget.id == widget_id:
                return widget
        return None


# ============================================================================
# DTOs for CRUD operations
# ============================================================================


class DashboardCreate(BaseModel):
    """DTO for creating a dashboard."""

    model_config = ConfigDict()

    name: str
    """Dashboard name."""

    description: str | None = None
    """Dashboard description."""

    layout: DashboardLayout | None = None
    """Optional layout configuration."""


class DashboardUpdate(BaseModel):
    """DTO for updating a dashboard."""

    model_config = ConfigDict()

    name: str | None = None
    """New dashboard name."""

    description: str | None = None
    """New dashboard description."""

    layout: DashboardLayout | None = None
    """New layout configuration."""

    filters: list[DashboardFilter] | None = None
    """New dashboard filters."""

    is_public: bool | None = None
    """New public visibility setting."""

    allowed_viewers: list[str] | None = None
    """New list of allowed viewers."""


class WidgetCreate(BaseModel):
    """DTO for creating a widget."""

    model_config = ConfigDict()

    type: WidgetType
    """Type of widget."""

    title: str
    """Widget title."""

    query: QueryDefinition | None = None
    """Query definition for data."""

    position: WidgetPosition
    """Position and size in grid layout."""

    config: WidgetConfig | None = None
    """Widget-specific configuration."""


class WidgetUpdate(BaseModel):
    """DTO for updating a widget."""

    model_config = ConfigDict()

    title: str | None = None
    """New widget title."""

    query: QueryDefinition | None = None
    """New query definition."""

    position: WidgetPosition | None = None
    """New position and size."""

    config: WidgetConfig | None = None
    """New widget configuration."""


# ============================================================================
# Export Format
# ============================================================================


class DashboardExport(BaseModel):
    """Export format for dashboards."""

    model_config = ConfigDict()

    version: str = "1.0"
    """Export format version for future compatibility."""

    name: str
    """Dashboard name."""

    description: str | None = None
    """Dashboard description."""

    layout: DashboardLayout
    """Layout configuration."""

    widgets: list[dict[str, Any]]
    """Widget data without IDs."""

    filters: list[DashboardFilter]
    """Dashboard filters."""
