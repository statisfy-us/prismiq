"""Tests for dashboard and widget models."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardExport,
    DashboardFilter,
    DashboardFilterType,
    DashboardLayout,
    DashboardUpdate,
    Widget,
    WidgetConfig,
    WidgetCreate,
    WidgetPosition,
    WidgetType,
    WidgetUpdate,
)
from prismiq.types import (
    AggregationType,
    ColumnSelection,
    QueryDefinition,
    QueryTable,
)

# ============================================================================
# WidgetPosition Tests
# ============================================================================


class TestWidgetPosition:
    """Tests for WidgetPosition model."""

    def test_valid_position(self) -> None:
        """Test creating a valid widget position."""
        pos = WidgetPosition(x=0, y=0, w=4, h=3)
        assert pos.x == 0
        assert pos.y == 0
        assert pos.w == 4
        assert pos.h == 3

    def test_negative_x_rejected(self) -> None:
        """Test that negative x coordinate is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WidgetPosition(x=-1, y=0, w=4, h=3)
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_negative_y_rejected(self) -> None:
        """Test that negative y coordinate is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WidgetPosition(x=0, y=-1, w=4, h=3)
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_zero_width_rejected(self) -> None:
        """Test that zero width is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WidgetPosition(x=0, y=0, w=0, h=3)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_zero_height_rejected(self) -> None:
        """Test that zero height is rejected."""
        with pytest.raises(ValidationError) as exc_info:
            WidgetPosition(x=0, y=0, w=4, h=0)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_serialization(self) -> None:
        """Test position serialization."""
        pos = WidgetPosition(x=2, y=5, w=6, h=4)
        data = pos.model_dump()
        assert data == {"x": 2, "y": 5, "w": 6, "h": 4}

    def test_deserialization(self) -> None:
        """Test position deserialization."""
        data = {"x": 2, "y": 5, "w": 6, "h": 4}
        pos = WidgetPosition.model_validate(data)
        assert pos.x == 2
        assert pos.y == 5
        assert pos.w == 6
        assert pos.h == 4


# ============================================================================
# WidgetConfig Tests
# ============================================================================


class TestWidgetConfig:
    """Tests for WidgetConfig model."""

    def test_default_config(self) -> None:
        """Test default widget config has all None values."""
        config = WidgetConfig()
        assert config.x_axis is None
        assert config.y_axis is None
        assert config.stacked is None
        assert config.colors is None

    def test_chart_config(self) -> None:
        """Test chart-specific configuration."""
        config = WidgetConfig(
            x_axis="date",
            y_axis=["revenue", "cost"],
            orientation="vertical",
            stacked=True,
            show_legend=True,
            colors=["#ff0000", "#00ff00"],
        )
        assert config.x_axis == "date"
        assert config.y_axis == ["revenue", "cost"]
        assert config.stacked is True
        assert config.colors == ["#ff0000", "#00ff00"]

    def test_metric_config(self) -> None:
        """Test metric card configuration."""
        config = WidgetConfig(
            format="currency",
            trend_comparison="previous_period",
        )
        assert config.format == "currency"
        assert config.trend_comparison == "previous_period"

    def test_table_config(self) -> None:
        """Test table configuration."""
        config = WidgetConfig(
            page_size=25,
            sortable=True,
        )
        assert config.page_size == 25
        assert config.sortable is True

    def test_text_config(self) -> None:
        """Test text widget configuration."""
        config = WidgetConfig(
            content="# Dashboard Header\n\nWelcome to the dashboard.",
            markdown=True,
        )
        assert config.content == "# Dashboard Header\n\nWelcome to the dashboard."
        assert config.markdown is True


# ============================================================================
# WidgetType Tests
# ============================================================================


class TestWidgetType:
    """Tests for WidgetType enum."""

    def test_all_types_defined(self) -> None:
        """Test all expected widget types are defined."""
        expected = [
            "metric",
            "bar_chart",
            "line_chart",
            "area_chart",
            "pie_chart",
            "scatter_chart",
            "table",
            "text",
        ]
        actual = [t.value for t in WidgetType]
        assert actual == expected

    def test_from_string(self) -> None:
        """Test creating widget type from string."""
        assert WidgetType("bar_chart") == WidgetType.BAR_CHART
        assert WidgetType("metric") == WidgetType.METRIC


# ============================================================================
# Widget Tests
# ============================================================================


class TestWidget:
    """Tests for Widget model."""

    def test_text_widget_no_query(self) -> None:
        """Test text widget doesn't require a query."""
        widget = Widget(
            id="w1",
            type=WidgetType.TEXT,
            title="Welcome",
            position=WidgetPosition(x=0, y=0, w=12, h=2),
            config=WidgetConfig(content="Hello World", markdown=False),
        )
        assert widget.query is None
        assert widget.config.content == "Hello World"

    def test_chart_widget_with_query(self) -> None:
        """Test chart widget with a query."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="amount", aggregation=AggregationType.SUM),
            ],
        )
        widget = Widget(
            id="w2",
            type=WidgetType.BAR_CHART,
            title="Revenue",
            query=query,
            position=WidgetPosition(x=0, y=2, w=6, h=4),
        )
        assert widget.query is not None
        assert widget.type == WidgetType.BAR_CHART

    def test_timestamps_auto_set(self) -> None:
        """Test that timestamps are automatically set."""
        before = datetime.now(timezone.utc)
        widget = Widget(
            id="w1",
            type=WidgetType.TABLE,
            title="Data",
            position=WidgetPosition(x=0, y=0, w=12, h=6),
        )
        after = datetime.now(timezone.utc)
        assert before <= widget.created_at <= after
        assert before <= widget.updated_at <= after

    def test_widget_serialization(self) -> None:
        """Test widget serialization."""
        widget = Widget(
            id="w1",
            type=WidgetType.METRIC,
            title="Total Sales",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
            config=WidgetConfig(format="currency"),
        )
        data = widget.model_dump()
        assert data["id"] == "w1"
        assert data["type"] == "metric"
        assert data["title"] == "Total Sales"
        assert data["position"]["w"] == 3
        assert data["config"]["format"] == "currency"

    def test_widget_deserialization_from_json(self) -> None:
        """Test widget deserialization from JSON string."""
        json_data = json.dumps(
            {
                "id": "w1",
                "type": "line_chart",
                "title": "Trend",
                "position": {"x": 0, "y": 0, "w": 6, "h": 4},
                "config": {"show_legend": True},
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00",
            }
        )
        widget = Widget.model_validate_json(json_data)
        assert widget.type == WidgetType.LINE_CHART
        assert widget.config.show_legend is True

    def test_widget_roundtrip(self) -> None:
        """Test widget serialization and deserialization roundtrip."""
        original = Widget(
            id="w1",
            type=WidgetType.PIE_CHART,
            title="Distribution",
            position=WidgetPosition(x=0, y=0, w=6, h=4),
            config=WidgetConfig(show_legend=True, colors=["#ff0000"]),
        )
        json_str = original.model_dump_json()
        restored = Widget.model_validate_json(json_str)
        assert restored.id == original.id
        assert restored.type == original.type
        assert restored.config.colors == original.config.colors


# ============================================================================
# DashboardFilter Tests
# ============================================================================


class TestDashboardFilter:
    """Tests for DashboardFilter model."""

    def test_date_range_filter(self) -> None:
        """Test date range filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date Range",
            field="created_at",
            table="orders",
            date_preset="last_30_days",
        )
        assert filter_def.type == DashboardFilterType.DATE_RANGE
        assert filter_def.date_preset == "last_30_days"

    def test_select_filter_with_options(self) -> None:
        """Test select filter with options."""
        filter_def = DashboardFilter(
            id="f2",
            type=DashboardFilterType.SELECT,
            label="Status",
            field="status",
            options=[
                {"value": "active", "label": "Active"},
                {"value": "inactive", "label": "Inactive"},
            ],
            default_value="active",
        )
        assert filter_def.type == DashboardFilterType.SELECT
        assert len(filter_def.options) == 2
        assert filter_def.default_value == "active"

    def test_multi_select_filter(self) -> None:
        """Test multi-select filter."""
        filter_def = DashboardFilter(
            id="f3",
            type=DashboardFilterType.MULTI_SELECT,
            label="Categories",
            field="category",
            options=[
                {"value": "electronics", "label": "Electronics"},
                {"value": "clothing", "label": "Clothing"},
                {"value": "food", "label": "Food"},
            ],
            default_value=["electronics", "clothing"],
        )
        assert filter_def.type == DashboardFilterType.MULTI_SELECT
        assert filter_def.default_value == ["electronics", "clothing"]

    def test_text_filter(self) -> None:
        """Test text filter."""
        filter_def = DashboardFilter(
            id="f4",
            type=DashboardFilterType.TEXT,
            label="Search",
            field="name",
        )
        assert filter_def.type == DashboardFilterType.TEXT

    def test_number_range_filter(self) -> None:
        """Test number range filter."""
        filter_def = DashboardFilter(
            id="f5",
            type=DashboardFilterType.NUMBER_RANGE,
            label="Price Range",
            field="price",
            default_value={"min": 0, "max": 100},
        )
        assert filter_def.type == DashboardFilterType.NUMBER_RANGE


# ============================================================================
# DashboardLayout Tests
# ============================================================================


class TestDashboardLayout:
    """Tests for DashboardLayout model."""

    def test_default_layout(self) -> None:
        """Test default layout values."""
        layout = DashboardLayout()
        assert layout.columns == 12
        assert layout.row_height == 50
        assert layout.margin == (10, 10)
        assert layout.compact_type == "vertical"

    def test_custom_layout(self) -> None:
        """Test custom layout values."""
        layout = DashboardLayout(
            columns=24,
            row_height=30,
            margin=(5, 5),
            compact_type="horizontal",
        )
        assert layout.columns == 24
        assert layout.row_height == 30
        assert layout.margin == (5, 5)
        assert layout.compact_type == "horizontal"

    def test_layout_json_roundtrip(self) -> None:
        """Test layout JSON serialization and deserialization."""
        original = DashboardLayout(columns=24, margin=(5, 10))
        json_str = original.model_dump_json()
        restored = DashboardLayout.model_validate_json(json_str)
        assert restored.columns == original.columns
        assert restored.margin == original.margin


# ============================================================================
# Dashboard Tests
# ============================================================================


class TestDashboard:
    """Tests for Dashboard model."""

    def test_minimal_dashboard(self) -> None:
        """Test creating a minimal dashboard."""
        dashboard = Dashboard(
            id="d1",
            name="Sales Dashboard",
        )
        assert dashboard.id == "d1"
        assert dashboard.name == "Sales Dashboard"
        assert dashboard.widgets == []
        assert dashboard.filters == []
        assert dashboard.is_public is False

    def test_dashboard_with_widgets(self) -> None:
        """Test dashboard with widgets."""
        widgets = [
            Widget(
                id="w1",
                type=WidgetType.METRIC,
                title="Total",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            Widget(
                id="w2",
                type=WidgetType.BAR_CHART,
                title="By Category",
                position=WidgetPosition(x=3, y=0, w=9, h=4),
            ),
        ]
        dashboard = Dashboard(
            id="d1",
            name="Sales",
            widgets=widgets,
        )
        assert len(dashboard.widgets) == 2

    def test_get_widget(self) -> None:
        """Test getting a widget by ID."""
        widget = Widget(
            id="w1",
            type=WidgetType.TABLE,
            title="Data",
            position=WidgetPosition(x=0, y=0, w=12, h=6),
        )
        dashboard = Dashboard(
            id="d1",
            name="Test",
            widgets=[widget],
        )
        assert dashboard.get_widget("w1") is widget
        assert dashboard.get_widget("w2") is None

    def test_dashboard_permissions(self) -> None:
        """Test dashboard permission fields."""
        dashboard = Dashboard(
            id="d1",
            name="Private Dashboard",
            owner_id="user_123",
            is_public=False,
            allowed_viewers=["user_456", "user_789"],
        )
        assert dashboard.owner_id == "user_123"
        assert dashboard.is_public is False
        assert len(dashboard.allowed_viewers) == 2

    def test_dashboard_serialization(self) -> None:
        """Test dashboard serialization."""
        dashboard = Dashboard(
            id="d1",
            name="Test Dashboard",
            description="A test dashboard",
            owner_id="user_1",
            is_public=True,
        )
        data = dashboard.model_dump()
        assert data["id"] == "d1"
        assert data["name"] == "Test Dashboard"
        assert data["is_public"] is True

    def test_dashboard_json_roundtrip(self) -> None:
        """Test dashboard JSON serialization and deserialization roundtrip."""
        widget = Widget(
            id="w1",
            type=WidgetType.METRIC,
            title="Count",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
        )
        original = Dashboard(
            id="d1",
            name="Test",
            widgets=[widget],
            layout=DashboardLayout(columns=12, row_height=50, margin=(10, 10)),
        )
        json_str = original.model_dump_json()
        restored = Dashboard.model_validate_json(json_str)
        assert restored.name == "Test"
        assert len(restored.widgets) == 1
        assert restored.widgets[0].type == WidgetType.METRIC


# ============================================================================
# DTO Tests
# ============================================================================


class TestDashboardCreate:
    """Tests for DashboardCreate DTO."""

    def test_minimal_create(self) -> None:
        """Test creating with just a name."""
        dto = DashboardCreate(name="New Dashboard")
        assert dto.name == "New Dashboard"
        assert dto.description is None
        assert dto.layout is None

    def test_full_create(self) -> None:
        """Test creating with all fields."""
        dto = DashboardCreate(
            name="Sales Dashboard",
            description="Overview of sales metrics",
            layout=DashboardLayout(columns=24),
        )
        assert dto.name == "Sales Dashboard"
        assert dto.description == "Overview of sales metrics"
        assert dto.layout.columns == 24


class TestDashboardUpdate:
    """Tests for DashboardUpdate DTO."""

    def test_partial_update(self) -> None:
        """Test partial update with only name."""
        dto = DashboardUpdate(name="Updated Name")
        assert dto.name == "Updated Name"
        assert dto.description is None
        assert dto.layout is None
        assert dto.filters is None

    def test_full_update(self) -> None:
        """Test update with all fields."""
        dto = DashboardUpdate(
            name="Updated",
            description="Updated description",
            is_public=True,
            allowed_viewers=["user_1"],
        )
        assert dto.name == "Updated"
        assert dto.is_public is True
        assert dto.allowed_viewers == ["user_1"]


class TestWidgetCreate:
    """Tests for WidgetCreate DTO."""

    def test_minimal_widget_create(self) -> None:
        """Test creating widget with minimal fields."""
        dto = WidgetCreate(
            type=WidgetType.TABLE,
            title="Data Table",
            position=WidgetPosition(x=0, y=0, w=12, h=6),
        )
        assert dto.type == WidgetType.TABLE
        assert dto.query is None
        assert dto.config is None

    def test_full_widget_create(self) -> None:
        """Test creating widget with all fields."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )
        dto = WidgetCreate(
            type=WidgetType.BAR_CHART,
            title="User Chart",
            query=query,
            position=WidgetPosition(x=0, y=0, w=6, h=4),
            config=WidgetConfig(orientation="horizontal"),
        )
        assert dto.query is not None
        assert dto.config.orientation == "horizontal"


class TestWidgetUpdate:
    """Tests for WidgetUpdate DTO."""

    def test_partial_update(self) -> None:
        """Test partial widget update."""
        dto = WidgetUpdate(title="New Title")
        assert dto.title == "New Title"
        assert dto.position is None
        assert dto.config is None

    def test_position_update(self) -> None:
        """Test updating widget position."""
        dto = WidgetUpdate(
            position=WidgetPosition(x=6, y=0, w=6, h=4),
        )
        assert dto.position.x == 6
        assert dto.position.w == 6


# ============================================================================
# DashboardExport Tests
# ============================================================================


class TestDashboardExport:
    """Tests for DashboardExport model."""

    def test_export_format(self) -> None:
        """Test export format structure."""
        export = DashboardExport(
            version="1.0",
            name="My Dashboard",
            description="Export test",
            layout=DashboardLayout(),
            widgets=[
                {"type": "metric", "title": "Count", "position": {"x": 0, "y": 0, "w": 3, "h": 2}}
            ],
            filters=[],
        )
        assert export.version == "1.0"
        assert export.name == "My Dashboard"
        assert len(export.widgets) == 1

    def test_export_default_version(self) -> None:
        """Test that export has default version."""
        export = DashboardExport(
            name="Test",
            layout=DashboardLayout(),
            widgets=[],
            filters=[],
        )
        assert export.version == "1.0"
