"""Tests for dashboard storage implementations."""

from __future__ import annotations

import pytest

from prismiq.dashboard_store import InMemoryDashboardStore
from prismiq.dashboards import (
    DashboardCreate,
    DashboardFilter,
    DashboardFilterType,
    DashboardLayout,
    DashboardUpdate,
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

# Test tenant ID for all tests
TEST_TENANT_ID = "test_tenant"

# ============================================================================
# InMemoryDashboardStore Tests
# ============================================================================


class TestInMemoryDashboardStoreListDashboards:
    """Tests for listing dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_empty_store_returns_empty_list(self, store: InMemoryDashboardStore) -> None:
        """Test listing dashboards from empty store."""
        dashboards = await store.list_dashboards(TEST_TENANT_ID)
        assert dashboards == []

    async def test_list_all_dashboards(self, store: InMemoryDashboardStore) -> None:
        """Test listing all dashboards."""
        await store.create_dashboard(DashboardCreate(name="Dashboard 1"), TEST_TENANT_ID)
        await store.create_dashboard(DashboardCreate(name="Dashboard 2"), TEST_TENANT_ID)
        await store.create_dashboard(DashboardCreate(name="Dashboard 3"), TEST_TENANT_ID)

        dashboards = await store.list_dashboards(TEST_TENANT_ID)
        assert len(dashboards) == 3
        names = {d.name for d in dashboards}
        assert names == {"Dashboard 1", "Dashboard 2", "Dashboard 3"}

    async def test_list_dashboards_filter_by_owner(self, store: InMemoryDashboardStore) -> None:
        """Test filtering dashboards by owner."""
        await store.create_dashboard(
            DashboardCreate(name="D1"), tenant_id=TEST_TENANT_ID, owner_id="user_1"
        )
        await store.create_dashboard(
            DashboardCreate(name="D2"), tenant_id=TEST_TENANT_ID, owner_id="user_1"
        )
        await store.create_dashboard(
            DashboardCreate(name="D3"), tenant_id=TEST_TENANT_ID, owner_id="user_2"
        )

        user1_dashboards = await store.list_dashboards(TEST_TENANT_ID, owner_id="user_1")
        assert len(user1_dashboards) == 2

        user2_dashboards = await store.list_dashboards(TEST_TENANT_ID, owner_id="user_2")
        assert len(user2_dashboards) == 1

        user3_dashboards = await store.list_dashboards(TEST_TENANT_ID, owner_id="user_3")
        assert len(user3_dashboards) == 0


class TestInMemoryDashboardStoreGetDashboard:
    """Tests for getting a single dashboard."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_get_existing_dashboard(self, store: InMemoryDashboardStore) -> None:
        """Test getting an existing dashboard."""
        created = await store.create_dashboard(
            DashboardCreate(name="Test Dashboard"), TEST_TENANT_ID
        )
        retrieved = await store.get_dashboard(created.id, TEST_TENANT_ID)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == "Test Dashboard"

    async def test_get_nonexistent_dashboard_returns_none(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test getting a nonexistent dashboard returns None."""
        result = await store.get_dashboard("nonexistent_id", TEST_TENANT_ID)
        assert result is None

    async def test_returned_dashboard_is_copy(self, store: InMemoryDashboardStore) -> None:
        """Test that returned dashboard is a deep copy."""
        created = await store.create_dashboard(DashboardCreate(name="Original"), TEST_TENANT_ID)
        retrieved = await store.get_dashboard(created.id, TEST_TENANT_ID)

        # Modifying retrieved should not affect stored
        assert retrieved is not None
        # The model is immutable due to strict=True, so this verifies deep copy
        assert retrieved is not created


class TestInMemoryDashboardStoreCreateDashboard:
    """Tests for creating dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_create_minimal_dashboard(self, store: InMemoryDashboardStore) -> None:
        """Test creating a dashboard with minimal data."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Minimal"), TEST_TENANT_ID)

        assert dashboard.id is not None
        assert dashboard.name == "Minimal"
        assert dashboard.description is None
        assert dashboard.widgets == []
        assert dashboard.filters == []

    async def test_create_dashboard_with_description(self, store: InMemoryDashboardStore) -> None:
        """Test creating a dashboard with description."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Sales", description="Sales metrics dashboard"), TEST_TENANT_ID
        )

        assert dashboard.description == "Sales metrics dashboard"

    async def test_create_dashboard_with_custom_layout(self, store: InMemoryDashboardStore) -> None:
        """Test creating a dashboard with custom layout."""
        layout = DashboardLayout(columns=24, row_height=30)
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Custom", layout=layout), TEST_TENANT_ID
        )

        assert dashboard.layout.columns == 24
        assert dashboard.layout.row_height == 30

    async def test_create_dashboard_sets_owner_id(self, store: InMemoryDashboardStore) -> None:
        """Test creating a dashboard sets owner ID."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Owned"), tenant_id=TEST_TENANT_ID, owner_id="user_123"
        )

        assert dashboard.owner_id == "user_123"

    async def test_create_dashboard_generates_unique_ids(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that each dashboard gets a unique ID."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        assert len({d1.id, d2.id, d3.id}) == 3

    async def test_create_dashboard_sets_timestamps(self, store: InMemoryDashboardStore) -> None:
        """Test that created_at and updated_at are set."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Timestamped"), TEST_TENANT_ID
        )

        assert dashboard.created_at is not None
        assert dashboard.updated_at is not None
        assert dashboard.created_at == dashboard.updated_at


class TestInMemoryDashboardStoreUpdateDashboard:
    """Tests for updating dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_update_dashboard_name(self, store: InMemoryDashboardStore) -> None:
        """Test updating dashboard name."""
        created = await store.create_dashboard(DashboardCreate(name="Original"), TEST_TENANT_ID)
        updated = await store.update_dashboard(
            created.id, DashboardUpdate(name="Updated"), TEST_TENANT_ID
        )

        assert updated is not None
        assert updated.name == "Updated"

    async def test_update_dashboard_preserves_unchanged_fields(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that unchanged fields are preserved."""
        created = await store.create_dashboard(
            DashboardCreate(name="Test", description="Original description"), TEST_TENANT_ID
        )
        updated = await store.update_dashboard(
            created.id, DashboardUpdate(name="New Name"), TEST_TENANT_ID
        )

        assert updated is not None
        assert updated.name == "New Name"
        assert updated.description == "Original description"

    async def test_update_dashboard_updates_timestamp(self, store: InMemoryDashboardStore) -> None:
        """Test that updated_at is changed on update."""
        created = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        updated = await store.update_dashboard(
            created.id, DashboardUpdate(description="New desc"), TEST_TENANT_ID
        )

        assert updated is not None
        assert updated.updated_at > created.updated_at

    async def test_update_nonexistent_dashboard_returns_none(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test updating nonexistent dashboard returns None."""
        result = await store.update_dashboard(
            "nonexistent", DashboardUpdate(name="Test"), TEST_TENANT_ID
        )
        assert result is None

    async def test_update_dashboard_filters(self, store: InMemoryDashboardStore) -> None:
        """Test updating dashboard filters."""
        created = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            )
        ]
        updated = await store.update_dashboard(
            created.id, DashboardUpdate(filters=filters), TEST_TENANT_ID
        )

        assert updated is not None
        assert len(updated.filters) == 1
        assert updated.filters[0].label == "Status"

    async def test_update_dashboard_visibility(self, store: InMemoryDashboardStore) -> None:
        """Test updating dashboard visibility."""
        created = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        assert created.is_public is False

        updated = await store.update_dashboard(
            created.id,
            DashboardUpdate(is_public=True, allowed_viewers=["user_1", "user_2"]),
            TEST_TENANT_ID,
        )

        assert updated is not None
        assert updated.is_public is True
        assert updated.allowed_viewers == ["user_1", "user_2"]


class TestInMemoryDashboardStoreDeleteDashboard:
    """Tests for deleting dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_delete_existing_dashboard(self, store: InMemoryDashboardStore) -> None:
        """Test deleting an existing dashboard."""
        created = await store.create_dashboard(DashboardCreate(name="ToDelete"), TEST_TENANT_ID)
        result = await store.delete_dashboard(created.id, TEST_TENANT_ID)

        assert result is True
        assert await store.get_dashboard(created.id, TEST_TENANT_ID) is None

    async def test_delete_nonexistent_dashboard_returns_false(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test deleting nonexistent dashboard returns False."""
        result = await store.delete_dashboard("nonexistent", TEST_TENANT_ID)
        assert result is False

    async def test_delete_dashboard_removes_widget_mappings(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that widget mappings are removed when dashboard is deleted."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Data",
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )
        assert widget is not None

        await store.delete_dashboard(dashboard.id, TEST_TENANT_ID)

        # Widget should not be updatable after dashboard deletion
        update_result = await store.update_widget(
            widget.id, WidgetUpdate(title="New"), TEST_TENANT_ID
        )
        assert update_result is None


class TestInMemoryDashboardStoreWidgetOperations:
    """Tests for widget CRUD operations."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_add_widget_to_dashboard(self, store: InMemoryDashboardStore) -> None:
        """Test adding a widget to a dashboard."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.BAR_CHART,
                title="Sales Chart",
                position=WidgetPosition(x=0, y=0, w=6, h=4),
                config=WidgetConfig(orientation="horizontal"),
            ),
            TEST_TENANT_ID,
        )

        assert widget is not None
        assert widget.id is not None
        assert widget.type == WidgetType.BAR_CHART
        assert widget.title == "Sales Chart"
        assert widget.config.orientation == "horizontal"

    async def test_add_widget_updates_dashboard(self, store: InMemoryDashboardStore) -> None:
        """Test that adding a widget updates the dashboard."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        original_updated = dashboard.updated_at

        await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Data",
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )

        updated_dashboard = await store.get_dashboard(dashboard.id, TEST_TENANT_ID)
        assert updated_dashboard is not None
        assert len(updated_dashboard.widgets) == 1
        assert updated_dashboard.updated_at > original_updated

    async def test_add_widget_to_nonexistent_dashboard_returns_none(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test adding widget to nonexistent dashboard returns None."""
        result = await store.add_widget(
            "nonexistent",
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Data",
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )
        assert result is None

    async def test_add_widget_with_query(self, store: InMemoryDashboardStore) -> None:
        """Test adding a widget with a query."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="amount", aggregation=AggregationType.SUM)
            ],
        )
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Total Revenue",
                query=query,
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            TEST_TENANT_ID,
        )

        assert widget is not None
        assert widget.query is not None
        assert widget.query.tables[0].name == "orders"

    async def test_update_widget(self, store: InMemoryDashboardStore) -> None:
        """Test updating a widget."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Original",
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )
        assert widget is not None

        updated = await store.update_widget(
            widget.id, WidgetUpdate(title="Updated"), TEST_TENANT_ID
        )

        assert updated is not None
        assert updated.title == "Updated"
        assert updated.updated_at > widget.updated_at

    async def test_update_widget_position(self, store: InMemoryDashboardStore) -> None:
        """Test updating widget position."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Data",
                position=WidgetPosition(x=0, y=0, w=6, h=4),
            ),
            TEST_TENANT_ID,
        )
        assert widget is not None

        updated = await store.update_widget(
            widget.id, WidgetUpdate(position=WidgetPosition(x=6, y=0, w=6, h=4)), TEST_TENANT_ID
        )

        assert updated is not None
        assert updated.position.x == 6

    async def test_update_nonexistent_widget_returns_none(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test updating nonexistent widget returns None."""
        result = await store.update_widget("nonexistent", WidgetUpdate(title="New"), TEST_TENANT_ID)
        assert result is None

    async def test_delete_widget(self, store: InMemoryDashboardStore) -> None:
        """Test deleting a widget."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Data",
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )
        assert widget is not None

        result = await store.delete_widget(widget.id, TEST_TENANT_ID)

        assert result is True
        updated_dashboard = await store.get_dashboard(dashboard.id, TEST_TENANT_ID)
        assert updated_dashboard is not None
        assert len(updated_dashboard.widgets) == 0

    async def test_delete_nonexistent_widget_returns_false(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test deleting nonexistent widget returns False."""
        result = await store.delete_widget("nonexistent", TEST_TENANT_ID)
        assert result is False

    async def test_duplicate_widget(self, store: InMemoryDashboardStore) -> None:
        """Test duplicating a widget."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        original = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.BAR_CHART,
                title="Chart",
                position=WidgetPosition(x=0, y=0, w=6, h=4),
                config=WidgetConfig(stacked=True),
            ),
            TEST_TENANT_ID,
        )
        assert original is not None

        duplicate = await store.duplicate_widget(original.id, TEST_TENANT_ID)

        assert duplicate is not None
        assert duplicate.id != original.id
        assert duplicate.title == "Chart (Copy)"
        assert duplicate.type == original.type
        assert duplicate.config.stacked is True
        assert duplicate.position.x == original.position.x + 1

    async def test_duplicate_widget_with_query(self, store: InMemoryDashboardStore) -> None:
        """Test duplicating a widget preserves query."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )
        original = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="Orders",
                query=query,
                position=WidgetPosition(x=0, y=0, w=12, h=6),
            ),
            TEST_TENANT_ID,
        )
        assert original is not None

        duplicate = await store.duplicate_widget(original.id, TEST_TENANT_ID)

        assert duplicate is not None
        assert duplicate.query is not None
        assert duplicate.query.tables[0].name == "orders"
        # Verify deep copy - modifying one shouldn't affect the other
        assert duplicate.query is not original.query

    async def test_duplicate_nonexistent_widget_returns_none(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test duplicating nonexistent widget returns None."""
        result = await store.duplicate_widget("nonexistent", TEST_TENANT_ID)
        assert result is None


class TestInMemoryDashboardStoreMultipleWidgets:
    """Tests for managing multiple widgets."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_add_multiple_widgets(self, store: InMemoryDashboardStore) -> None:
        """Test adding multiple widgets to a dashboard."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Metric 1",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            TEST_TENANT_ID,
        )
        await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Metric 2",
                position=WidgetPosition(x=3, y=0, w=3, h=2),
            ),
            TEST_TENANT_ID,
        )
        await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.BAR_CHART,
                title="Chart",
                position=WidgetPosition(x=0, y=2, w=12, h=4),
            ),
            TEST_TENANT_ID,
        )

        updated = await store.get_dashboard(dashboard.id, TEST_TENANT_ID)
        assert updated is not None
        assert len(updated.widgets) == 3

    async def test_delete_one_widget_preserves_others(self, store: InMemoryDashboardStore) -> None:
        """Test deleting one widget preserves the others."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        w1 = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Keep",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            TEST_TENANT_ID,
        )
        w2 = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Delete",
                position=WidgetPosition(x=3, y=0, w=3, h=2),
            ),
            TEST_TENANT_ID,
        )
        assert w1 is not None
        assert w2 is not None

        await store.delete_widget(w2.id, TEST_TENANT_ID)

        updated = await store.get_dashboard(dashboard.id, TEST_TENANT_ID)
        assert updated is not None
        assert len(updated.widgets) == 1
        assert updated.widgets[0].id == w1.id
