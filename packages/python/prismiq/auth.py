"""Authentication context protocol for multi-tenancy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from fastapi import Request


@runtime_checkable
class AuthContext(Protocol):
    """
    Protocol for authentication context.

    Developers implement this interface with their auth system.
    Prismiq only requires tenant_id and user_id properties.
    Developers can add any extra fields their app needs.

    Example implementations:
    - Extract from JWT claims
    - Extract from Clerk session
    - Extract from API key lookup
    - Extract from request headers
    """

    @property
    def tenant_id(self) -> str:
        """
        Tenant/organization ID for data isolation.

        All dashboard and widget operations are scoped to this tenant.
        This is REQUIRED for all operations.
        """
        ...

    @property
    def user_id(self) -> str | None:
        """
        User ID for ownership and permissions.

        Used for:
        - Setting owner_id on created dashboards
        - Checking edit/delete permissions
        - Filtering dashboards by allowed_viewers

        Can be None for system/API-key based access.
        """
        ...


@dataclass(frozen=True)
class SimpleAuthContext:
    """
    Simple implementation of AuthContext for basic use cases.

    Use this when you have simple header-based authentication.
    For production, implement your own AuthContext with your auth system.
    """

    tenant_id: str
    user_id: str | None = None

    # Optional: add extra fields your app needs
    email: str | None = None
    roles: list[str] | None = None


def create_header_auth_dependency():
    """
    Create a FastAPI dependency that extracts auth from headers.

    Returns a factory function that creates the dependency.
    This is the simplest way to add multi-tenancy.

    Usage:
        get_auth = create_header_auth_dependency()
        router = create_router(engine, get_auth_context=get_auth)

    Headers:
        X-Tenant-ID: Required tenant identifier
        X-User-ID: Optional user identifier
    """
    from fastapi import HTTPException

    async def get_auth_context(request: Request) -> SimpleAuthContext:
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")

        user_id = request.headers.get("X-User-ID")

        return SimpleAuthContext(
            tenant_id=tenant_id,
            user_id=user_id,
        )

    return get_auth_context
