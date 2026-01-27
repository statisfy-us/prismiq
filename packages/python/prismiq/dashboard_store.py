"""Dashboard storage implementations for Prismiq.

This module provides the DashboardStore protocol and implementations for
storing and retrieving dashboards and widgets.
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
    WidgetPosition,
    WidgetUpdate,
)
from prismiq.pins import PinnedDashboard


def _utc_now() -> datetime:
    """Get current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


class DashboardStore(Protocol):
    """Abstract dashboard storage interface.

    Implementations can store dashboards in memory, database, or other
    backends. All operations are async to support different storage
    backends. All operations require tenant_id for multi-tenant
    isolation.
    """

    async def list_dashboards(self, tenant_id: str, owner_id: str | None = None) -> list[Dashboard]:
        """List all dashboards for a tenant, optionally filtered by owner.

        Args:
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID to filter by.

        Returns:
            List of dashboards.
        """
        ...

    async def get_dashboard(self, dashboard_id: str, tenant_id: str) -> Dashboard | None:
        """Get a dashboard by ID.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            The dashboard, or None if not found.
        """
        ...

    async def create_dashboard(
        self, dashboard: DashboardCreate, tenant_id: str, owner_id: str | None = None
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            dashboard: Dashboard creation data.
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID.

        Returns:
            The created dashboard with generated ID and timestamps.
        """
        ...

    async def update_dashboard(
        self, dashboard_id: str, update: DashboardUpdate, tenant_id: str
    ) -> Dashboard | None:
        """Update a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            update: Fields to update.
            tenant_id: Tenant ID for isolation.

        Returns:
            The updated dashboard, or None if not found.
        """
        ...

    async def delete_dashboard(self, dashboard_id: str, tenant_id: str) -> bool:
        """Delete a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if deleted, False if not found.
        """
        ...

    async def add_widget(
        self, dashboard_id: str, widget: WidgetCreate, tenant_id: str
    ) -> Widget | None:
        """Add a widget to a dashboard.

        Args:
            dashboard_id: The dashboard ID.
            widget: Widget creation data.
            tenant_id: Tenant ID for isolation.

        Returns:
            The created widget, or None if dashboard not found.
        """
        ...

    async def get_widget(self, widget_id: str, tenant_id: str) -> Widget | None:
        """Get a widget by ID.

        Args:
            widget_id: The widget ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            The widget, or None if not found.
        """
        ...

    async def update_widget(
        self, widget_id: str, update: WidgetUpdate, tenant_id: str
    ) -> Widget | None:
        """Update a widget.

        Args:
            widget_id: The widget ID.
            update: Fields to update.
            tenant_id: Tenant ID for isolation.

        Returns:
            The updated widget, or None if not found.
        """
        ...

    async def delete_widget(self, widget_id: str, tenant_id: str) -> bool:
        """Delete a widget.

        Args:
            widget_id: The widget ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if deleted, False if not found.
        """
        ...

    async def duplicate_widget(self, widget_id: str, tenant_id: str) -> Widget | None:
        """Duplicate a widget.

        Args:
            widget_id: The widget ID to duplicate.
            tenant_id: Tenant ID for isolation.

        Returns:
            The new duplicated widget, or None if not found.
        """
        ...

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, object]],
        tenant_id: str,
    ) -> bool:
        """Batch update widget positions.

        Args:
            dashboard_id: The dashboard ID.
            positions: List of position updates with widget_id and position.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if updated, False if dashboard not found.
        """
        ...

    # =========================================================================
    # Pin Operations
    # =========================================================================

    async def pin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
        position: int | None = None,
    ) -> PinnedDashboard:
        """Pin a dashboard to a context.

        Args:
            dashboard_id: The dashboard ID to pin.
            context: The context to pin to (e.g., "accounts", "dashboard").
            tenant_id: Tenant ID for isolation.
            user_id: User ID who is pinning.
            position: Optional position. If None, appends at end.

        Returns:
            The created PinnedDashboard entry.

        Raises:
            ValueError: If dashboard not found or already pinned to context.
        """
        ...

    async def unpin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Unpin a dashboard from a context.

        Args:
            dashboard_id: The dashboard ID to unpin.
            context: The context to unpin from.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pin.

        Returns:
            True if unpinned, False if pin not found.
        """
        ...

    async def get_pinned_dashboards(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> list[Dashboard]:
        """Get all dashboards pinned to a context.

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of Dashboard objects, ordered by position.
        """
        ...

    async def get_pin_contexts_for_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
        user_id: str,
    ) -> list[str]:
        """Get all contexts where a dashboard is pinned.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of context names where the dashboard is pinned.
        """
        ...

    async def reorder_pins(
        self,
        context: str,
        dashboard_ids: list[str],
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Reorder pinned dashboards in a context.

        Args:
            context: The context to reorder.
            dashboard_ids: Ordered list of dashboard IDs (new order).
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            True if reordered successfully, False otherwise.
        """
        ...

    async def is_dashboard_pinned(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Check if a dashboard is pinned to a context.

        Args:
            dashboard_id: The dashboard ID.
            context: The context to check.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            True if pinned, False otherwise.
        """
        ...

    async def get_pins_for_context(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> list[PinnedDashboard]:
        """Get pin entries for a context (for API responses).

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of PinnedDashboard entries, ordered by position.
        """
        ...


class InMemoryDashboardStore:
    """In-memory implementation of DashboardStore.

    Stores dashboards in a dict for testing and development.
    Thread-safe through asyncio locks.
    Tenant isolation is simulated via tenant_id stored on dashboards.

    Example:
        >>> store = InMemoryDashboardStore()
        >>> dashboard = await store.create_dashboard(
        ...     DashboardCreate(name="Sales Dashboard"),
        ...     tenant_id="tenant_123",
        ...     owner_id="user_123",
        ... )
        >>> widget = await store.add_widget(
        ...     dashboard.id,
        ...     WidgetCreate(type=WidgetType.TABLE, title="Data", position=...),
        ...     tenant_id="tenant_123",
        ... )
    """

    def __init__(self) -> None:
        """Initialize the in-memory store."""
        self._dashboards: dict[str, Dashboard] = {}
        self._dashboard_tenants: dict[str, str] = {}  # dashboard_id -> tenant_id
        self._widget_to_dashboard: dict[str, str] = {}
        # Pins storage: key = (tenant_id, user_id, context), value = list of PinnedDashboard
        self._pins: dict[tuple[str, str, str], list[PinnedDashboard]] = {}
        self._lock = asyncio.Lock()

    async def list_dashboards(self, tenant_id: str, owner_id: str | None = None) -> list[Dashboard]:
        """List all dashboards for a tenant, optionally filtered by owner.

        Args:
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID to filter by.

        Returns:
            List of dashboards (deep copies).
        """
        async with self._lock:
            # Filter by tenant
            dashboards = [
                d
                for d in self._dashboards.values()
                if self._dashboard_tenants.get(d.id) == tenant_id
            ]
            if owner_id is not None:
                dashboards = [
                    d
                    for d in dashboards
                    if d.owner_id == owner_id or d.is_public or owner_id in d.allowed_viewers
                ]
            # Return deep copies to prevent external mutation
            return [self._copy_dashboard(d) for d in dashboards]

    async def get_dashboard(self, dashboard_id: str, tenant_id: str) -> Dashboard | None:
        """Get a dashboard by ID with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            Deep copy of the dashboard, or None if not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
                return None
            return self._copy_dashboard(dashboard)

    async def create_dashboard(
        self, dashboard: DashboardCreate, tenant_id: str, owner_id: str | None = None
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            dashboard: Dashboard creation data.
            tenant_id: Tenant ID for isolation.
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
            self._dashboard_tenants[new_dashboard.id] = tenant_id
            return self._copy_dashboard(new_dashboard)

    async def update_dashboard(
        self, dashboard_id: str, update: DashboardUpdate, tenant_id: str
    ) -> Dashboard | None:
        """Update a dashboard with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            update: Fields to update.
            tenant_id: Tenant ID for isolation.

        Returns:
            The updated dashboard, or None if not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
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

    async def delete_dashboard(self, dashboard_id: str, tenant_id: str) -> bool:
        """Delete a dashboard with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if deleted, False if not found.
        """
        async with self._lock:
            if dashboard_id not in self._dashboards:
                return False
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
                return False

            # Remove widget mappings
            dashboard = self._dashboards[dashboard_id]
            for widget in dashboard.widgets:
                self._widget_to_dashboard.pop(widget.id, None)

            del self._dashboards[dashboard_id]
            del self._dashboard_tenants[dashboard_id]
            return True

    async def add_widget(
        self, dashboard_id: str, widget: WidgetCreate, tenant_id: str
    ) -> Widget | None:
        """Add a widget to a dashboard with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            widget: Widget creation data.
            tenant_id: Tenant ID for isolation.

        Returns:
            The created widget, or None if dashboard not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
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

    async def get_widget(self, widget_id: str, tenant_id: str) -> Widget | None:
        """Get a widget by ID with tenant check.

        Args:
            widget_id: The widget ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            The widget, or None if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
                return None

            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return None

            for widget in dashboard.widgets:
                if widget.id == widget_id:
                    return self._copy_widget(widget)
            return None

    async def update_widget(
        self, widget_id: str, update: WidgetUpdate, tenant_id: str
    ) -> Widget | None:
        """Update a widget with tenant check.

        Args:
            widget_id: The widget ID.
            update: Fields to update.
            tenant_id: Tenant ID for isolation.

        Returns:
            The updated widget, or None if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
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

    async def delete_widget(self, widget_id: str, tenant_id: str) -> bool:
        """Delete a widget with tenant check.

        Args:
            widget_id: The widget ID.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if deleted, False if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return False
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
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

    async def duplicate_widget(self, widget_id: str, tenant_id: str) -> Widget | None:
        """Duplicate a widget with tenant check.

        Args:
            widget_id: The widget ID to duplicate.
            tenant_id: Tenant ID for isolation.

        Returns:
            The new duplicated widget, or None if not found.
        """
        async with self._lock:
            dashboard_id = self._widget_to_dashboard.get(widget_id)
            if dashboard_id is None:
                return None
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
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

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, object]],
        tenant_id: str,
    ) -> bool:
        """Batch update widget positions with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            positions: List of position updates with widget_id and position.
            tenant_id: Tenant ID for isolation.

        Returns:
            True if updated, False if dashboard not found.
        """
        async with self._lock:
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None:
                return False
            # Check tenant ownership
            if self._dashboard_tenants.get(dashboard_id) != tenant_id:
                return False

            # Build a map of widget_id -> new position
            position_map: dict[str, WidgetPosition] = {}
            for pos in positions:
                widget_id = str(pos.get("widget_id") or pos.get("id", ""))
                position_data = pos.get("position", pos)
                if isinstance(position_data, dict):
                    position_map[widget_id] = WidgetPosition(
                        x=int(position_data.get("x", 0)),  # type: ignore[arg-type]
                        y=int(position_data.get("y", 0)),  # type: ignore[arg-type]
                        w=int(position_data.get("w", 4)),  # type: ignore[arg-type]
                        h=int(position_data.get("h", 3)),  # type: ignore[arg-type]
                    )

            # Update widgets with new positions
            now = _utc_now()
            new_widgets: list[Widget] = []
            for widget in dashboard.widgets:
                if widget.id in position_map:
                    updated = widget.model_copy(
                        update={"position": position_map[widget.id], "updated_at": now}
                    )
                    new_widgets.append(updated)
                else:
                    new_widgets.append(widget)

            # Update dashboard
            updated_dashboard = dashboard.model_copy(
                update={"widgets": new_widgets, "updated_at": now}
            )
            self._dashboards[dashboard_id] = updated_dashboard
            return True

    def _copy_dashboard(self, dashboard: Dashboard) -> Dashboard:
        """Create a deep copy of a dashboard."""
        return Dashboard.model_validate(dashboard.model_dump())

    def _copy_widget(self, widget: Widget) -> Widget:
        """Create a deep copy of a widget."""
        return Widget.model_validate(widget.model_dump())

    # =========================================================================
    # Pin Operations
    # =========================================================================

    async def pin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
        position: int | None = None,
    ) -> PinnedDashboard:
        """Pin a dashboard to a context.

        Args:
            dashboard_id: The dashboard ID to pin.
            context: The context to pin to.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who is pinning.
            position: Optional position. If None, appends at end.

        Returns:
            The created PinnedDashboard entry.

        Raises:
            ValueError: If dashboard not found or already pinned.
        """
        async with self._lock:
            # Verify dashboard exists and belongs to tenant
            dashboard = self._dashboards.get(dashboard_id)
            if dashboard is None or self._dashboard_tenants.get(dashboard_id) != tenant_id:
                raise ValueError(f"Dashboard '{dashboard_id}' not found")

            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])

            # Check if already pinned
            for pin in pins:
                if pin.dashboard_id == dashboard_id:
                    raise ValueError(
                        f"Dashboard '{dashboard_id}' already pinned to context '{context}'"
                    )

            # Determine position
            position = len(pins) if position is None else max(0, min(position, len(pins)))

            # Create pin
            now = _utc_now()
            pin = PinnedDashboard(
                id=str(uuid.uuid4()),
                dashboard_id=dashboard_id,
                context=context,
                position=position,
                pinned_at=now,
            )

            # Insert at position and reorder
            pins.insert(position, pin)
            for i, p in enumerate(pins):
                if p.id != pin.id:
                    pins[i] = PinnedDashboard(
                        id=p.id,
                        dashboard_id=p.dashboard_id,
                        context=p.context,
                        position=i,
                        pinned_at=p.pinned_at,
                    )

            self._pins[key] = pins
            return pin

    async def unpin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Unpin a dashboard from a context.

        Args:
            dashboard_id: The dashboard ID to unpin.
            context: The context to unpin from.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pin.

        Returns:
            True if unpinned, False if not found.
        """
        async with self._lock:
            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])

            # Find and remove the pin
            new_pins = [p for p in pins if p.dashboard_id != dashboard_id]
            if len(new_pins) == len(pins):
                return False

            # Reorder remaining pins
            for i, p in enumerate(new_pins):
                new_pins[i] = PinnedDashboard(
                    id=p.id,
                    dashboard_id=p.dashboard_id,
                    context=p.context,
                    position=i,
                    pinned_at=p.pinned_at,
                )

            self._pins[key] = new_pins
            return True

    async def get_pinned_dashboards(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> list[Dashboard]:
        """Get all dashboards pinned to a context.

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of Dashboard objects, ordered by position.
        """
        async with self._lock:
            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])

            # Sort by position and fetch dashboards
            sorted_pins = sorted(pins, key=lambda p: p.position)
            dashboards: list[Dashboard] = []

            for pin in sorted_pins:
                dashboard = self._dashboards.get(pin.dashboard_id)
                if dashboard is not None:
                    dashboards.append(self._copy_dashboard(dashboard))

            return dashboards

    async def get_pin_contexts_for_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
        user_id: str,
    ) -> list[str]:
        """Get all contexts where a dashboard is pinned.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of context names.
        """
        async with self._lock:
            contexts: list[str] = []

            for (t_id, u_id, ctx), pins in self._pins.items():
                if t_id == tenant_id and u_id == user_id:
                    for pin in pins:
                        if pin.dashboard_id == dashboard_id:
                            contexts.append(ctx)
                            break

            return contexts

    async def reorder_pins(
        self,
        context: str,
        dashboard_ids: list[str],
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Reorder pinned dashboards in a context.

        Args:
            context: The context to reorder.
            dashboard_ids: Ordered list of dashboard IDs.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            True if reordered, False otherwise.
        """
        async with self._lock:
            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])

            if not pins:
                return False

            # Build map of dashboard_id -> pin
            pin_map = {p.dashboard_id: p for p in pins}

            # Reorder based on dashboard_ids
            new_pins: list[PinnedDashboard] = []
            for i, d_id in enumerate(dashboard_ids):
                if d_id in pin_map:
                    old_pin = pin_map[d_id]
                    new_pins.append(
                        PinnedDashboard(
                            id=old_pin.id,
                            dashboard_id=old_pin.dashboard_id,
                            context=old_pin.context,
                            position=i,
                            pinned_at=old_pin.pinned_at,
                        )
                    )

            # Add any pins not in dashboard_ids at the end
            for d_id, pin in pin_map.items():
                if d_id not in dashboard_ids:
                    new_pins.append(
                        PinnedDashboard(
                            id=pin.id,
                            dashboard_id=pin.dashboard_id,
                            context=pin.context,
                            position=len(new_pins),
                            pinned_at=pin.pinned_at,
                        )
                    )

            self._pins[key] = new_pins
            return True

    async def is_dashboard_pinned(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> bool:
        """Check if a dashboard is pinned to a context.

        Args:
            dashboard_id: The dashboard ID.
            context: The context to check.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            True if pinned, False otherwise.
        """
        async with self._lock:
            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])

            return any(pin.dashboard_id == dashboard_id for pin in pins)

    async def get_pins_for_context(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
    ) -> list[PinnedDashboard]:
        """Get pin entries for a context (for API responses).

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.

        Returns:
            List of PinnedDashboard entries, ordered by position.
        """
        async with self._lock:
            key = (tenant_id, user_id, context)
            pins = self._pins.get(key, [])
            return sorted(pins, key=lambda p: p.position)
