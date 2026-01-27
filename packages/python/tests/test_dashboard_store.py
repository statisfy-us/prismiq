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


# ============================================================================
# Pin Operations Tests
# ============================================================================

TEST_USER_ID = "test_user"


class TestInMemoryDashboardStorePinDashboard:
    """Tests for pinning dashboards to contexts."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_pin_dashboard_success(self, store: InMemoryDashboardStore) -> None:
        """Test pinning a dashboard to a context."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Test Dashboard"), TEST_TENANT_ID
        )
        pin = await store.pin_dashboard(dashboard.id, "favorites", TEST_TENANT_ID, TEST_USER_ID)

        assert pin is not None
        assert pin.id is not None
        assert pin.dashboard_id == dashboard.id
        assert pin.context == "favorites"
        assert pin.position == 0
        assert pin.pinned_at is not None

    async def test_pin_dashboard_appends_at_end(self, store: InMemoryDashboardStore) -> None:
        """Test that pinning without position appends at end."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        pin1 = await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        pin2 = await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        pin3 = await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        assert pin1.position == 0
        assert pin2.position == 1
        assert pin3.position == 2

    async def test_pin_dashboard_with_explicit_position(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test pinning at a specific position reorders existing pins."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        # Pin d3 at position 1 (between d1 and d2)
        pin3 = await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID, position=1)

        assert pin3.position == 1

        # Verify order
        pins = await store.get_pins_for_context("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert pins[0].dashboard_id == d1.id
        assert pins[1].dashboard_id == d3.id
        assert pins[2].dashboard_id == d2.id

    async def test_pin_dashboard_duplicate_raises_error(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that pinning same dashboard twice raises ValueError."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        with pytest.raises(ValueError, match="already pinned"):
            await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

    async def test_pin_nonexistent_dashboard_raises_error(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that pinning nonexistent dashboard raises ValueError."""
        with pytest.raises(ValueError, match="not found"):
            await store.pin_dashboard("nonexistent", "ctx", TEST_TENANT_ID, TEST_USER_ID)

    async def test_pin_dashboard_to_multiple_contexts(self, store: InMemoryDashboardStore) -> None:
        """Test pinning same dashboard to multiple contexts."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        pin1 = await store.pin_dashboard(dashboard.id, "ctx1", TEST_TENANT_ID, TEST_USER_ID)
        pin2 = await store.pin_dashboard(dashboard.id, "ctx2", TEST_TENANT_ID, TEST_USER_ID)

        assert pin1.context == "ctx1"
        assert pin2.context == "ctx2"

        contexts = await store.get_pin_contexts_for_dashboard(
            dashboard.id, TEST_TENANT_ID, TEST_USER_ID
        )
        assert set(contexts) == {"ctx1", "ctx2"}


class TestInMemoryDashboardStoreUnpinDashboard:
    """Tests for unpinning dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_unpin_dashboard_success(self, store: InMemoryDashboardStore) -> None:
        """Test unpinning a dashboard from a context."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        result = await store.unpin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        assert result is True
        is_pinned = await store.is_dashboard_pinned(
            dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID
        )
        assert is_pinned is False

    async def test_unpin_nonexistent_pin_returns_false(self, store: InMemoryDashboardStore) -> None:
        """Test unpinning a dashboard that is not pinned returns False."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        result = await store.unpin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        assert result is False

    async def test_unpin_reorders_remaining_pins(self, store: InMemoryDashboardStore) -> None:
        """Test that unpinning reorders remaining pins."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        # Unpin d2 (position 1)
        await store.unpin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        # d3 should now be at position 1
        pins = await store.get_pins_for_context("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert len(pins) == 2
        assert pins[0].dashboard_id == d1.id
        assert pins[0].position == 0
        assert pins[1].dashboard_id == d3.id
        assert pins[1].position == 1


class TestInMemoryDashboardStoreGetPinnedDashboards:
    """Tests for getting pinned dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_get_pinned_dashboards_empty(self, store: InMemoryDashboardStore) -> None:
        """Test getting pinned dashboards when none exist."""
        dashboards = await store.get_pinned_dashboards("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert dashboards == []

    async def test_get_pinned_dashboards_ordered(self, store: InMemoryDashboardStore) -> None:
        """Test that pinned dashboards are returned in position order."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        dashboards = await store.get_pinned_dashboards("ctx", TEST_TENANT_ID, TEST_USER_ID)

        assert len(dashboards) == 3
        assert dashboards[0].id == d1.id
        assert dashboards[1].id == d2.id
        assert dashboards[2].id == d3.id

    async def test_get_pinned_dashboards_excludes_deleted(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that deleted dashboards are excluded from pinned list."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        # Delete d1
        await store.delete_dashboard(d1.id, TEST_TENANT_ID)

        dashboards = await store.get_pinned_dashboards("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert len(dashboards) == 1
        assert dashboards[0].id == d2.id


class TestInMemoryDashboardStoreReorderPins:
    """Tests for reordering pinned dashboards."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_reorder_pins_success(self, store: InMemoryDashboardStore) -> None:
        """Test reordering pinned dashboards."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        # Reorder: d3, d1, d2
        result = await store.reorder_pins(
            "ctx", [d3.id, d1.id, d2.id], TEST_TENANT_ID, TEST_USER_ID
        )

        assert result is True

        pins = await store.get_pins_for_context("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert pins[0].dashboard_id == d3.id
        assert pins[1].dashboard_id == d1.id
        assert pins[2].dashboard_id == d2.id

    async def test_reorder_empty_context_returns_false(self, store: InMemoryDashboardStore) -> None:
        """Test reordering empty context returns False."""
        result = await store.reorder_pins("ctx", ["some_id"], TEST_TENANT_ID, TEST_USER_ID)
        assert result is False

    async def test_reorder_partial_list_preserves_unlisted(
        self, store: InMemoryDashboardStore
    ) -> None:
        """Test that reordering with partial list preserves unlisted pins at end."""
        d1 = await store.create_dashboard(DashboardCreate(name="D1"), TEST_TENANT_ID)
        d2 = await store.create_dashboard(DashboardCreate(name="D2"), TEST_TENANT_ID)
        d3 = await store.create_dashboard(DashboardCreate(name="D3"), TEST_TENANT_ID)

        await store.pin_dashboard(d1.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d2.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(d3.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        # Only reorder d2 to first - d1 and d3 should be added at end
        result = await store.reorder_pins("ctx", [d2.id], TEST_TENANT_ID, TEST_USER_ID)

        assert result is True

        pins = await store.get_pins_for_context("ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert len(pins) == 3
        assert pins[0].dashboard_id == d2.id


class TestInMemoryDashboardStoreIsDashboardPinned:
    """Tests for checking pin status."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_is_pinned_true(self, store: InMemoryDashboardStore) -> None:
        """Test is_dashboard_pinned returns True when pinned."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)

        result = await store.is_dashboard_pinned(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert result is True

    async def test_is_pinned_false(self, store: InMemoryDashboardStore) -> None:
        """Test is_dashboard_pinned returns False when not pinned."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        result = await store.is_dashboard_pinned(dashboard.id, "ctx", TEST_TENANT_ID, TEST_USER_ID)
        assert result is False

    async def test_is_pinned_different_context(self, store: InMemoryDashboardStore) -> None:
        """Test is_dashboard_pinned returns False for different context."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        await store.pin_dashboard(dashboard.id, "ctx1", TEST_TENANT_ID, TEST_USER_ID)

        result = await store.is_dashboard_pinned(dashboard.id, "ctx2", TEST_TENANT_ID, TEST_USER_ID)
        assert result is False


class TestInMemoryDashboardStorePinContextsForDashboard:
    """Tests for getting pin contexts for a dashboard."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_get_pin_contexts_empty(self, store: InMemoryDashboardStore) -> None:
        """Test getting contexts when dashboard is not pinned anywhere."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        contexts = await store.get_pin_contexts_for_dashboard(
            dashboard.id, TEST_TENANT_ID, TEST_USER_ID
        )
        assert contexts == []

    async def test_get_pin_contexts_multiple(self, store: InMemoryDashboardStore) -> None:
        """Test getting multiple contexts for a dashboard."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)
        await store.pin_dashboard(dashboard.id, "favorites", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(dashboard.id, "homepage", TEST_TENANT_ID, TEST_USER_ID)
        await store.pin_dashboard(dashboard.id, "reports", TEST_TENANT_ID, TEST_USER_ID)

        contexts = await store.get_pin_contexts_for_dashboard(
            dashboard.id, TEST_TENANT_ID, TEST_USER_ID
        )
        assert set(contexts) == {"favorites", "homepage", "reports"}


class TestInMemoryDashboardStorePinUserIsolation:
    """Tests for pin isolation between users."""

    @pytest.fixture
    def store(self) -> InMemoryDashboardStore:
        """Create a fresh store for each test."""
        return InMemoryDashboardStore()

    async def test_pins_isolated_between_users(self, store: InMemoryDashboardStore) -> None:
        """Test that pins are isolated between different users."""
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), TEST_TENANT_ID)

        # User 1 pins the dashboard
        await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, "user_1")

        # User 2 should not see user 1's pin
        user2_pinned = await store.is_dashboard_pinned(
            dashboard.id, "ctx", TEST_TENANT_ID, "user_2"
        )
        assert user2_pinned is False

        # User 2 can pin the same dashboard
        pin = await store.pin_dashboard(dashboard.id, "ctx", TEST_TENANT_ID, "user_2")
        assert pin is not None

        # Each user sees their own pins
        user1_dashboards = await store.get_pinned_dashboards("ctx", TEST_TENANT_ID, "user_1")
        user2_dashboards = await store.get_pinned_dashboards("ctx", TEST_TENANT_ID, "user_2")

        assert len(user1_dashboards) == 1
        assert len(user2_dashboards) == 1

    async def test_pins_isolated_between_tenants(self, store: InMemoryDashboardStore) -> None:
        """Test that pins are isolated between different tenants."""
        # Create dashboard in tenant_1
        dashboard = await store.create_dashboard(DashboardCreate(name="Test"), "tenant_1")
        await store.pin_dashboard(dashboard.id, "ctx", "tenant_1", TEST_USER_ID)

        # Tenant_2 should not see tenant_1's pins
        tenant2_dashboards = await store.get_pinned_dashboards("ctx", "tenant_2", TEST_USER_ID)
        assert tenant2_dashboards == []
