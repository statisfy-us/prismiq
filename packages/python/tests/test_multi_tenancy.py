"""Tests for multi-tenant isolation and permissions."""

from __future__ import annotations

import dataclasses
from typing import ClassVar

import pytest

from prismiq.auth import AuthContext, SimpleAuthContext, create_header_auth_dependency
from prismiq.dashboards import Dashboard, DashboardLayout
from prismiq.permissions import (
    can_delete_dashboard,
    can_edit_dashboard,
    can_edit_widget,
    can_view_dashboard,
)

# ============================================================================
# Auth Tests
# ============================================================================


class TestSimpleAuthContext:
    """Tests for SimpleAuthContext dataclass."""

    def test_create_with_tenant_only(self) -> None:
        """Create context with just tenant_id."""
        auth = SimpleAuthContext(tenant_id="tenant-123")
        assert auth.tenant_id == "tenant-123"
        assert auth.user_id is None
        assert auth.email is None
        assert auth.roles is None

    def test_create_with_all_fields(self) -> None:
        """Create context with all fields."""
        auth = SimpleAuthContext(
            tenant_id="tenant-123",
            user_id="user-456",
            email="user@example.com",
            roles=["admin", "editor"],
        )
        assert auth.tenant_id == "tenant-123"
        assert auth.user_id == "user-456"
        assert auth.email == "user@example.com"
        assert auth.roles == ["admin", "editor"]

    def test_frozen_dataclass(self) -> None:
        """Verify context is immutable."""
        auth = SimpleAuthContext(tenant_id="tenant-123")
        with pytest.raises(dataclasses.FrozenInstanceError):
            auth.tenant_id = "different"  # type: ignore

    def test_implements_protocol(self) -> None:
        """SimpleAuthContext satisfies AuthContext protocol."""
        auth = SimpleAuthContext(tenant_id="t", user_id="u")
        # Use isinstance with runtime_checkable protocol
        assert isinstance(auth, AuthContext)


class TestHeaderAuthDependency:
    """Tests for create_header_auth_dependency factory."""

    @pytest.mark.asyncio
    async def test_extracts_tenant_id(self) -> None:
        """Extracts X-Tenant-ID from request headers."""

        class MockRequest:
            headers: ClassVar[dict[str, str]] = {"X-Tenant-ID": "tenant-abc"}

        get_auth = create_header_auth_dependency()
        auth = await get_auth(MockRequest())  # type: ignore
        assert auth.tenant_id == "tenant-abc"
        assert auth.user_id is None

    @pytest.mark.asyncio
    async def test_extracts_both_headers(self) -> None:
        """Extracts both X-Tenant-ID and X-User-ID."""

        class MockRequest:
            headers: ClassVar[dict[str, str]] = {
                "X-Tenant-ID": "tenant-abc",
                "X-User-ID": "user-xyz",
            }

        get_auth = create_header_auth_dependency()
        auth = await get_auth(MockRequest())  # type: ignore
        assert auth.tenant_id == "tenant-abc"
        assert auth.user_id == "user-xyz"

    @pytest.mark.asyncio
    async def test_missing_tenant_id_raises(self) -> None:
        """Missing X-Tenant-ID header raises HTTPException."""
        from fastapi import HTTPException

        class MockRequest:
            headers: ClassVar[dict[str, str]] = {}

        get_auth = create_header_auth_dependency()
        with pytest.raises(HTTPException) as exc_info:
            await get_auth(MockRequest())  # type: ignore
        assert exc_info.value.status_code == 400
        assert "X-Tenant-ID" in exc_info.value.detail


# ============================================================================
# Permission Tests
# ============================================================================


@pytest.fixture
def sample_dashboard() -> Dashboard:
    """Create a sample dashboard for testing."""
    return Dashboard(
        id="dash-1",
        name="Test Dashboard",
        owner_id="owner-123",
        is_public=False,
        allowed_viewers=[],
        widgets=[],
        filters=[],
        layout=DashboardLayout(),
    )


class TestCanViewDashboard:
    """Tests for can_view_dashboard permission function."""

    def test_public_dashboard_viewable_by_anyone(self, sample_dashboard: Dashboard) -> None:
        """Public dashboards can be viewed by anyone."""
        sample_dashboard.is_public = True
        assert can_view_dashboard(sample_dashboard, None) is True
        assert can_view_dashboard(sample_dashboard, "random-user") is True

    def test_private_dashboard_not_viewable_by_anonymous(self, sample_dashboard: Dashboard) -> None:
        """Private dashboards cannot be viewed by anonymous users."""
        assert can_view_dashboard(sample_dashboard, None) is False

    def test_owner_can_view(self, sample_dashboard: Dashboard) -> None:
        """Dashboard owner can always view."""
        assert can_view_dashboard(sample_dashboard, "owner-123") is True

    def test_allowed_viewer_can_view(self, sample_dashboard: Dashboard) -> None:
        """Users in allowed_viewers list can view."""
        sample_dashboard.allowed_viewers = ["viewer-1", "viewer-2"]
        assert can_view_dashboard(sample_dashboard, "viewer-1") is True
        assert can_view_dashboard(sample_dashboard, "viewer-2") is True

    def test_non_allowed_viewer_cannot_view(self, sample_dashboard: Dashboard) -> None:
        """Users not in allowed_viewers list cannot view private dashboard."""
        sample_dashboard.allowed_viewers = ["viewer-1"]
        assert can_view_dashboard(sample_dashboard, "random-user") is False


class TestCanEditDashboard:
    """Tests for can_edit_dashboard permission function."""

    def test_owner_can_edit(self, sample_dashboard: Dashboard) -> None:
        """Dashboard owner can edit."""
        assert can_edit_dashboard(sample_dashboard, "owner-123") is True

    def test_anonymous_cannot_edit(self, sample_dashboard: Dashboard) -> None:
        """Anonymous users cannot edit."""
        assert can_edit_dashboard(sample_dashboard, None) is False

    def test_non_owner_cannot_edit(self, sample_dashboard: Dashboard) -> None:
        """Non-owners cannot edit, even if in allowed_viewers."""
        sample_dashboard.allowed_viewers = ["viewer-1"]
        assert can_edit_dashboard(sample_dashboard, "viewer-1") is False

    def test_non_owner_cannot_edit_public(self, sample_dashboard: Dashboard) -> None:
        """Non-owners cannot edit public dashboards."""
        sample_dashboard.is_public = True
        assert can_edit_dashboard(sample_dashboard, "random-user") is False


class TestCanDeleteDashboard:
    """Tests for can_delete_dashboard permission function."""

    def test_owner_can_delete(self, sample_dashboard: Dashboard) -> None:
        """Dashboard owner can delete."""
        assert can_delete_dashboard(sample_dashboard, "owner-123") is True

    def test_anonymous_cannot_delete(self, sample_dashboard: Dashboard) -> None:
        """Anonymous users cannot delete."""
        assert can_delete_dashboard(sample_dashboard, None) is False

    def test_non_owner_cannot_delete(self, sample_dashboard: Dashboard) -> None:
        """Non-owners cannot delete."""
        assert can_delete_dashboard(sample_dashboard, "viewer-1") is False


class TestCanEditWidget:
    """Tests for can_edit_widget permission function."""

    def test_owner_can_edit_widget(self, sample_dashboard: Dashboard) -> None:
        """Dashboard owner can edit widgets."""
        assert can_edit_widget(sample_dashboard, "owner-123") is True

    def test_non_owner_cannot_edit_widget(self, sample_dashboard: Dashboard) -> None:
        """Non-owners cannot edit widgets."""
        assert can_edit_widget(sample_dashboard, "viewer-1") is False

    def test_anonymous_cannot_edit_widget(self, sample_dashboard: Dashboard) -> None:
        """Anonymous users cannot edit widgets."""
        assert can_edit_widget(sample_dashboard, None) is False
