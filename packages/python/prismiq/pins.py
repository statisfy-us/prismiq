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
        id: Unique identifier for this pin (non-empty).
        dashboard_id: ID of the pinned dashboard (non-empty).
        context: Context where the dashboard is pinned (e.g., "accounts").
        position: Order position within the context (0-based, non-negative).
        pinned_at: When the dashboard was pinned.
    """

    id: str = Field(..., min_length=1)
    dashboard_id: str = Field(..., min_length=1)
    context: str = Field(..., min_length=1, max_length=100)
    position: int = Field(..., ge=0)
    pinned_at: datetime


class PinRequest(BaseModel):
    """Request to pin a dashboard to a context.

    Attributes:
        dashboard_id: ID of the dashboard to pin (non-empty).
        context: Context to pin to (e.g., "accounts", "dashboard").
        position: Optional position in the list (non-negative). If None, appends at end.
    """

    dashboard_id: str = Field(..., min_length=1)
    context: str = Field(..., min_length=1, max_length=100)
    position: int | None = Field(default=None, ge=0)


class UnpinRequest(BaseModel):
    """Request to unpin a dashboard from a context.

    Attributes:
        dashboard_id: ID of the dashboard to unpin (non-empty).
        context: Context to unpin from (1-100 characters).
    """

    dashboard_id: str = Field(..., min_length=1)
    context: str = Field(..., min_length=1, max_length=100)


class ReorderPinsRequest(BaseModel):
    """Request to reorder pinned dashboards in a context.

    Attributes:
        context: Context to reorder pins in.
        dashboard_ids: Ordered list of dashboard IDs (new order). Must not be empty.
    """

    context: str = Field(..., min_length=1, max_length=100)
    dashboard_ids: list[str] = Field(..., min_length=1)
