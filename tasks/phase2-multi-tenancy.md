# Phase 2: Multi-Tenancy

## Overview
Enable row-level tenant isolation where developers pass `tenant_id` and `user_id` via a single auth dependency. This is critical for production use with multiple customers.

## Prerequisites
- Phase 1 complete (database persistence)
- E2E testing infrastructure (Phase 0)

## Validation Commands
```bash
make check                                    # Python tests pass
cd examples/demo/frontend && npm test         # E2E tests pass
```

## E2E Validation
```typescript
// New test: Tenant isolation
test('tenant A cannot see tenant B dashboards', async ({ request }) => {
  // Create dashboard as tenant A
  const createA = await request.post('/api/dashboards', {
    headers: { 'X-Tenant-ID': 'tenant-a' },
    data: { name: 'Tenant A Dashboard' },
  });
  const dashA = await createA.json();

  // Try to fetch as tenant B - should fail
  const fetchB = await request.get(`/api/dashboards/${dashA.id}`, {
    headers: { 'X-Tenant-ID': 'tenant-b' },
  });
  expect(fetchB.status()).toBe(404);
});
```

---

## Task 1: Define AuthContext Protocol

**File:** `packages/python/prismiq/auth.py`

```python
"""Authentication context protocol for multi-tenancy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


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
    from fastapi import Request, HTTPException

    async def get_auth_context(request: Request) -> SimpleAuthContext:
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(
                status_code=400,
                detail="X-Tenant-ID header is required"
            )

        user_id = request.headers.get("X-User-ID")

        return SimpleAuthContext(
            tenant_id=tenant_id,
            user_id=user_id,
        )

    return get_auth_context
```

---

## Task 2: Permission Enforcement Functions

**File:** `packages/python/prismiq/permissions.py`

```python
"""Permission checking functions for dashboards and widgets."""

from __future__ import annotations

from prismiq.dashboards import Dashboard


def can_view_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """
    Check if a user can view a dashboard.

    A user can view a dashboard if:
    1. The dashboard is public (is_public=True)
    2. The user is the owner (owner_id matches)
    3. The user is in allowed_viewers list

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to view (None for anonymous)

    Returns:
        True if the user can view the dashboard
    """
    # Public dashboards are viewable by anyone
    if dashboard.is_public:
        return True

    # Anonymous users can only view public dashboards
    if user_id is None:
        return False

    # Owner can always view
    if dashboard.owner_id == user_id:
        return True

    # Check allowed viewers list
    if user_id in dashboard.allowed_viewers:
        return True

    return False


def can_edit_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """
    Check if a user can edit a dashboard.

    Only the owner can edit a dashboard.

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to edit (None for anonymous)

    Returns:
        True if the user can edit the dashboard
    """
    if user_id is None:
        return False

    return dashboard.owner_id == user_id


def can_delete_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """
    Check if a user can delete a dashboard.

    Only the owner can delete a dashboard.

    Args:
        dashboard: The dashboard to check
        user_id: The user attempting to delete (None for anonymous)

    Returns:
        True if the user can delete the dashboard
    """
    if user_id is None:
        return False

    return dashboard.owner_id == user_id


def can_edit_widget(dashboard: Dashboard, user_id: str | None) -> bool:
    """
    Check if a user can edit widgets in a dashboard.

    Requires dashboard edit permission.

    Args:
        dashboard: The parent dashboard
        user_id: The user attempting to edit

    Returns:
        True if the user can edit widgets
    """
    return can_edit_dashboard(dashboard, user_id)
```

---

## Task 3: Update API Router with Auth Dependency

**File:** Update `packages/python/prismiq/api.py`

```python
"""FastAPI router factory for Prismiq endpoints."""

from __future__ import annotations

from typing import Callable, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from prismiq.auth import AuthContext, SimpleAuthContext
from prismiq.permissions import (
    can_view_dashboard,
    can_edit_dashboard,
    can_delete_dashboard,
    can_edit_widget,
)
from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    Widget,
    WidgetCreate,
    WidgetUpdate,
)
from prismiq.engine import PrismiqEngine


def create_router(
    engine: PrismiqEngine,
    get_auth_context: Callable[..., AuthContext] | None = None,
) -> APIRouter:
    """
    Create Prismiq API router with developer-provided auth.

    Args:
        engine: PrismiqEngine instance
        get_auth_context: FastAPI dependency that returns an AuthContext.
                         Called ONCE per request - no duplicate auth processing.
                         If None, uses a default that requires X-Tenant-ID header.

    Returns:
        FastAPI APIRouter with all Prismiq endpoints

    Example:
        # Simple header-based auth
        from prismiq.auth import create_header_auth_dependency
        router = create_router(engine, get_auth_context=create_header_auth_dependency())

        # Custom auth with your provider
        async def get_auth(request: Request) -> MyAuthContext:
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            user = await my_auth_provider.verify(token)
            return MyAuthContext(tenant_id=user.org_id, user_id=user.id)

        router = create_router(engine, get_auth_context=get_auth)
    """
    router = APIRouter()

    # Default auth dependency if none provided
    if get_auth_context is None:
        from prismiq.auth import create_header_auth_dependency
        get_auth_context = create_header_auth_dependency()

    # -------------------------------------------------------------------------
    # Health & Schema Endpoints (no auth required for health)
    # -------------------------------------------------------------------------

    @router.get("/health")
    async def health() -> dict[str, str]:
        """Health check endpoint."""
        return {"status": "healthy"}

    @router.get("/schema")
    async def get_schema(
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Get database schema."""
        return await engine.get_schema()

    @router.get("/schema/tables/{table_name}")
    async def get_table(
        table_name: str,
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Get a specific table's schema."""
        return await engine.get_table(table_name)

    # -------------------------------------------------------------------------
    # Query Endpoints
    # -------------------------------------------------------------------------

    @router.post("/query/validate")
    async def validate_query(
        query: dict[str, Any],
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Validate a query definition."""
        return await engine.validate_query(query)

    @router.post("/query/execute")
    async def execute_query(
        query: dict[str, Any],
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Execute a query and return results."""
        return await engine.execute_query(query)

    @router.post("/query/preview")
    async def preview_sql(
        query: dict[str, Any],
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Preview the SQL that would be generated."""
        return await engine.preview_sql(query)

    # -------------------------------------------------------------------------
    # Dashboard Endpoints
    # -------------------------------------------------------------------------

    @router.get("/dashboards")
    async def list_dashboards(
        auth: AuthContext = Depends(get_auth_context),
    ) -> list[Dashboard]:
        """List all dashboards for the tenant."""
        return await engine.dashboards.list_dashboards(
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
        )

    @router.get("/dashboards/{dashboard_id}")
    async def get_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Get a specific dashboard."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_view_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        return dashboard

    @router.post("/dashboards")
    async def create_dashboard(
        data: DashboardCreate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Create a new dashboard."""
        return await engine.dashboards.create_dashboard(
            data=data,
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
        )

    @router.patch("/dashboards/{dashboard_id}")
    async def update_dashboard(
        dashboard_id: str,
        data: DashboardUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Update a dashboard."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_edit_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        updated = await engine.dashboards.update_dashboard(
            dashboard_id=dashboard_id,
            data=data,
            tenant_id=auth.tenant_id,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        return updated

    @router.delete("/dashboards/{dashboard_id}")
    async def delete_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> dict[str, str]:
        """Delete a dashboard."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_delete_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        success = await engine.dashboards.delete_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        return {"status": "deleted"}

    # -------------------------------------------------------------------------
    # Widget Endpoints
    # -------------------------------------------------------------------------

    @router.post("/dashboards/{dashboard_id}/widgets")
    async def add_widget(
        dashboard_id: str,
        data: WidgetCreate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Widget:
        """Add a widget to a dashboard."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        widget = await engine.dashboards.add_widget(
            dashboard_id=dashboard_id,
            data=data,
            tenant_id=auth.tenant_id,
        )
        if not widget:
            raise HTTPException(status_code=400, detail="Failed to add widget")

        return widget

    @router.patch("/dashboards/{dashboard_id}/widgets/{widget_id}")
    async def update_widget(
        dashboard_id: str,
        widget_id: str,
        data: WidgetUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Widget:
        """Update a widget."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        widget = await engine.dashboards.update_widget(
            widget_id=widget_id,
            data=data,
            tenant_id=auth.tenant_id,
        )
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")

        return widget

    @router.delete("/dashboards/{dashboard_id}/widgets/{widget_id}")
    async def delete_widget(
        dashboard_id: str,
        widget_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> dict[str, str]:
        """Delete a widget."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        success = await engine.dashboards.delete_widget(
            widget_id=widget_id,
            tenant_id=auth.tenant_id,
        )
        if not success:
            raise HTTPException(status_code=404, detail="Widget not found")

        return {"status": "deleted"}

    @router.patch("/dashboards/{dashboard_id}/layout")
    async def update_layout(
        dashboard_id: str,
        positions: list[dict[str, Any]],
        auth: AuthContext = Depends(get_auth_context),
    ) -> dict[str, str]:
        """Update widget positions in a dashboard."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_edit_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        success = await engine.dashboards.update_widget_positions(
            dashboard_id=dashboard_id,
            positions=positions,
            tenant_id=auth.tenant_id,
        )
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update layout")

        return {"status": "ok"}

    # -------------------------------------------------------------------------
    # Widget Data Endpoint
    # -------------------------------------------------------------------------

    @router.get("/dashboards/{dashboard_id}/widgets/{widget_id}/data")
    async def get_widget_data(
        dashboard_id: str,
        widget_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ):
        """Execute widget query and return data."""
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        if not can_view_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        widget = next((w for w in dashboard.widgets if w.id == widget_id), None)
        if not widget:
            raise HTTPException(status_code=404, detail="Widget not found")

        if not widget.query:
            return {"data": [], "columns": []}

        # Merge dashboard filters with widget query
        from prismiq.filter_merge import merge_filters
        merged_query = merge_filters(widget.query, dashboard.filters)

        return await engine.execute_query(merged_query.model_dump())

    return router
```

---

## Task 4: Update React SDK with Tenant/User Props

**File:** Update `packages/react/src/context/AnalyticsProvider.tsx`

```tsx
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { PrismiqClient } from '../client/PrismiqClient';

interface AnalyticsConfig {
  endpoint: string;
}

interface AnalyticsContextValue {
  client: PrismiqClient;
  config: AnalyticsConfig;
  tenantId: string;
  userId?: string;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export interface AnalyticsProviderProps {
  children: ReactNode;
  config: AnalyticsConfig;
  /**
   * Tenant ID for multi-tenant isolation.
   * All API calls will include this in the X-Tenant-ID header.
   * Required for production use.
   */
  tenantId: string;
  /**
   * User ID for ownership and permissions.
   * Included in X-User-ID header when provided.
   * Used for dashboard ownership and access control.
   */
  userId?: string;
}

export function AnalyticsProvider({
  children,
  config,
  tenantId,
  userId,
}: AnalyticsProviderProps): JSX.Element {
  const client = useMemo(() => {
    const headers: Record<string, string> = {
      'X-Tenant-ID': tenantId,
    };

    if (userId) {
      headers['X-User-ID'] = userId;
    }

    return new PrismiqClient({
      endpoint: config.endpoint,
      headers,
    });
  }, [config.endpoint, tenantId, userId]);

  const value = useMemo(
    () => ({
      client,
      config,
      tenantId,
      userId,
    }),
    [client, config, tenantId, userId]
  );

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

export function useTenant(): { tenantId: string; userId?: string } {
  const { tenantId, userId } = useAnalytics();
  return { tenantId, userId };
}
```

---

## Task 5: Update PrismiqClient to Include Auth Headers

**File:** Update `packages/react/src/client/PrismiqClient.ts`

```typescript
interface PrismiqClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
}

export class PrismiqClient {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(options: PrismiqClientOptions) {
    this.endpoint = options.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.endpoint}${path}`, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Schema
  async getSchema() {
    return this.fetch('/schema');
  }

  // Dashboards
  async listDashboards() {
    return this.fetch<Dashboard[]>('/dashboards');
  }

  async getDashboard(id: string) {
    return this.fetch<Dashboard>(`/dashboards/${id}`);
  }

  async createDashboard(data: DashboardCreate) {
    return this.fetch<Dashboard>('/dashboards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDashboard(id: string, data: DashboardUpdate) {
    return this.fetch<Dashboard>(`/dashboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDashboard(id: string) {
    return this.fetch(`/dashboards/${id}`, { method: 'DELETE' });
  }

  // Widgets
  async addWidget(dashboardId: string, data: WidgetCreate) {
    return this.fetch<Widget>(`/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWidget(dashboardId: string, widgetId: string, data: WidgetUpdate) {
    return this.fetch<Widget>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWidget(dashboardId: string, widgetId: string) {
    return this.fetch(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
      method: 'DELETE',
    });
  }

  async updateLayout(dashboardId: string, positions: WidgetPositionUpdate[]) {
    return this.fetch(`/dashboards/${dashboardId}/layout`, {
      method: 'PATCH',
      body: JSON.stringify(positions),
    });
  }

  async getWidgetData(dashboardId: string, widgetId: string) {
    return this.fetch(`/dashboards/${dashboardId}/widgets/${widgetId}/data`);
  }

  // Query
  async executeQuery(query: QueryDefinition) {
    return this.fetch('/query/execute', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  async validateQuery(query: QueryDefinition) {
    return this.fetch('/query/validate', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }
}
```

---

## Task 6: Update Demo App with Tenant ID

**File:** Update `examples/demo/frontend/src/App.tsx`

```tsx
import { AnalyticsProvider, ThemeProvider } from '@prismiq/react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ExplorePage } from './pages/ExplorePage';
import { SchemaPage } from './pages/SchemaPage';

// Demo uses a fixed tenant for simplicity
// In production, this would come from your auth system
const DEMO_TENANT_ID = 'demo-tenant';
const DEMO_USER_ID = 'demo-user';

export function App() {
  return (
    <AnalyticsProvider
      config={{ endpoint: '/api' }}
      tenantId={DEMO_TENANT_ID}
      userId={DEMO_USER_ID}
    >
      <ThemeProvider defaultMode="system">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="dashboard/:id" element={<DashboardPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="schema" element={<SchemaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AnalyticsProvider>
  );
}
```

**File:** Update `examples/demo/backend/seed_dashboards.py`

```python
"""Seed demo dashboards with tenant ID."""

from prismiq.dashboard_store import DashboardStore
from prismiq.dashboards import DashboardCreate, WidgetCreate, WidgetPosition, WidgetType
from prismiq.types import QueryDefinition, QueryTable, QueryColumn

# Demo tenant ID - matches frontend
DEMO_TENANT_ID = "demo-tenant"
DEMO_USER_ID = "demo-user"


async def seed_dashboards(store: DashboardStore) -> None:
    """Create sample dashboards for the demo."""

    # Sales Overview Dashboard
    sales_dashboard = await store.create_dashboard(
        DashboardCreate(
            name="Sales Overview",
            description="Key sales metrics and trends",
        ),
        tenant_id=DEMO_TENANT_ID,
        owner_id=DEMO_USER_ID,
    )

    # Add widgets...
    await store.add_widget(
        sales_dashboard.id,
        WidgetCreate(
            type=WidgetType.METRIC,
            title="Total Revenue",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(schema="public", table="orders")],
                columns=[QueryColumn(table="orders", column="total_amount", aggregation="SUM", alias="revenue")],
                filters=[{"column": "status", "operator": "eq", "value": "completed"}],
            ),
        ),
        tenant_id=DEMO_TENANT_ID,
    )

    # ... rest of widgets
```

---

## Task 7: Tests for Multi-Tenancy

**File:** `packages/python/tests/test_multi_tenancy.py`

```python
"""Tests for multi-tenant isolation."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from fastapi import FastAPI

from prismiq.engine import PrismiqEngine
from prismiq.api import create_router
from prismiq.auth import SimpleAuthContext


@pytest.fixture
async def app(engine: PrismiqEngine) -> FastAPI:
    """Create test app with auth."""
    app = FastAPI()

    def get_auth_from_header():
        from fastapi import Request, HTTPException

        async def get_auth(request: Request) -> SimpleAuthContext:
            tenant_id = request.headers.get("X-Tenant-ID")
            if not tenant_id:
                raise HTTPException(status_code=400, detail="X-Tenant-ID required")
            return SimpleAuthContext(
                tenant_id=tenant_id,
                user_id=request.headers.get("X-User-ID"),
            )

        return get_auth

    router = create_router(engine, get_auth_context=get_auth_from_header())
    app.include_router(router, prefix="/api")
    return app


class TestTenantIsolation:
    """Test that tenants are isolated."""

    async def test_tenant_cannot_see_other_tenant_dashboard(
        self, app: FastAPI
    ) -> None:
        """Tenant A's dashboard is invisible to Tenant B."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create as tenant A
            response = await client.post(
                "/api/dashboards",
                json={"name": "Tenant A Dashboard"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "user-a"},
            )
            assert response.status_code == 200
            dashboard_id = response.json()["id"]

            # Try to fetch as tenant B
            response = await client.get(
                f"/api/dashboards/{dashboard_id}",
                headers={"X-Tenant-ID": "tenant-b", "X-User-ID": "user-b"},
            )
            assert response.status_code == 404

    async def test_tenant_list_only_shows_own_dashboards(
        self, app: FastAPI
    ) -> None:
        """List endpoint only returns tenant's own dashboards."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create for tenant A
            await client.post(
                "/api/dashboards",
                json={"name": "A Dashboard 1"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "user-a"},
            )
            await client.post(
                "/api/dashboards",
                json={"name": "A Dashboard 2"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "user-a"},
            )

            # Create for tenant B
            await client.post(
                "/api/dashboards",
                json={"name": "B Dashboard 1"},
                headers={"X-Tenant-ID": "tenant-b", "X-User-ID": "user-b"},
            )

            # List as tenant A
            response = await client.get(
                "/api/dashboards",
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "user-a"},
            )
            dashboards = response.json()
            assert len(dashboards) == 2
            assert all("A Dashboard" in d["name"] for d in dashboards)

            # List as tenant B
            response = await client.get(
                "/api/dashboards",
                headers={"X-Tenant-ID": "tenant-b", "X-User-ID": "user-b"},
            )
            dashboards = response.json()
            assert len(dashboards) == 1
            assert dashboards[0]["name"] == "B Dashboard 1"


class TestPermissions:
    """Test permission enforcement."""

    async def test_owner_can_edit(self, app: FastAPI) -> None:
        """Owner can edit their dashboard."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create
            response = await client.post(
                "/api/dashboards",
                json={"name": "My Dashboard"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )
            dashboard_id = response.json()["id"]

            # Update as owner
            response = await client.patch(
                f"/api/dashboards/{dashboard_id}",
                json={"name": "Updated Name"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )
            assert response.status_code == 200

    async def test_non_owner_cannot_edit(self, app: FastAPI) -> None:
        """Non-owner cannot edit dashboard."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create as owner
            response = await client.post(
                "/api/dashboards",
                json={"name": "Owner Dashboard"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )
            dashboard_id = response.json()["id"]

            # Try to update as different user
            response = await client.patch(
                f"/api/dashboards/{dashboard_id}",
                json={"name": "Hacked Name"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "other-user"},
            )
            assert response.status_code == 403

    async def test_public_dashboard_viewable_by_anyone(self, app: FastAPI) -> None:
        """Public dashboards can be viewed by anyone in tenant."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create
            response = await client.post(
                "/api/dashboards",
                json={"name": "Public Dashboard"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )
            dashboard_id = response.json()["id"]

            # Make public
            await client.patch(
                f"/api/dashboards/{dashboard_id}",
                json={"is_public": True},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )

            # View as different user in same tenant
            response = await client.get(
                f"/api/dashboards/{dashboard_id}",
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "viewer"},
            )
            assert response.status_code == 200

    async def test_allowed_viewer_can_view(self, app: FastAPI) -> None:
        """Users in allowed_viewers list can view."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Create
            response = await client.post(
                "/api/dashboards",
                json={"name": "Shared Dashboard"},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )
            dashboard_id = response.json()["id"]

            # Add allowed viewer
            await client.patch(
                f"/api/dashboards/{dashboard_id}",
                json={"allowed_viewers": ["viewer-1", "viewer-2"]},
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "owner"},
            )

            # View as allowed viewer
            response = await client.get(
                f"/api/dashboards/{dashboard_id}",
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "viewer-1"},
            )
            assert response.status_code == 200

            # Denied for non-allowed viewer
            response = await client.get(
                f"/api/dashboards/{dashboard_id}",
                headers={"X-Tenant-ID": "tenant-a", "X-User-ID": "random-user"},
            )
            assert response.status_code == 403
```

---

## Task 8: E2E Multi-Tenancy Tests

**File:** `examples/demo/frontend/e2e/multi-tenancy.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000/api';

test.describe('Multi-Tenancy', () => {
  test('tenant A cannot access tenant B dashboard', async ({ request }) => {
    // Create as tenant A
    const createResponse = await request.post(`${API}/dashboards`, {
      headers: { 'X-Tenant-ID': 'tenant-a', 'X-User-ID': 'user-a' },
      data: { name: `Tenant A Dash ${Date.now()}` },
    });
    const dashA = await createResponse.json();

    // Try to access as tenant B
    const getResponse = await request.get(`${API}/dashboards/${dashA.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-b', 'X-User-ID': 'user-b' },
    });
    expect(getResponse.status()).toBe(404);

    // Cleanup
    await request.delete(`${API}/dashboards/${dashA.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-a', 'X-User-ID': 'user-a' },
    });
  });

  test('list only shows own tenant dashboards', async ({ request }) => {
    // Create for tenant A
    const createA = await request.post(`${API}/dashboards`, {
      headers: { 'X-Tenant-ID': 'tenant-list-a', 'X-User-ID': 'user-a' },
      data: { name: `List Test A ${Date.now()}` },
    });
    const dashA = await createA.json();

    // Create for tenant B
    const createB = await request.post(`${API}/dashboards`, {
      headers: { 'X-Tenant-ID': 'tenant-list-b', 'X-User-ID': 'user-b' },
      data: { name: `List Test B ${Date.now()}` },
    });
    const dashB = await createB.json();

    // List as tenant A
    const listA = await request.get(`${API}/dashboards`, {
      headers: { 'X-Tenant-ID': 'tenant-list-a', 'X-User-ID': 'user-a' },
    });
    const dashboardsA = await listA.json();
    expect(dashboardsA.some((d: any) => d.id === dashA.id)).toBeTruthy();
    expect(dashboardsA.some((d: any) => d.id === dashB.id)).toBeFalsy();

    // Cleanup
    await request.delete(`${API}/dashboards/${dashA.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-list-a', 'X-User-ID': 'user-a' },
    });
    await request.delete(`${API}/dashboards/${dashB.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-list-b', 'X-User-ID': 'user-b' },
    });
  });

  test('non-owner cannot edit dashboard', async ({ request }) => {
    // Create as owner
    const create = await request.post(`${API}/dashboards`, {
      headers: { 'X-Tenant-ID': 'tenant-perm', 'X-User-ID': 'owner' },
      data: { name: `Permission Test ${Date.now()}` },
    });
    const dashboard = await create.json();

    // Try to edit as different user
    const update = await request.patch(`${API}/dashboards/${dashboard.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-perm', 'X-User-ID': 'other-user' },
      data: { name: 'Hacked Name' },
    });
    expect(update.status()).toBe(403);

    // Cleanup
    await request.delete(`${API}/dashboards/${dashboard.id}`, {
      headers: { 'X-Tenant-ID': 'tenant-perm', 'X-User-ID': 'owner' },
    });
  });

  test('missing tenant header returns 400', async ({ request }) => {
    const response = await request.get(`${API}/dashboards`);
    expect(response.status()).toBe(400);
  });
});
```

---

## Completion Criteria

- [ ] `AuthContext` protocol defined with `tenant_id` and `user_id`
- [ ] `SimpleAuthContext` dataclass implementation provided
- [ ] `create_header_auth_dependency()` factory function available
- [ ] `can_view_dashboard`, `can_edit_dashboard`, `can_delete_dashboard` functions
- [ ] `create_router()` accepts `get_auth_context` parameter
- [ ] All endpoints use `auth: AuthContext = Depends(get_auth_context)`
- [ ] All dashboard operations scoped by `tenant_id`
- [ ] Permission checks enforce `owner_id`, `is_public`, `allowed_viewers`
- [ ] React `AnalyticsProvider` requires `tenantId` prop
- [ ] React `AnalyticsProvider` accepts optional `userId` prop
- [ ] `PrismiqClient` sends `X-Tenant-ID` and `X-User-ID` headers
- [ ] Demo app uses fixed tenant/user IDs
- [ ] All unit tests pass
- [ ] All E2E multi-tenancy tests pass
