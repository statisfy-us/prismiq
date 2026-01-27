"""Pydantic models for dashboard pinning functionality.

Pins allow users to save dashboards to system-defined contexts
(e.g., "dashboard", "accounts", "home") for quick access in different
areas of the embedding application.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class PinnedDashboard(BaseModel):
    """A pinned dashboard entry.

    Attributes:
        id: Unique identifier for this pin.
        dashboard_id: ID of the pinned dashboard.
        context: Context where the dashboard is pinned (e.g., "accounts").
        position: Order position within the context (0-based).
        pinned_at: When the dashboard was pinned.
    """

    id: str
    dashboard_id: str
    context: str
    position: int
    pinned_at: datetime


class PinRequest(BaseModel):
    """Request to pin a dashboard to a context.

    Attributes:
        dashboard_id: ID of the dashboard to pin.
        context: Context to pin to (e.g., "accounts", "dashboard").
        position: Optional position in the list. If None, appends at end.
    """

    dashboard_id: str
    context: str = Field(..., min_length=1, max_length=100)
    position: int | None = None


class UnpinRequest(BaseModel):
    """Request to unpin a dashboard from a context.

    Attributes:
        dashboard_id: ID of the dashboard to unpin.
        context: Context to unpin from.
    """

    dashboard_id: str
    context: str


class ReorderPinsRequest(BaseModel):
    """Request to reorder pinned dashboards in a context.

    Attributes:
        context: Context to reorder pins in.
        dashboard_ids: Ordered list of dashboard IDs (new order).
    """

    context: str
    dashboard_ids: list[str]
