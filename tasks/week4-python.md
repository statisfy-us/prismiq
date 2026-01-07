# Week 4: Python Backend - Dashboard System

## Overview
Build the dashboard and widget models, CRUD APIs, global filters, and import/export functionality.

## Prerequisites
- Week 3 complete (timeseries, transforms, trends)

## Validation Command
```bash
make check
```

---

## Task 1: Dashboard and Widget Models

**Goal:** Create Pydantic models for dashboards, widgets, and filters.

**File:** `packages/python/prismiq/dashboards.py`

**Models:**

```python
from pydantic import BaseModel, ConfigDict, Field
from enum import Enum
from datetime import datetime
from typing import Any

class WidgetType(str, Enum):
    """Types of dashboard widgets."""
    METRIC = "metric"
    BAR_CHART = "bar_chart"
    LINE_CHART = "line_chart"
    AREA_CHART = "area_chart"
    PIE_CHART = "pie_chart"
    SCATTER_CHART = "scatter_chart"
    TABLE = "table"
    TEXT = "text"

class WidgetPosition(BaseModel):
    """Widget position in grid layout."""
    model_config = ConfigDict(strict=True)

    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: int = Field(ge=1)
    h: int = Field(ge=1)

class WidgetConfig(BaseModel):
    """Widget-specific configuration."""
    model_config = ConfigDict(strict=True)

    # Chart-specific options
    x_axis: str | None = None
    y_axis: list[str] | None = None
    orientation: str | None = None
    stacked: bool | None = None
    show_legend: bool | None = None
    show_data_labels: bool | None = None
    colors: list[str] | None = None

    # MetricCard options
    format: str | None = None
    trend_comparison: str | None = None

    # Table options
    page_size: int | None = None
    sortable: bool | None = None

    # Text options
    content: str | None = None
    markdown: bool | None = None

class Widget(BaseModel):
    """A dashboard widget."""
    model_config = ConfigDict(strict=True)

    id: str
    type: WidgetType
    title: str
    query: QueryDefinition | None = None  # None for text widgets
    position: WidgetPosition
    config: WidgetConfig = WidgetConfig()
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DashboardFilterType(str, Enum):
    """Types of dashboard filters."""
    DATE_RANGE = "date_range"
    SELECT = "select"
    MULTI_SELECT = "multi_select"
    TEXT = "text"
    NUMBER_RANGE = "number_range"

class DashboardFilter(BaseModel):
    """A global dashboard filter."""
    model_config = ConfigDict(strict=True)

    id: str
    type: DashboardFilterType
    label: str
    field: str  # Column to filter
    table: str | None = None  # Table (if ambiguous)

    # Type-specific options
    default_value: Any | None = None
    options: list[dict[str, str]] | None = None  # For select types
    date_preset: str | None = None  # For date_range type

class DashboardLayout(BaseModel):
    """Dashboard layout configuration."""
    model_config = ConfigDict(strict=True)

    columns: int = 12
    row_height: int = 50
    margin: tuple[int, int] = (10, 10)
    compact_type: str | None = "vertical"

class Dashboard(BaseModel):
    """A complete dashboard."""
    model_config = ConfigDict(strict=True)

    id: str
    name: str
    description: str | None = None
    layout: DashboardLayout = DashboardLayout()
    widgets: list[Widget] = []
    filters: list[DashboardFilter] = []
    owner_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Permissions
    is_public: bool = False
    allowed_viewers: list[str] = []

class DashboardCreate(BaseModel):
    """DTO for creating a dashboard."""
    model_config = ConfigDict(strict=True)

    name: str
    description: str | None = None
    layout: DashboardLayout | None = None

class DashboardUpdate(BaseModel):
    """DTO for updating a dashboard."""
    model_config = ConfigDict(strict=True)

    name: str | None = None
    description: str | None = None
    layout: DashboardLayout | None = None
    filters: list[DashboardFilter] | None = None
    is_public: bool | None = None
    allowed_viewers: list[str] | None = None

class WidgetCreate(BaseModel):
    """DTO for creating a widget."""
    model_config = ConfigDict(strict=True)

    type: WidgetType
    title: str
    query: QueryDefinition | None = None
    position: WidgetPosition
    config: WidgetConfig | None = None

class WidgetUpdate(BaseModel):
    """DTO for updating a widget."""
    model_config = ConfigDict(strict=True)

    title: str | None = None
    query: QueryDefinition | None = None
    position: WidgetPosition | None = None
    config: WidgetConfig | None = None
```

**Tests:** `packages/python/tests/test_dashboards.py`
- Test model creation and validation
- Test widget position validation
- Test serialization/deserialization

---

## Task 2: Dashboard Storage

**Goal:** Create in-memory storage for dashboards (can be replaced with database later).

**File:** `packages/python/prismiq/dashboard_store.py`

**Class:**

```python
from typing import Protocol
import uuid

class DashboardStore(Protocol):
    """Abstract dashboard storage interface."""

    async def list_dashboards(self, owner_id: str | None = None) -> list[Dashboard]:
        """List all dashboards, optionally filtered by owner."""
        ...

    async def get_dashboard(self, dashboard_id: str) -> Dashboard | None:
        """Get a dashboard by ID."""
        ...

    async def create_dashboard(self, dashboard: DashboardCreate, owner_id: str | None = None) -> Dashboard:
        """Create a new dashboard."""
        ...

    async def update_dashboard(self, dashboard_id: str, update: DashboardUpdate) -> Dashboard | None:
        """Update a dashboard."""
        ...

    async def delete_dashboard(self, dashboard_id: str) -> bool:
        """Delete a dashboard."""
        ...

    async def add_widget(self, dashboard_id: str, widget: WidgetCreate) -> Widget | None:
        """Add a widget to a dashboard."""
        ...

    async def update_widget(self, widget_id: str, update: WidgetUpdate) -> Widget | None:
        """Update a widget."""
        ...

    async def delete_widget(self, widget_id: str) -> bool:
        """Delete a widget."""
        ...

    async def duplicate_widget(self, widget_id: str) -> Widget | None:
        """Duplicate a widget."""
        ...

class InMemoryDashboardStore:
    """In-memory implementation of DashboardStore."""

    def __init__(self) -> None:
        self._dashboards: dict[str, Dashboard] = {}
        self._widget_to_dashboard: dict[str, str] = {}

    # Implement all methods...
```

**Requirements:**
- Thread-safe operations
- Generate UUIDs for new items
- Update timestamps on modifications
- Track widget-to-dashboard mapping for updates/deletes

**Tests:** `packages/python/tests/test_dashboard_store.py`
- Test CRUD operations
- Test widget operations
- Test listing with filters

---

## Task 3: Filter Merging Logic

**Goal:** Create utilities to merge dashboard filters with widget queries.

**File:** `packages/python/prismiq/filter_merge.py`

**Functions:**

```python
from prismiq.types import QueryDefinition, FilterDefinition
from prismiq.dashboards import DashboardFilter

class FilterValue(BaseModel):
    """Runtime value for a dashboard filter."""
    model_config = ConfigDict(strict=True)

    filter_id: str
    value: Any

def merge_filters(
    query: QueryDefinition,
    dashboard_filters: list[DashboardFilter],
    filter_values: list[FilterValue],
    schema: DatabaseSchema,
) -> QueryDefinition:
    """Merge dashboard filter values into a widget query.

    Args:
        query: The widget's base query
        dashboard_filters: Dashboard filter definitions
        filter_values: Current filter values from UI
        schema: Database schema for column lookup

    Returns:
        New QueryDefinition with filters merged
    """

def filter_to_query_filter(
    dashboard_filter: DashboardFilter,
    value: FilterValue,
) -> FilterDefinition | None:
    """Convert a dashboard filter to a query filter.

    Returns None if the filter shouldn't be applied (e.g., "all" selected).
    """

def get_applicable_filters(
    query: QueryDefinition,
    dashboard_filters: list[DashboardFilter],
    schema: DatabaseSchema,
) -> list[DashboardFilter]:
    """Get filters that apply to a specific query.

    Only returns filters whose field exists in the query's tables.
    """

def resolve_date_filter(
    filter_def: DashboardFilter,
    value: FilterValue,
) -> tuple[date, date] | None:
    """Resolve a date range filter value to concrete dates."""
```

**Requirements:**
- Only merge filters whose columns exist in the query
- Handle date presets ("last_30_days", etc.)
- Deep copy queries (don't mutate originals)
- Handle multi-select values

**Tests:** `packages/python/tests/test_filter_merge.py`
- Test date filter merging
- Test select filter merging
- Test column existence checking
- Test multi-value filters

---

## Task 4: Dashboard API Routes

**Goal:** Create REST API for dashboard CRUD operations.

**File:** Update `packages/python/prismiq/api.py`

**Endpoints:**

```python
# Dashboard CRUD
@router.get("/dashboards")
async def list_dashboards(owner_id: str | None = None) -> list[Dashboard]:
    """List all dashboards."""

@router.post("/dashboards")
async def create_dashboard(data: DashboardCreate) -> Dashboard:
    """Create a new dashboard."""

@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str) -> Dashboard:
    """Get a dashboard by ID."""

@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, data: DashboardUpdate) -> Dashboard:
    """Update a dashboard."""

@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str) -> dict:
    """Delete a dashboard."""

# Widget CRUD
@router.get("/dashboards/{dashboard_id}/widgets")
async def list_widgets(dashboard_id: str) -> list[Widget]:
    """List widgets in a dashboard."""

@router.post("/dashboards/{dashboard_id}/widgets")
async def add_widget(dashboard_id: str, data: WidgetCreate) -> Widget:
    """Add a widget to a dashboard."""

@router.put("/widgets/{widget_id}")
async def update_widget(widget_id: str, data: WidgetUpdate) -> Widget:
    """Update a widget."""

@router.delete("/widgets/{widget_id}")
async def delete_widget(widget_id: str) -> dict:
    """Delete a widget."""

@router.post("/widgets/{widget_id}/duplicate")
async def duplicate_widget(widget_id: str) -> Widget:
    """Duplicate a widget."""

# Dashboard execution
@router.post("/dashboards/{dashboard_id}/execute")
async def execute_dashboard(
    dashboard_id: str,
    filter_values: list[FilterValue] = [],
) -> dict[str, QueryResult]:
    """Execute all widget queries with merged filters.

    Returns dict mapping widget_id to QueryResult.
    """
```

**Requirements:**
- Return 404 for missing dashboards/widgets
- Return 400 for invalid data
- Execute dashboard runs all widget queries in parallel

**Tests:** Update `packages/python/tests/test_api.py`
- Test all dashboard endpoints
- Test all widget endpoints
- Test dashboard execution

---

## Task 5: Import/Export

**Goal:** Add dashboard import/export as JSON.

**File:** Update `packages/python/prismiq/api.py`

**Endpoints:**

```python
@router.get("/dashboards/{dashboard_id}/export")
async def export_dashboard(dashboard_id: str) -> dict:
    """Export dashboard as JSON-compatible dict.

    Includes full dashboard definition with all widgets.
    Excludes server-side IDs and timestamps for portability.
    """

@router.post("/dashboards/import")
async def import_dashboard(data: dict) -> Dashboard:
    """Import a dashboard from JSON.

    Generates new IDs for dashboard and all widgets.
    Sets timestamps to current time.
    """

class DashboardExport(BaseModel):
    """Export format for dashboards."""
    model_config = ConfigDict(strict=True)

    version: str = "1.0"
    name: str
    description: str | None = None
    layout: DashboardLayout
    widgets: list[dict]  # Widget data without IDs
    filters: list[DashboardFilter]
```

**Requirements:**
- Strip IDs and timestamps on export
- Generate new IDs on import
- Include version for future compatibility
- Validate imported data

**Tests:** Add to `packages/python/tests/test_api.py`
- Test export format
- Test import creates new dashboard
- Test round-trip (export then import)

---

## Task 6: Engine Integration

**Goal:** Integrate dashboard functionality into PrismiqEngine.

**File:** Update `packages/python/prismiq/engine.py`

**Add to PrismiqEngine:**

```python
class PrismiqEngine:
    def __init__(
        self,
        database_url: str,
        exposed_tables: list[str] | None = None,
        schema_config: SchemaConfig | None = None,
        dashboard_store: DashboardStore | None = None,  # NEW
        query_timeout: float = 30.0,
        max_rows: int = 10000,
    ):
        self._dashboard_store = dashboard_store or InMemoryDashboardStore()

    @property
    def dashboards(self) -> DashboardStore:
        """Get the dashboard store."""
        return self._dashboard_store

    async def execute_dashboard(
        self,
        dashboard_id: str,
        filter_values: list[FilterValue] | None = None,
    ) -> dict[str, QueryResult]:
        """Execute all widgets in a dashboard."""

    async def export_dashboard(self, dashboard_id: str) -> dict:
        """Export a dashboard to JSON."""

    async def import_dashboard(self, data: dict, owner_id: str | None = None) -> Dashboard:
        """Import a dashboard from JSON."""
```

**Update `__init__.py` exports:**
- Dashboard, DashboardCreate, DashboardUpdate
- Widget, WidgetCreate, WidgetUpdate, WidgetType, WidgetConfig, WidgetPosition
- DashboardFilter, DashboardFilterType, FilterValue
- DashboardLayout, DashboardExport
- DashboardStore, InMemoryDashboardStore
- merge_filters, filter_to_query_filter

---

## Completion Criteria

All tasks complete when:
- [ ] Dashboard and Widget models work correctly
- [ ] In-memory store handles all CRUD operations
- [ ] Filter merging works for all filter types
- [ ] API endpoints work for dashboards and widgets
- [ ] Import/export preserves dashboard content
- [ ] Engine provides high-level dashboard methods
- [ ] `make check` passes (lint, types, tests)
