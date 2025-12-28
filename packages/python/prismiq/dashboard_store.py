"""
Dashboard storage implementations for Prismiq.

This module provides the DashboardStore protocol and implementations
for storing and retrieving dashboards and widgets.
"""

from __future__ import annotations

import asyncio
import copy
import uuid
from datetime import datetime, timezone
from typing import Protocol

from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardLayout,
    DashboardUpdate,
    Widget,
    WidgetConfig,
    WidgetCreate,
    WidgetUpdate,
)


def _utc_now() -> datetime:
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


class DashboardStore(Protocol):
    """Abstract dashboard storage interface.

    Implementations can store dashboards in memory, database, or other backends.
    All operations are async to support different storage backends.
    """

    async def list_dashboards(self, owner_id: str | None = None) -> list[Dashboard]:
        """List all dashboards, optionally filtered by owner.

        Args:
            owner_id: Optional owner ID to filter by.

        Returns:
            List of dashboards.
        """
        ...

    async def get_dashboard(self, dashboard_id: str) -> Dashboard | None:
        """Get a dashboard by ID.

        Args:
            dashboard_id: The dashboard ID.

        Returns:
            The dashboard, or None if not found.
        """
        ...

    async def create_dashboard(
        self, dashboard: DashboardCreate, owner_id: str | None = None
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            dashboard: Dashboard creation data.
            owner_id: Optional owner ID.

        Returns:
            The created dashboard with generated ID and timestamps.
        """
        ...

    async def update_dashboard(
        self, dashboard_id: str, update: DashboardUpdate
    ) -> Dashboard | None:
        """Update a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            update: Fields to update.

        Returns:
            The updated dashboard, or None if not found.
        """
        ...

    async def delete_dashboard(self, dashboard_id: str) -> bool:
        """Delete a dashboard.

        Args:
            dashboard_id: The dashboard ID.

        Returns:
            True if deleted, False if not found.
        """
        ...

    async def add_widget(self, dashboard_id: str, widget: WidgetCreate) -> Widget | None:
        """Add a widget to a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            widget: Widget creation data.

        Returns:
            The created widget, or None if dashboard not found.
        """
        ...

    async def update_widget(self, widget_id: str, update: WidgetUpdate) -> Widget | None:
        """Update a widget.

        Args:
            widget_id: The widget ID.
            update: Fields to update.

        Returns:
            The updated widget, or None if not found.
        """
        ...

    async def delete_widget(self, widget_id: str) -> bool:
        """Delete a widget.

        Args:
            widget_id: The widget ID.

        Returns:
            True if deleted, False if not found.
        """
        ...

    async def duplicate_widget(self, widget_id: str) -> Widget | None:
        """Duplicate a widget.

        Args:
            widget_id: The widget ID to duplicate.

        Returns:
            The new duplicated widget, or None if not found.
        """
        ...


class InMemoryDashboardStore:
    """In-memory implementation of DashboardStore.

    Stores dashboards in a dict for testing and development.
    Thread-safe through asyncio locks.

    Example:
        >>> store = InMemoryDashboardStore()
        >>> dashboard = await store.create_dashboard(
        ...     DashboardCreate(name="Sales Dashboard"),
        ...     owner_id="user_123",
        ... )
        >>> widget = await store.add_widget(
        ...     dashboard.id,
        ...     WidgetCreate(type=WidgetType.TABLE, title="Data", position=...),
        ... )
    """

    def __init__(self) -> None:
        """Initialize the in-memory store."""
        self._dashboards: dict[str, Dashboard] = {}
        self._widget_to_dashboard: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def list_dashboards(self, owner_id: str | None = None) -> list[Dashboard]:
        """List all dashboards, optionally filtered by owner.

        Args:
            owner_id: Optional owner ID to filter by.

        Returns:
            List of dashboards (deep copies).
        """
        async with self._lock:
            dashboards = list(self._dashboards.values())
            if owner_id is not None:
                dashboards = [d for d in dashboards if d.owner_id == owner_id]
            # Return deep copies to prevent external mutation
            return [self._copy_dashboard(d) for d in dashboards]

    async def get_dashboard(self, dashboard_id: str) -> Dashboard | None:
        """Get a dashboard by ID.

        Args:
            dashboard_id: The dashboard ID.

        Returns:
            Deep copy of the dashboard, or None if not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None
            return self._copy_dashboard(dashboard)

    async def create_dashboard(
        self, dashboard: DashboardCreate, owner_id: str | None = None
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            dashboard: Dashboard creation data.
            owner_id: Optional owner ID.

        Returns:
            The created dashboard with generated ID and timestamps.
        """
        async with self._lock:
            now = _utc_now()
            new_dashboard = Dashboard(
                id=str(uuid.uuid4()),
                name=dashboard.name,
                description=dashboard.description,
                layout=dashboard.layout if dashboard.layout else DashboardLayout(),
                widgets=[],
                filters=[],
                owner_id=owner_id,
                created_at=now,
                updated_at=now,
                is_public=False,
                allowed_viewers=[],
            )
            self._dashboards[new_dashboard.id] = new_dashboard
            return self._copy_dashboard(new_dashboard)

    async def update_dashboard(
        self, dashboard_id: str, update: DashboardUpdate
    ) -> Dashboard | None:
        """Update a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            update: Fields to update.

        Returns:
            The updated dashboard, or None if not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None

            # Build update data
            update_data: dict[str, object] = {"updated_at": _utc_now()}
            if update.name is not None:
                update_data["name"] = update.name
            if update.description is not None:
                update_data["description"] = update.description
            if update.layout is not None:
                update_data["layout"] = update.layout
            if update.filters is not None:
                update_data["filters"] = update.filters
            if update.is_public is not None:
                update_data["is_public"] = update.is_public
            if update.allowed_viewers is not None:
                update_data["allowed_viewers"] = update.allowed_viewers

            # Create updated dashboard
            updated = dashboard.model_copy(update=update_data)
            self._dashboards[dashboard_id] = updated
            return self._copy_dashboard(updated)

    async def delete_dashboard(self, dashboard_id: str) -> bool:
        """Delete a dashboard.

        Args:
            dashboard_id: The dashboard ID.

        Returns:
            True if deleted, False if not found.
        """
        async with self._lock:
            if dashboard_id not in self._dashboards:
                return False

            # Remove widget mappings
            dashboard = self._dashboards[dashboard_id]
            for widget in dashboard.widgets:
                self._widget_to_dashboard.pop(widget.id, None)

            del self._dashboards[dashboard_id]
            return True

    async def add_widget(self, dashboard_id: str, widget: WidgetCreate) -> Widget | None:
        """Add a widget to a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            widget: Widget creation data.

        Returns:
            The created widget, or None if dashboard not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None

            now = _utc_now()
            new_widget = Widget(
                id=str(uuid.uuid4()),
                type=widget.type,
                title=widget.title,
                query=widget.query,
                position=widget.position,
                config=widget.config if widget.config else WidgetConfig(),
                created_at=now,
                updated_at=now,
            )

            # Update dashboard with new widget
            new_widgets = [*list(dashboard.widgets), new_widget]
            updated_dashboard = dashboard.model_copy(
                update={"widgets": new_widgets, "updated_at": now}
            )
            self._dashboards[dashboard_id] = updated_dashboard

            # Track widget-to-dashboard mapping
            self._widget_to_dashboard[new_widget.id] = dashboard_id

            return self._copy_widget(new_widget)

    async def update_widget(self, widget_id: str, update: WidgetUpdate) -> Widget | None:
        """Update a widget.

        Args:
            widget_id: The widget ID.
            update: Fields to update.

        Returns:
            The updated widget, or None if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return None

            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None

            # Find and update widget
            now = _utc_now()
            updated_widget: Widget | None = None
            new_widgets: list[Widget] = []

            for widget in dashboard.widgets:
                if widget.id == widget_id:
                    update_data: dict[str, object] = {"updated_at": now}
                    if update.title is not None:
                        update_data["title"] = update.title
                    if update.query is not None:
                        update_data["query"] = update.query
                    if update.position is not None:
                        update_data["position"] = update.position
                    if update.config is not None:
                        update_data["config"] = update.config

                    updated_widget = widget.model_copy(update=update_data)
                    new_widgets.append(updated_widget)
                else:
                    new_widgets.append(widget)

            if updated_widget is None:
                return None

            # Update dashboard
            updated_dashboard = dashboard.model_copy(
                update={"widgets": new_widgets, "updated_at": now}
            )
            self._dashboards[dashboard_id] = updated_dashboard

            return self._copy_widget(updated_widget)

    async def delete_widget(self, widget_id: str) -> bool:
        """Delete a widget.

        Args:
            widget_id: The widget ID.

        Returns:
            True if deleted, False if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return False

            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return False

            # Remove widget from list
            new_widgets = [w for w in dashboard.widgets if w.id != widget_id]
            if len(new_widgets) == len(dashboard.widgets):
                return False  # Widget not found in dashboard

            # Update dashboard
            now = _utc_now()
            updated_dashboard = dashboard.model_copy(
                update={"widgets": new_widgets, "updated_at": now}
            )
            self._dashboards[dashboard_id] = updated_dashboard

            # Remove mapping
            del self._widget_to_dashboard[widget_id]
            return True

    async def duplicate_widget(self, widget_id: str) -> Widget | None:
        """Duplicate a widget.

        Args:
            widget_id: The widget ID to duplicate.

        Returns:
            The new duplicated widget, or None if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return None

            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None

            # Find widget to duplicate
            original_widget: Widget | None = None
            for widget in dashboard.widgets:
                if widget.id == widget_id:
                    original_widget = widget
                    break

            if original_widget is None:
                return None

            # Create duplicate with new ID and timestamps
            now = _utc_now()
            new_widget = Widget(
                id=str(uuid.uuid4()),
                type=original_widget.type,
                title=f"{original_widget.title} (Copy)",
                query=copy.deepcopy(original_widget.query) if original_widget.query else None,
                position=original_widget.position.model_copy(
                    update={"x": original_widget.position.x + 1}
                ),
                config=original_widget.config.model_copy(),
                created_at=now,
                updated_at=now,
            )

            # Add to dashboard
            new_widgets = [*list(dashboard.widgets), new_widget]
            updated_dashboard = dashboard.model_copy(
                update={"widgets": new_widgets, "updated_at": now}
            )
            self._dashboards[dashboard_id] = updated_dashboard

            # Track mapping
            self._widget_to_dashboard[new_widget.id] = dashboard_id

            return self._copy_widget(new_widget)

    def _copy_dashboard(self, dashboard: Dashboard) -> Dashboard:
        """Create a deep copy of a dashboard."""
        return Dashboard.model_validate(dashboard.model_dump())

    def _copy_widget(self, widget: Widget) -> Widget:
        """Create a deep copy of a widget."""
        return Widget.model_validate(widget.model_dump())
