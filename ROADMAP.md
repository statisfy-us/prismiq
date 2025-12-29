# Prismiq Development Roadmap

## Product Vision

Prismiq is an **embeddable analytics SDK** that lets developers add dashboards and reports to their applications. It replaces tools like Reveal BI, Metabase Embedded, and Looker Embedded.

**Key Differentiators:**
- React components (not iframe)
- Direct PostgreSQL access (no semantic layer required)
- Full theming/white-label support
- Multi-tenant by design
- Auth-agnostic: plug in your existing auth
- Open source

---

## Current Implementation Status

### Completed Features

| Category | Feature | Status |
|----------|---------|--------|
| **Schema** | PostgreSQL introspection | ✅ Complete |
| **Schema** | Relationship detection | ✅ Complete |
| **Schema** | Display names, hidden columns | ✅ Complete |
| **Query** | Visual query builder UI | ✅ Complete |
| **Query** | SQL generation with validation | ✅ Complete |
| **Query** | Joins, filters, aggregations | ✅ Complete |
| **Query** | Time series bucketing | ✅ Complete |
| **Charts** | 8 widget types (metric, bar, line, area, pie, scatter, table, text) | ✅ Complete |
| **Dashboard** | CRUD API (in-memory) | ✅ Complete |
| **Dashboard** | Widget CRUD API (in-memory) | ✅ Complete |
| **Dashboard** | Dashboard filters (date, select, multi-select) | ✅ Complete |
| **Dashboard** | Filter merge with widget queries | ✅ Complete |
| **Dashboard** | Import/Export JSON | ✅ Complete |
| **Dashboard** | react-grid-layout integration | ✅ Complete |
| **Dashboard** | Auto-refresh support | ✅ Complete |
| **Production** | Redis caching | ✅ Complete |
| **Production** | Health checks (liveness, readiness) | ✅ Complete |
| **Production** | Prometheus metrics | ✅ Complete |

### Critical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No database persistence** | Dashboards/widgets lost on restart | 🔴 Critical |
| **No multi-tenancy** | Cannot serve multiple customers | 🔴 Critical |
| **No dashboard management UI** | Users can't create/edit dashboards | 🔴 Critical |
| **No widget editor UI** | Users can't add/modify widgets | 🔴 Critical |
| **Layout changes not persisted** | Drag-drop doesn't save | 🟡 High |
| **No permission enforcement** | is_public/allowed_viewers not checked | 🟡 High |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's Application                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   // Developer handles auth, extracts tenant_id & user_id       │
│   const { tenantId, userId } = useAuth(); // Their auth system  │
│                                                                 │
│   <PrismiqProvider                                              │
│     endpoint="/api/prismiq"                                     │
│     tenantId={tenantId}   // Passed from developer's auth       │
│     userId={userId}       // Passed from developer's auth       │
│   >                                                             │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│     │ QueryBuilder│  │  Dashboard  │  │DashboardMgr │          │
│     │  Component  │  │  Component  │  │  Component  │          │
│     └─────────────┘  └─────────────┘  └─────────────┘          │
│   </PrismiqProvider>                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP + X-Tenant-ID + X-User-ID headers
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                    Developer's Backend                          │
│                             │                                   │
│   // Developer mounts Prismiq router with their auth middleware │
│   app.use("/api/prismiq", authMiddleware, prismiqRouter)        │
│                             │                                   │
│   // Or pass tenant/user to engine directly                     │
│   engine.get_dashboards(tenant_id="acme", user_id="user123")    │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                    Prismiq Backend (SDK)                        │
│                             │                                   │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │                   PrismiqEngine                           │  │
│  │  - Accepts tenant_id on all methods                      │  │
│  │  - Accepts user_id for ownership/permissions             │  │
│  │  - Developer controls how these are extracted            │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │              PostgresDashboardStore                       │  │
│  │  (prismiq_dashboards, prismiq_widgets tables)            │  │
│  │  All queries filtered by tenant_id                        │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
│                      ┌──────┴──────┐                           │
│                      │   asyncpg   │                           │
│                      └──────┬──────┘                           │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    PostgreSQL     │
                    │  Customer's DB    │
                    │  + Prismiq Tables │
                    └───────────────────┘
```

**Auth Philosophy:** Prismiq is auth-agnostic. Developers:
1. Use their existing auth system (Clerk, Auth0, custom JWT, etc.)
2. Extract `tenant_id` and `user_id` from their auth context
3. Pass these to Prismiq SDK (via headers, params, or directly)
4. Prismiq uses these values for isolation and permissions

---

## Updated Roadmap

### Phase 1: Database Persistence (Priority: Critical)

**Goal:** Persist dashboards and widgets to PostgreSQL so data survives restarts.

#### Task 1.1: Database Schema Design

**File:** `packages/python/prismiq/persistence/schema.sql`

```sql
-- Prismiq metadata tables (created in customer's database or separate DB)

CREATE TABLE IF NOT EXISTS prismiq_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{"columns": 12, "row_height": 50, "margin": [10, 10]}',
    filters JSONB NOT NULL DEFAULT '[]',
    owner_id VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_viewers TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_dashboard_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX idx_dashboards_tenant_id ON prismiq_dashboards(tenant_id);
CREATE INDEX idx_dashboards_owner_id ON prismiq_dashboards(tenant_id, owner_id);

CREATE TABLE IF NOT EXISTS prismiq_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES prismiq_dashboards(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    query JSONB,  -- Null for text widgets
    position JSONB NOT NULL,  -- {x, y, w, h}
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widgets_dashboard_id ON prismiq_widgets(dashboard_id);

-- Schema configuration per tenant
CREATE TABLE IF NOT EXISTS prismiq_schema_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved queries (for future use)
CREATE TABLE IF NOT EXISTS prismiq_saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    owner_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_query_name_per_tenant UNIQUE (tenant_id, name)
);
```

#### Task 1.2: SQLAlchemy Core Tables (No ORM)

**File:** `packages/python/prismiq/persistence/tables.py`

```python
from sqlalchemy import Table, Column, String, Boolean, Text, ForeignKey, MetaData, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP, ARRAY
from datetime import datetime

metadata = MetaData()

dashboards_table = Table(
    "prismiq_dashboards",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("tenant_id", String(255), nullable=False, index=True),
    Column("name", String(255), nullable=False),
    Column("description", Text),
    Column("layout", JSONB, nullable=False),
    Column("filters", JSONB, nullable=False),
    Column("owner_id", String(255)),
    Column("is_public", Boolean, nullable=False, default=False),
    Column("allowed_viewers", ARRAY(Text), nullable=False),
    Column("created_at", TIMESTAMP(timezone=True), default=datetime.utcnow),
    Column("updated_at", TIMESTAMP(timezone=True), default=datetime.utcnow),
)

widgets_table = Table(
    "prismiq_widgets",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("dashboard_id", UUID(as_uuid=True), ForeignKey("prismiq_dashboards.id", ondelete="CASCADE"), nullable=False),
    Column("type", String(50), nullable=False),
    Column("title", String(255), nullable=False),
    Column("query", JSONB),
    Column("position", JSONB, nullable=False),
    Column("config", JSONB, nullable=False),
    Column("created_at", TIMESTAMP(timezone=True), default=datetime.utcnow),
    Column("updated_at", TIMESTAMP(timezone=True), default=datetime.utcnow),
    Index("idx_widgets_dashboard_id", "dashboard_id"),
)

schema_config_table = Table(
    "prismiq_schema_config",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("tenant_id", String(255), nullable=False, unique=True),
    Column("config", JSONB, nullable=False),
    Column("updated_at", TIMESTAMP(timezone=True), default=datetime.utcnow),
)
```

#### Task 1.3: PostgresDashboardStore Implementation

**File:** `packages/python/prismiq/persistence/postgres_store.py`

```python
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from asyncpg import Pool

from prismiq.dashboards import (
    Dashboard, DashboardCreate, DashboardUpdate,
    Widget, WidgetCreate, WidgetUpdate, WidgetPosition,
)
from prismiq.dashboard_store import DashboardStore


class PostgresDashboardStore(DashboardStore):
    """PostgreSQL-backed dashboard storage with tenant isolation."""

    def __init__(self, pool: Pool):
        self._pool = pool

    async def list_dashboards(
        self,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> list[Dashboard]:
        """List dashboards for tenant, optionally filtered by owner."""
        query = """
            SELECT d.*, json_agg(w.*) as widgets
            FROM prismiq_dashboards d
            LEFT JOIN prismiq_widgets w ON w.dashboard_id = d.id
            WHERE d.tenant_id = $1
        """
        params: list[Any] = [tenant_id]

        if owner_id:
            query += " AND (d.owner_id = $2 OR d.is_public = TRUE OR $2 = ANY(d.allowed_viewers))"
            params.append(owner_id)

        query += " GROUP BY d.id ORDER BY d.updated_at DESC"

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [self._row_to_dashboard(row) for row in rows]

    async def get_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> Dashboard | None:
        """Get dashboard by ID with tenant check."""
        query = """
            SELECT d.*, json_agg(w.* ORDER BY w.position->>'y', w.position->>'x') as widgets
            FROM prismiq_dashboards d
            LEFT JOIN prismiq_widgets w ON w.dashboard_id = d.id
            WHERE d.id = $1 AND d.tenant_id = $2
            GROUP BY d.id
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, uuid.UUID(dashboard_id), tenant_id)
            if not row:
                return None
            return self._row_to_dashboard(row)

    async def create_dashboard(
        self,
        data: DashboardCreate,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> Dashboard:
        """Create new dashboard for tenant."""
        dashboard_id = uuid.uuid4()
        now = datetime.utcnow()
        layout = data.layout or DashboardLayout()

        query = """
            INSERT INTO prismiq_dashboards
            (id, tenant_id, name, description, layout, filters, owner_id, is_public, allowed_viewers, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                dashboard_id,
                tenant_id,
                data.name,
                data.description,
                layout.model_dump_json(),
                "[]",
                owner_id,
                False,
                [],
                now,
                now,
            )
            return self._row_to_dashboard(row, widgets=[])

    async def update_dashboard(
        self,
        dashboard_id: str,
        data: DashboardUpdate,
        tenant_id: str,
    ) -> Dashboard | None:
        """Update dashboard with tenant check."""
        # Build dynamic UPDATE query based on provided fields
        ...

    async def delete_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete dashboard with tenant check."""
        query = "DELETE FROM prismiq_dashboards WHERE id = $1 AND tenant_id = $2"
        async with self._pool.acquire() as conn:
            result = await conn.execute(query, uuid.UUID(dashboard_id), tenant_id)
            return result == "DELETE 1"

    async def add_widget(
        self,
        dashboard_id: str,
        data: WidgetCreate,
        tenant_id: str,
    ) -> Widget | None:
        """Add widget to dashboard with tenant check."""
        # First verify dashboard belongs to tenant
        ...

    async def update_widget(
        self,
        widget_id: str,
        data: WidgetUpdate,
        tenant_id: str,
    ) -> Widget | None:
        """Update widget with tenant check via dashboard."""
        ...

    async def delete_widget(
        self,
        widget_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete widget with tenant check."""
        ...

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, Any]],
        tenant_id: str,
    ) -> bool:
        """Batch update widget positions."""
        ...

    # Helper methods
    def _row_to_dashboard(self, row, widgets=None) -> Dashboard:
        """Convert database row to Dashboard model."""
        ...

    def _row_to_widget(self, row) -> Widget:
        """Convert database row to Widget model."""
        ...
```

#### Task 1.4: Table Creation Utility

**File:** `packages/python/prismiq/persistence/setup.py`

```python
async def ensure_tables(pool: Pool) -> None:
    """Create Prismiq tables if they don't exist."""
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)

async def drop_tables(pool: Pool) -> None:
    """Drop all Prismiq tables (use with caution)."""
    ...
```

#### Task 1.5: Update Engine to Use PostgreSQL Store

**File:** Update `packages/python/prismiq/engine.py`

```python
class PrismiqEngine:
    def __init__(
        self,
        database_url: str,
        *,
        # Persistence options
        persist_dashboards: bool = True,  # If False, use InMemoryDashboardStore
        auto_create_tables: bool = True,  # Create prismiq_* tables on startup
        ...
    ):
        ...

    async def startup(self) -> None:
        # Create connection pool
        self._pool = await asyncpg.create_pool(self._database_url)

        # Create tables if needed
        if self._persist_dashboards and self._auto_create_tables:
            await ensure_tables(self._pool)

        # Initialize dashboard store
        if self._persist_dashboards:
            self._dashboard_store = PostgresDashboardStore(self._pool)
        else:
            self._dashboard_store = InMemoryDashboardStore()
```

**Deliverable:** Dashboards/widgets persist to PostgreSQL with automatic table creation.

---

### Phase 2: Multi-Tenancy (Priority: Critical)

**Goal:** Enable row-level tenant isolation where developers pass `tenant_id` via a single auth dependency.

#### Task 2.1: Define AuthContext Protocol

**File:** `packages/python/prismiq/auth.py`

```python
from __future__ import annotations

from typing import Protocol, runtime_checkable
from dataclasses import dataclass


@runtime_checkable
class AuthContext(Protocol):
    """
    Protocol for authentication context.

    Developers implement this interface with their auth system.
    Prismiq only requires tenant_id and user_id attributes.
    Developers can add any extra fields their app needs.
    """

    @property
    def tenant_id(self) -> str:
        """Tenant/organization ID for data isolation."""
        ...

    @property
    def user_id(self) -> str | None:
        """User ID for ownership/permissions (optional)."""
        ...


@dataclass
class SimpleAuthContext:
    """Simple implementation of AuthContext for basic use cases."""

    tenant_id: str
    user_id: str | None = None
```

#### Task 2.2: Update create_router to Accept Single Auth Dependency

**File:** Update `packages/python/prismiq/api.py`

The key insight: **one dependency, called once per request, provides both tenant_id and user_id**.

```python
from typing import Callable
from fastapi import APIRouter, Depends, HTTPException

from prismiq.auth import AuthContext


def create_router(
    engine: PrismiqEngine,
    get_auth_context: Callable[..., AuthContext],
) -> APIRouter:
    """
    Create Prismiq API router with developer-provided auth.

    Args:
        engine: PrismiqEngine instance
        get_auth_context: FastAPI dependency that returns an AuthContext.
                         Called ONCE per request - no duplicate auth processing.

    The dependency can be sync or async, and can depend on other dependencies.
    """
    router = APIRouter()

    @router.get("/dashboards")
    async def list_dashboards(
        auth: AuthContext = Depends(get_auth_context),
    ) -> list[Dashboard]:
        return await engine.dashboards.list_dashboards(
            auth.tenant_id,
            auth.user_id,
        )

    @router.get("/dashboards/{dashboard_id}")
    async def get_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id,
            auth.tenant_id,
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
        return await engine.dashboards.create_dashboard(
            data,
            auth.tenant_id,
            auth.user_id,
        )

    @router.patch("/dashboards/{dashboard_id}")
    async def update_dashboard(
        dashboard_id: str,
        data: DashboardUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        dashboard = await engine.dashboards.get_dashboard(
            dashboard_id,
            auth.tenant_id,
        )
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        if not can_edit_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")
        return await engine.dashboards.update_dashboard(
            dashboard_id,
            data,
            auth.tenant_id,
        )

    # ... all other endpoints follow the same pattern

    return router
```

#### Task 2.3: Update Dashboard Store Methods

All `DashboardStore` methods now require `tenant_id`:

```python
class DashboardStore(Protocol):
    async def list_dashboards(self, tenant_id: str, owner_id: str | None = None) -> list[Dashboard]: ...
    async def get_dashboard(self, dashboard_id: str, tenant_id: str) -> Dashboard | None: ...
    async def create_dashboard(self, data: DashboardCreate, tenant_id: str, owner_id: str | None) -> Dashboard: ...
    async def update_dashboard(self, dashboard_id: str, data: DashboardUpdate, tenant_id: str) -> Dashboard | None: ...
    async def delete_dashboard(self, dashboard_id: str, tenant_id: str) -> bool: ...
    # ... same for widget methods
```

#### Task 2.4: Permission Enforcement

**File:** `packages/python/prismiq/permissions.py`

```python
from prismiq.dashboards import Dashboard


def can_view_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if user can view dashboard."""
    if dashboard.is_public:
        return True
    if user_id is None:
        return False
    if dashboard.owner_id == user_id:
        return True
    if user_id in dashboard.allowed_viewers:
        return True
    return False


def can_edit_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if user can edit dashboard."""
    if user_id is None:
        return False
    return dashboard.owner_id == user_id


def can_delete_dashboard(dashboard: Dashboard, user_id: str | None) -> bool:
    """Check if user can delete dashboard."""
    if user_id is None:
        return False
    return dashboard.owner_id == user_id
```

#### Task 2.5: Update React SDK

**File:** Update `packages/react/src/context/PrismiqProvider.tsx`

```tsx
interface PrismiqProviderProps {
  endpoint: string;
  tenantId: string;     // Required: developer extracts from their auth
  userId?: string;      // Optional: for ownership/permissions
  children: React.ReactNode;
}

export function PrismiqProvider({
  endpoint,
  tenantId,
  userId,
  children,
}: PrismiqProviderProps): JSX.Element {
  const client = useMemo(
    () => new PrismiqClient({
      endpoint,
      headers: {
        "X-Tenant-ID": tenantId,
        ...(userId && { "X-User-ID": userId }),
      },
    }),
    [endpoint, tenantId, userId]
  );

  // ...
}
```

**Deliverable:** Complete tenant isolation with developer-controlled tenant_id/user_id.

---

### Phase 3: Dashboard Management UI (Priority: Critical)

**Goal:** Add React components for creating and managing dashboards.

#### Task 3.1: Dashboard List Component

**File:** `packages/react/src/dashboard/DashboardList/DashboardList.tsx`

```tsx
interface DashboardListProps {
  onSelect?: (dashboard: Dashboard) => void;
  onCreate?: () => void;
  onEdit?: (dashboard: Dashboard) => void;
  onDelete?: (dashboard: Dashboard) => void;
  showActions?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DashboardList({
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  showActions = true,
  emptyState,
  className,
}: DashboardListProps): JSX.Element {
  const { dashboards, isLoading, error, refetch } = useDashboards();

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (dashboards.length === 0) return emptyState || <EmptyState onCreate={onCreate} />;

  return (
    <div className={cn("prismiq-dashboard-list", className)}>
      {showActions && onCreate && (
        <Button onClick={onCreate}>+ New Dashboard</Button>
      )}
      <div className="dashboard-grid">
        {dashboards.map(dashboard => (
          <DashboardCard
            key={dashboard.id}
            dashboard={dashboard}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            showActions={showActions}
          />
        ))}
      </div>
    </div>
  );
}
```

#### Task 3.2: Dashboard Create/Edit Dialog

**File:** `packages/react/src/dashboard/DashboardDialog/DashboardDialog.tsx`

```tsx
interface DashboardDialogProps {
  open: boolean;
  dashboard?: Dashboard;  // If provided, edit mode
  onSave: (data: DashboardCreate | DashboardUpdate) => Promise<void>;
  onClose: () => void;
}

export function DashboardDialog({
  open,
  dashboard,
  onSave,
  onClose,
}: DashboardDialogProps): JSX.Element {
  const [name, setName] = useState(dashboard?.name ?? "");
  const [description, setDescription] = useState(dashboard?.description ?? "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await onSave({ name, description });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <Dialog.Title>{dashboard ? "Edit Dashboard" : "Create Dashboard"}</Dialog.Title>
      <Dialog.Content>
        <TextField
          label="Name"
          value={name}
          onChange={setName}
          required
        />
        <TextField
          label="Description"
          value={description}
          onChange={setDescription}
          multiline
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={isLoading}>Save</Button>
      </Dialog.Actions>
    </Dialog>
  );
}
```

#### Task 3.3: Widget Editor Component

**File:** `packages/react/src/dashboard/WidgetEditor/WidgetEditor.tsx`

```tsx
interface WidgetEditorProps {
  dashboardId: string;
  widget?: Widget;  // If provided, edit mode
  onSave: (widget: Widget) => void;
  onCancel: () => void;
}

export function WidgetEditor({
  dashboardId,
  widget,
  onSave,
  onCancel,
}: WidgetEditorProps): JSX.Element {
  const [step, setStep] = useState<"type" | "query" | "config" | "preview">("type");
  const [widgetType, setWidgetType] = useState<WidgetType | null>(widget?.type ?? null);
  const [query, setQuery] = useState<QueryDefinition | null>(widget?.query ?? null);
  const [config, setConfig] = useState<WidgetConfig>(widget?.config ?? {});
  const [title, setTitle] = useState(widget?.title ?? "");

  return (
    <div className="widget-editor">
      <StepIndicator current={step} steps={["type", "query", "config", "preview"]} />

      {step === "type" && (
        <WidgetTypeSelector
          value={widgetType}
          onChange={(type) => {
            setWidgetType(type);
            if (type === "text") {
              setStep("config");  // Text widgets skip query step
            } else {
              setStep("query");
            }
          }}
        />
      )}

      {step === "query" && widgetType && (
        <QueryBuilder
          query={query}
          onChange={setQuery}
          onNext={() => setStep("config")}
        />
      )}

      {step === "config" && widgetType && (
        <VisualizationConfig
          widgetType={widgetType}
          query={query}
          config={config}
          onChange={setConfig}
          onNext={() => setStep("preview")}
        />
      )}

      {step === "preview" && widgetType && (
        <WidgetPreview
          type={widgetType}
          query={query}
          config={config}
          title={title}
          onTitleChange={setTitle}
          onSave={handleSave}
          onBack={() => setStep("config")}
        />
      )}
    </div>
  );
}
```

#### Task 3.4: Widget Type Selector

**File:** `packages/react/src/dashboard/WidgetEditor/WidgetTypeSelector.tsx`

```tsx
const WIDGET_TYPES = [
  { type: "metric", label: "Metric", icon: MetricIcon, category: "KPIs" },
  { type: "bar_chart", label: "Bar Chart", icon: BarChartIcon, category: "Charts" },
  { type: "line_chart", label: "Line Chart", icon: LineChartIcon, category: "Charts" },
  { type: "area_chart", label: "Area Chart", icon: AreaChartIcon, category: "Charts" },
  { type: "pie_chart", label: "Pie Chart", icon: PieChartIcon, category: "Charts" },
  { type: "scatter_chart", label: "Scatter Plot", icon: ScatterIcon, category: "Charts" },
  { type: "table", label: "Table", icon: TableIcon, category: "Data" },
  { type: "text", label: "Text/Markdown", icon: TextIcon, category: "Content" },
];

export function WidgetTypeSelector({
  value,
  onChange,
}: WidgetTypeSelectorProps): JSX.Element {
  const grouped = groupBy(WIDGET_TYPES, "category");

  return (
    <div className="widget-type-selector">
      {Object.entries(grouped).map(([category, types]) => (
        <div key={category} className="category">
          <h3>{category}</h3>
          <div className="type-grid">
            {types.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                className={cn("type-card", value === type && "selected")}
                onClick={() => onChange(type)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Task 3.5: Visualization Configurator

**File:** `packages/react/src/dashboard/WidgetEditor/VisualizationConfig.tsx`

```tsx
interface VisualizationConfigProps {
  widgetType: WidgetType;
  query: QueryDefinition | null;
  config: WidgetConfig;
  onChange: (config: WidgetConfig) => void;
  onNext: () => void;
}

export function VisualizationConfig({
  widgetType,
  query,
  config,
  onChange,
  onNext,
}: VisualizationConfigProps): JSX.Element {
  // Get available columns from query
  const columns = query?.columns.map(c => c.alias || c.column) ?? [];

  switch (widgetType) {
    case "bar_chart":
    case "line_chart":
    case "area_chart":
      return (
        <ChartConfig
          columns={columns}
          config={config}
          onChange={onChange}
          onNext={onNext}
          options={{
            showOrientation: widgetType === "bar_chart",
            showStacked: true,
          }}
        />
      );

    case "pie_chart":
      return (
        <PieConfig
          columns={columns}
          config={config}
          onChange={onChange}
          onNext={onNext}
        />
      );

    case "metric":
      return (
        <MetricConfig
          columns={columns}
          config={config}
          onChange={onChange}
          onNext={onNext}
        />
      );

    case "table":
      return (
        <TableConfig
          columns={columns}
          config={config}
          onChange={onChange}
          onNext={onNext}
        />
      );

    case "text":
      return (
        <TextConfig
          config={config}
          onChange={onChange}
          onNext={onNext}
        />
      );

    default:
      return null;
  }
}
```

#### Task 3.6: Dashboard Edit Mode

**File:** Update `packages/react/src/dashboard/Dashboard.tsx`

```tsx
interface DashboardProps {
  id: string;
  editable?: boolean;
  showFilters?: boolean;
  showTitle?: boolean;
  refreshInterval?: number;
  onLayoutChange?: (widgets: Widget[]) => void;
  className?: string;
}

export function Dashboard({
  id,
  editable = false,
  showFilters = true,
  showTitle = true,
  refreshInterval,
  onLayoutChange,
  className,
}: DashboardProps): JSX.Element {
  const { dashboard, widgets, updateWidgetPosition, addWidget, deleteWidget } = useDashboard(id);
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);

  const handleLayoutChange = (layout: Layout[]) => {
    // Update widget positions
    const updatedWidgets = layout.map(item => ({
      widgetId: item.i,
      position: { x: item.x, y: item.y, w: item.w, h: item.h },
    }));
    updateWidgetPositions(updatedWidgets);
    onLayoutChange?.(updatedWidgets);
  };

  return (
    <DashboardProvider id={id}>
      <div className={cn("prismiq-dashboard", editable && "editable", className)}>
        {showTitle && <DashboardHeader dashboard={dashboard} />}
        {showFilters && <FilterBar />}

        {editable && (
          <div className="dashboard-actions">
            <Button onClick={() => setWidgetEditorOpen(true)}>+ Add Widget</Button>
          </div>
        )}

        <DashboardLayout
          widgets={widgets}
          editable={editable}
          onLayoutChange={handleLayoutChange}
          onWidgetEdit={editable ? setEditingWidget : undefined}
          onWidgetDelete={editable ? deleteWidget : undefined}
        />

        {widgetEditorOpen && (
          <WidgetEditor
            dashboardId={id}
            widget={editingWidget}
            onSave={(widget) => {
              if (editingWidget) {
                updateWidget(widget);
              } else {
                addWidget(widget);
              }
              setWidgetEditorOpen(false);
              setEditingWidget(null);
            }}
            onCancel={() => {
              setWidgetEditorOpen(false);
              setEditingWidget(null);
            }}
          />
        )}
      </div>
    </DashboardProvider>
  );
}
```

#### Task 3.7: useDashboardMutations Hook

**File:** `packages/react/src/hooks/useDashboardMutations.ts`

```tsx
interface UseDashboardMutationsResult {
  createDashboard: (data: DashboardCreate) => Promise<Dashboard>;
  updateDashboard: (id: string, data: DashboardUpdate) => Promise<Dashboard>;
  deleteDashboard: (id: string) => Promise<void>;
  addWidget: (dashboardId: string, data: WidgetCreate) => Promise<Widget>;
  updateWidget: (widgetId: string, data: WidgetUpdate) => Promise<Widget>;
  deleteWidget: (widgetId: string) => Promise<void>;
  updateWidgetPositions: (dashboardId: string, positions: WidgetPositionUpdate[]) => Promise<void>;
  duplicateWidget: (widgetId: string) => Promise<Widget>;
  isLoading: boolean;
  error: Error | null;
}

export function useDashboardMutations(): UseDashboardMutationsResult {
  const { client } = usePrismiq();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createDashboard = async (data: DashboardCreate) => {
    setIsLoading(true);
    setError(null);
    try {
      return await client.createDashboard(data);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  // ... other mutation functions

  return {
    createDashboard,
    updateDashboard,
    deleteDashboard,
    addWidget,
    updateWidget,
    deleteWidget,
    updateWidgetPositions,
    duplicateWidget,
    isLoading,
    error,
  };
}
```

**Deliverable:** Complete UI for creating, editing, and deleting dashboards and widgets.

---

### Phase 4: Layout Persistence (Priority: High)

**Goal:** Persist drag-drop layout changes to the database.

#### Task 4.1: Batch Position Update Endpoint

**File:** Update `packages/python/prismiq/api.py`

```python
class WidgetPositionUpdate(BaseModel):
    widget_id: str
    position: WidgetPosition

@router.patch("/dashboards/{dashboard_id}/layout")
async def update_dashboard_layout(
    dashboard_id: str,
    positions: list[WidgetPositionUpdate],
    tenant_id: str = Depends(get_tenant_id),
    user_id: str | None = Depends(get_user_id),
) -> dict[str, str]:
    """Update widget positions in a dashboard."""
    dashboard = await engine.dashboards.get_dashboard(dashboard_id, tenant_id)
    if not dashboard:
        raise HTTPException(status_code=404)
    if not can_edit_dashboard(dashboard, user_id):
        raise HTTPException(status_code=403)

    await engine.dashboards.update_widget_positions(dashboard_id, positions, tenant_id)
    return {"status": "ok"}
```

#### Task 4.2: Debounced Layout Updates

**File:** Update `packages/react/src/dashboard/DashboardLayout/DashboardLayout.tsx`

```tsx
export function DashboardLayout({
  widgets,
  editable,
  onLayoutChange,
  ...
}: DashboardLayoutProps): JSX.Element {
  const { updateWidgetPositions } = useDashboardMutations();
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Debounce layout saves
  const debouncedSave = useDebouncedCallback(
    async (positions: WidgetPositionUpdate[]) => {
      setSaveStatus("saving");
      try {
        await updateWidgetPositions(dashboardId, positions);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    500
  );

  const handleLayoutChange = (layout: Layout[]) => {
    const positions = layout.map(item => ({
      widget_id: item.i,
      position: { x: item.x, y: item.y, w: item.w, h: item.h },
    }));
    debouncedSave(positions);
    onLayoutChange?.(layout);
  };

  return (
    <>
      {editable && <AutoSaveIndicator status={saveStatus} />}
      <ResponsiveGridLayout
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        isDraggable={editable}
        isResizable={editable}
        ...
      />
    </>
  );
}
```

#### Task 4.3: Auto-save Indicator

**File:** `packages/react/src/components/AutoSaveIndicator/AutoSaveIndicator.tsx`

```tsx
interface AutoSaveIndicatorProps {
  status: "saved" | "saving" | "error";
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps): JSX.Element {
  return (
    <div className={cn("auto-save-indicator", status)}>
      {status === "saved" && <CheckIcon />}
      {status === "saving" && <Spinner size="sm" />}
      {status === "error" && <AlertIcon />}
      <span>
        {status === "saved" && "Saved"}
        {status === "saving" && "Saving..."}
        {status === "error" && "Error saving"}
      </span>
    </div>
  );
}
```

**Deliverable:** Layout changes persist automatically with visual feedback.

---

### Phase 5: Advanced Features (Future)

#### 5.1 Drill-down & Cross-filtering
- Click on chart element → filter other widgets
- Navigate to detail view

#### 5.2 Saved Queries & Templates
- Save frequently used queries
- Dashboard templates

#### 5.3 Scheduled Reports
- Email/Slack delivery
- PDF export

#### 5.4 Custom SQL Mode
- Raw SQL with sandboxing
- Parameter support

#### 5.5 Row-Level Security
- Filter query results by user context
- Column-level permissions

---

## Database Schema Summary

### Prismiq Metadata Tables

| Table | Purpose |
|-------|---------|
| `prismiq_dashboards` | Dashboard definitions with tenant isolation |
| `prismiq_widgets` | Widget definitions linked to dashboards |
| `prismiq_schema_config` | Per-tenant schema customization |
| `prismiq_saved_queries` | Saved query library |

### Multi-Tenancy: Row-Level Isolation

All tables have `tenant_id` column. Every query filters by tenant_id:

```sql
SELECT * FROM prismiq_dashboards WHERE tenant_id = $1
```

This approach:
- Works with any PostgreSQL (no special config)
- Simple to implement and debug
- Performant with proper indexes
- Developer controls tenant_id extraction

---

## Component Inventory

### Python Backend Modules

| Module | Purpose | Status |
|--------|---------|--------|
| `types.py` | Pydantic models | ✅ Complete |
| `schema.py` | Schema introspection | ✅ Complete |
| `query.py` | SQL query builder | ✅ Complete |
| `executor.py` | Query execution | ✅ Complete |
| `api.py` | FastAPI routes | ✅ Complete |
| `engine.py` | Main engine class | ✅ Complete |
| `dashboards.py` | Dashboard models | ✅ Complete |
| `dashboard_store.py` | In-memory store | ✅ Complete |
| `cache.py` | Redis caching | ✅ Complete |
| `metrics.py` | Prometheus metrics | ✅ Complete |
| `persistence/tables.py` | SQLAlchemy tables | 🔲 Phase 1 |
| `persistence/postgres_store.py` | PostgreSQL store | 🔲 Phase 1 |
| `persistence/setup.py` | Table creation | 🔲 Phase 1 |
| `auth.py` | AuthContext protocol | 🔲 Phase 2 |
| `permissions.py` | Permission checks | 🔲 Phase 2 |

### React Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `PrismiqProvider` | Context + client | ✅ Complete |
| `QueryBuilder` | Visual query UI | ✅ Complete |
| `Dashboard` | Embed component | ✅ Complete |
| `DashboardLayout` | Grid layout | ✅ Complete |
| `Widget` | Widget container | ✅ Complete |
| `FilterBar` | Dashboard filters | ✅ Complete |
| `MetricCard` | KPI display | ✅ Complete |
| `BarChart` | Bar visualization | ✅ Complete |
| `LineChart` | Line visualization | ✅ Complete |
| `PieChart` | Pie/donut | ✅ Complete |
| `AreaChart` | Area visualization | ✅ Complete |
| `ScatterChart` | Scatter plot | ✅ Complete |
| `ResultsTable` | Data grid | ✅ Complete |
| `DashboardList` | Dashboard manager | 🔲 Phase 3 |
| `DashboardDialog` | Create/edit form | 🔲 Phase 3 |
| `WidgetEditor` | Widget wizard | 🔲 Phase 3 |
| `WidgetTypeSelector` | Type picker | 🔲 Phase 3 |
| `VisualizationConfig` | Chart config UI | 🔲 Phase 3 |
| `AutoSaveIndicator` | Save status | 🔲 Phase 4 |

---

## Implementation Priority

| Phase | Effort | Business Value | Priority |
|-------|--------|----------------|----------|
| Phase 1: Database Persistence | Medium | Critical | 🔴 P0 |
| Phase 2: Multi-Tenancy | Low | Critical | 🔴 P0 |
| Phase 3: Dashboard Management UI | High | Critical | 🔴 P0 |
| Phase 4: Layout Persistence | Low | High | 🟡 P1 |
| Phase 5: Advanced Features | High | Medium | 🟢 P2 |

---

## Developer Integration Guide

### Python Backend Integration

```python
from dataclasses import dataclass
from fastapi import FastAPI, Request, Depends, HTTPException
from prismiq import PrismiqEngine, create_router


# ============================================
# Step 1: Define your AuthContext
# ============================================

@dataclass
class MyAuthContext:
    """Your auth context - add any fields your app needs."""
    tenant_id: str
    user_id: str | None
    # Optional: add extra fields
    email: str | None = None
    roles: list[str] | None = None


# ============================================
# Step 2: Create your auth dependency
# ============================================

async def get_auth_context(request: Request) -> MyAuthContext:
    """
    Single dependency that handles all auth.
    Called ONCE per request - no duplicate processing.
    """
    # Your auth logic here (Clerk, Auth0, custom JWT, etc.)
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Example: verify with your auth provider
    user = await your_auth_system.verify(token)

    return MyAuthContext(
        tenant_id=user.org_id,
        user_id=user.id,
        email=user.email,
        roles=user.roles,
    )


# ============================================
# Step 3: Create Prismiq engine and router
# ============================================

engine = PrismiqEngine(
    database_url="postgresql://...",
    persist_dashboards=True,
)

router = create_router(
    engine,
    get_auth_context=get_auth_context,  # Pass your dependency
)

app = FastAPI()
app.include_router(router, prefix="/api/prismiq")
```

### Auth Provider Examples

**Clerk:**
```python
from clerk_backend_api import Clerk

clerk = Clerk(api_key="sk_...")

async def get_auth_context(request: Request) -> MyAuthContext:
    session = await clerk.sessions.verify(
        request.headers.get("Authorization", "").replace("Bearer ", "")
    )
    return MyAuthContext(
        tenant_id=session.org_id,
        user_id=session.user_id,
    )
```

**Custom JWT:**
```python
from jose import jwt

def get_auth_context(request: Request) -> MyAuthContext:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return MyAuthContext(
        tenant_id=payload["tenant_id"],
        user_id=payload["sub"],
    )
```

**API Key (no user context):**
```python
async def get_auth_context(request: Request) -> MyAuthContext:
    api_key = request.headers.get("X-API-Key")
    tenant = await lookup_tenant_by_api_key(api_key)
    return MyAuthContext(
        tenant_id=tenant.id,
        user_id=None,  # No user context
    )
```

### React Frontend Integration

```tsx
import { PrismiqProvider, Dashboard, DashboardList } from "@prismiq/react";

function App() {
  // Your auth hook
  const { tenantId, userId } = useAuth();

  return (
    <PrismiqProvider
      endpoint="/api/prismiq"
      tenantId={tenantId}
      userId={userId}
    >
      <Routes>
        <Route path="/dashboards" element={<DashboardList />} />
        <Route path="/dashboards/:id" element={<Dashboard editable />} />
      </Routes>
    </PrismiqProvider>
  );
}
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Dashboards survive backend restart
- [ ] Widgets persist with their dashboards
- [ ] `auto_create_tables=True` creates prismiq_* tables
- [ ] All existing tests pass with PostgreSQL store

### Phase 2 Complete When:
- [ ] `AuthContext` protocol defined with `tenant_id` and `user_id`
- [ ] `create_router` accepts single `get_auth_context` dependency
- [ ] All endpoints use `auth: AuthContext = Depends(get_auth_context)`
- [ ] Tenant A cannot see Tenant B's dashboards
- [ ] Permission checks enforce owner_id
- [ ] React SDK sends X-Tenant-ID and X-User-ID headers

### Phase 3 Complete When:
- [ ] User can create new dashboard via DashboardDialog
- [ ] User can add widgets via WidgetEditor
- [ ] User can edit existing widgets
- [ ] User can delete dashboards and widgets
- [ ] QueryBuilder integrates with WidgetEditor

### Phase 4 Complete When:
- [ ] Layout drag-drop persists to database
- [ ] AutoSaveIndicator shows status
- [ ] Optimistic updates feel instant
