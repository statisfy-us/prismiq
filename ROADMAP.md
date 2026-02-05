# Prismiq Development Roadmap

## Product Vision

Prismiq is an **embeddable analytics SDK** that lets developers add dashboards and reports to their applications.

**Key Differentiators:**
- React components (not iframe)
- Direct PostgreSQL access (no semantic layer required)
- Full theming/white-label support
- Multi-tenant by design
- Auth-agnostic: plug in your existing auth
- Open source

---

## Current Implementation Status

### Core Features (Complete)

| Category | Feature | Status |
|----------|---------|--------|
| **Schema** | PostgreSQL introspection | ✅ Complete |
| **Schema** | Relationship detection (FK inference) | ✅ Complete |
| **Schema** | Display names, hidden columns | ✅ Complete |
| **Query** | Visual query builder UI | ✅ Complete |
| **Query** | SQL generation with validation | ✅ Complete |
| **Query** | Joins, filters, aggregations | ✅ Complete |
| **Query** | Time series bucketing | ✅ Complete |
| **Charts** | 8 widget types (metric, bar, line, area, pie, scatter, table, text) | ✅ Complete |
| **Dashboard** | CRUD API with PostgreSQL persistence | ✅ Complete |
| **Dashboard** | Widget CRUD API with persistence | ✅ Complete |
| **Dashboard** | Dashboard filters (date, select, multi-select) | ✅ Complete |
| **Dashboard** | Filter merge with widget queries | ✅ Complete |
| **Dashboard** | Import/Export JSON | ✅ Complete |
| **Dashboard** | react-grid-layout integration | ✅ Complete |
| **Dashboard** | Auto-refresh support | ✅ Complete |
| **Dashboard** | Layout persistence with auto-save | ✅ Complete |
| **Multi-tenant** | Row-level tenant isolation | ✅ Complete |
| **Multi-tenant** | AuthContext protocol | ✅ Complete |
| **Multi-tenant** | Permission enforcement (view/edit/delete) | ✅ Complete |
| **UI** | Dashboard list component | ✅ Complete |
| **UI** | Dashboard create/edit dialog | ✅ Complete |
| **UI** | Widget editor with type selector | ✅ Complete |
| **UI** | Saved query picker | ✅ Complete |
| **UI** | Auto-save indicator | ✅ Complete |
| **Advanced** | Cross-filtering between widgets | ✅ Complete |
| **Advanced** | Saved queries library | ✅ Complete |
| **Production** | Redis caching | ✅ Complete |
| **Production** | Health checks (liveness, readiness) | ✅ Complete |
| **Production** | Prometheus metrics | ✅ Complete |

### Remaining Work (Phase 5 - Enterprise Features)

| Feature | Status | Priority |
|---------|--------|----------|
| Scheduled reports (email/Slack) | 🔲 Not started | P2 |
| PDF export | 🔲 Not started | P2 |
| Custom SQL mode with sandboxing | 🔲 Not started | P2 |
| Row-level security (RLS) | 🔲 Not started | P2 |
| Dashboard templates | 🔲 Not started | P3 |

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

## Completed Phases

### Phase 1: Database Persistence ✅

**Status: COMPLETE**

All dashboards, widgets, and saved queries persist to PostgreSQL with automatic table creation.

**Key Files:**
- `packages/python/prismiq/persistence/tables.py` - SQLAlchemy table definitions
- `packages/python/prismiq/persistence/postgres_store.py` - PostgreSQL dashboard store
- `packages/python/prismiq/persistence/saved_query_store.py` - Saved query store
- `packages/python/prismiq/persistence/setup.py` - Table creation utilities
- `packages/python/prismiq/persistence/schema.sql` - SQL schema

**Capabilities:**
- ✅ Dashboards survive backend restart
- ✅ Widgets persist with their dashboards (cascade delete)
- ✅ `auto_create_tables=True` creates prismiq_* tables on startup
- ✅ Transactional batch updates for layout changes
- ✅ Saved queries with sharing (public/private)

---

### Phase 2: Multi-Tenancy ✅

**Status: COMPLETE**

Full row-level tenant isolation with developer-controlled authentication.

**Key Files:**
- `packages/python/prismiq/auth.py` - AuthContext protocol + header auth factory
- `packages/python/prismiq/permissions.py` - Permission checking functions
- `packages/python/prismiq/api.py` - Full API router with auth integration

**Capabilities:**
- ✅ `AuthContext` protocol with `tenant_id` and `user_id`
- ✅ `create_router()` accepts single `get_auth_context` dependency
- ✅ `create_header_auth_dependency()` factory for X-Tenant-ID / X-User-ID
- ✅ All endpoints use `auth: AuthContext = Depends(get_auth_context)`
- ✅ Tenant A cannot see Tenant B's dashboards
- ✅ Permission checks enforce owner_id (view/edit/delete)
- ✅ React SDK sends X-Tenant-ID and X-User-ID headers

---

### Phase 3: Dashboard Management UI ✅

**Status: COMPLETE**

Full UI for creating, editing, and managing dashboards and widgets.

**Key Files:**
- `packages/react/src/dashboard/DashboardList/DashboardList.tsx` - Dashboard grid
- `packages/react/src/dashboard/DashboardList/DashboardDialog.tsx` - Create/edit form
- `packages/react/src/dashboard/DashboardEditor/WidgetEditor.tsx` - Widget wizard
- `packages/react/src/dashboard/DashboardEditor/WidgetPalette.tsx` - Widget type selector
- `packages/react/src/components/SavedQueryPicker/SavedQueryPicker.tsx` - Query selection

**Capabilities:**
- ✅ User can create new dashboard via DashboardDialog
- ✅ User can add widgets via WidgetEditor (8 widget types)
- ✅ User can edit existing widgets
- ✅ User can delete dashboards and widgets
- ✅ SavedQueryPicker integrates with WidgetEditor
- ✅ Widget configuration per type (charts, tables, metrics, text)

---

### Phase 4: Layout Persistence ✅

**Status: COMPLETE**

Layout changes persist automatically with visual feedback.

**Key Files:**
- `packages/react/src/hooks/useDebouncedLayoutSave.ts` - Debounced layout save hook
- `packages/react/src/components/AutoSaveIndicator/AutoSaveIndicator.tsx` - Status UI
- `packages/python/prismiq/api.py` - Batch position update endpoint

**Capabilities:**
- ✅ Layout drag-drop persists to database
- ✅ Debounced saves (500ms default) prevent excessive API calls
- ✅ AutoSaveIndicator shows status (pending/saving/saved/error)
- ✅ Optimistic updates feel instant
- ✅ Transactional batch position updates

---

### Phase 5: Advanced Features (Partial) ⚠️

**Status: 40% COMPLETE**

#### Completed:
- ✅ **Cross-filtering** - Click on chart element → filter other widgets
  - `packages/react/src/context/CrossFilterContext.tsx`
  - Integrated into BarChart, LineChart, AreaChart, PieChart

- ✅ **Saved Queries** - Save and reuse frequently used queries
  - `packages/python/prismiq/persistence/saved_query_store.py`
  - `packages/react/src/hooks/useSavedQueries.ts`
  - `packages/react/src/components/SavedQueryPicker/SavedQueryPicker.tsx`

#### Not Started:
- 🔲 **Scheduled Reports** - Email/Slack delivery (requires job infrastructure)
- 🔲 **PDF Export** - Export dashboards as PDF
- 🔲 **Custom SQL Mode** - Raw SQL with sandboxing and parameters
- 🔲 **Row-Level Security** - Filter query results by user context
- 🔲 **Dashboard Templates** - Pre-built dashboard templates

---

## Database Schema

### Prismiq Metadata Tables

| Table | Purpose |
|-------|---------|
| `prismiq_dashboards` | Dashboard definitions with tenant isolation |
| `prismiq_widgets` | Widget definitions linked to dashboards |
| `prismiq_schema_config` | Per-tenant schema customization |
| `prismiq_saved_queries` | Saved query library |

### Schema Definition

```sql
CREATE TABLE IF NOT EXISTS prismiq_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{"columns": 12, "row_height": 50}',
    filters JSONB NOT NULL DEFAULT '[]',
    owner_id VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_viewers TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_dashboard_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS prismiq_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES prismiq_dashboards(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    query JSONB,
    position JSONB NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prismiq_saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    owner_id VARCHAR(255),
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_query_name_per_tenant UNIQUE (tenant_id, name)
);
```

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
| `persistence/tables.py` | SQLAlchemy tables | ✅ Complete |
| `persistence/postgres_store.py` | PostgreSQL store | ✅ Complete |
| `persistence/saved_query_store.py` | Saved query store | ✅ Complete |
| `persistence/setup.py` | Table creation | ✅ Complete |
| `auth.py` | AuthContext protocol | ✅ Complete |
| `permissions.py` | Permission checks | ✅ Complete |

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
| `DashboardList` | Dashboard manager | ✅ Complete |
| `DashboardDialog` | Create/edit form | ✅ Complete |
| `WidgetEditor` | Widget wizard | ✅ Complete |
| `WidgetPalette` | Type picker | ✅ Complete |
| `SavedQueryPicker` | Query selection | ✅ Complete |
| `AutoSaveIndicator` | Save status | ✅ Complete |
| `CrossFilterContext` | Cross-filtering | ✅ Complete |

### React Hooks

| Hook | Purpose | Status |
|------|---------|--------|
| `useSchema` | Fetch database schema | ✅ Complete |
| `useQuery` | Execute queries | ✅ Complete |
| `useDashboards` | List dashboards | ✅ Complete |
| `useDashboard` | Single dashboard with mutations | ✅ Complete |
| `useDashboardMutations` | CRUD operations | ✅ Complete |
| `useSavedQueries` | Saved query management | ✅ Complete |
| `useDebouncedLayoutSave` | Layout persistence | ✅ Complete |
| `useCrossFilter` | Cross-filter state | ✅ Complete |

---

## Developer Integration Guide

### Python Backend Integration

```python
from dataclasses import dataclass
from fastapi import FastAPI, Request, Depends, HTTPException
from prismiq import PrismiqEngine, create_router


# Step 1: Define your AuthContext
@dataclass
class MyAuthContext:
    tenant_id: str
    user_id: str | None


# Step 2: Create your auth dependency
async def get_auth_context(request: Request) -> MyAuthContext:
    # Your auth logic here (Clerk, Auth0, custom JWT, etc.)
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user = await your_auth_system.verify(token)
    return MyAuthContext(
        tenant_id=user.org_id,
        user_id=user.id,
    )


# Step 3: Create engine and router
engine = PrismiqEngine(
    database_url="postgresql://...",
    persist_dashboards=True,
)

router = create_router(engine, get_auth_context=get_auth_context)

app = FastAPI()
app.include_router(router, prefix="/api/prismiq")
```

### React Frontend Integration

```tsx
import { PrismiqProvider, Dashboard, DashboardList } from "@prismiq/react";

function App() {
  const { tenantId, userId } = useAuth(); // Your auth hook

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

### Phase 1: Database Persistence ✅
- [x] Dashboards survive backend restart
- [x] Widgets persist with their dashboards
- [x] `auto_create_tables=True` creates prismiq_* tables
- [x] All existing tests pass with PostgreSQL store

### Phase 2: Multi-Tenancy ✅
- [x] `AuthContext` protocol defined with `tenant_id` and `user_id`
- [x] `create_router` accepts single `get_auth_context` dependency
- [x] All endpoints use `auth: AuthContext = Depends(get_auth_context)`
- [x] Tenant A cannot see Tenant B's dashboards
- [x] Permission checks enforce owner_id
- [x] React SDK sends X-Tenant-ID and X-User-ID headers

### Phase 3: Dashboard Management UI ✅
- [x] User can create new dashboard via DashboardDialog
- [x] User can add widgets via WidgetEditor
- [x] User can edit existing widgets
- [x] User can delete dashboards and widgets
- [x] QueryBuilder integrates with WidgetEditor

### Phase 4: Layout Persistence ✅
- [x] Layout drag-drop persists to database
- [x] AutoSaveIndicator shows status
- [x] Optimistic updates feel instant

### Phase 5: Advanced Features (Partial)
- [x] Cross-filtering between widgets
- [x] Saved queries library
- [ ] Scheduled reports
- [ ] PDF export
- [ ] Custom SQL mode
- [ ] Row-level security

---

## Future Roadmap (Phase 5+)

### P2 - High Value, Medium Effort
| Feature | Description | Effort |
|---------|-------------|--------|
| PDF Export | Export dashboards as PDF | Medium |
| Custom SQL | Raw SQL with sandboxing | Medium |
| RLS | Row-level security by user context | High |

### P3 - Nice to Have
| Feature | Description | Effort |
|---------|-------------|--------|
| Scheduled Reports | Email/Slack delivery | High |
| Dashboard Templates | Pre-built templates | Low |
| Column Permissions | Hide columns per user | Medium |
| Drill-down | Navigate to detail views | Medium |
