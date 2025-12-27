# Prismiq Development Roadmap

## Product Vision

Prismiq is an **embeddable analytics platform** that lets developers add dashboards and reports to their applications. It replaces tools like Reveal BI, Metabase Embedded, and Looker Embedded.

**Key Differentiators:**
- React components (not iframe)
- Direct PostgreSQL access (no semantic layer required)
- Full theming/white-label support
- Open source

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Customer Application                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   <AnalyticsProvider endpoint="..." theme={...}>                │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│     │ QueryBuilder│  │  Dashboard  │  │   Chart     │          │
│     │  Component  │  │  Component  │  │  Component  │          │
│     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│            │                │                │                  │
│            └────────────────┴────────────────┘                  │
│                             │                                   │
│                    @prismiq/react SDK                           │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTP/REST
┌─────────────────────────────┼───────────────────────────────────┐
│                    Prismiq Backend                              │
│                             │                                   │
│  ┌──────────────────────────┴───────────────────────────┐      │
│  │                    FastAPI Routes                     │      │
│  │  /schema  /query/execute  /dashboards  /widgets      │      │
│  └──────────────────────────┬───────────────────────────┘      │
│                             │                                   │
│  ┌──────────────────────────┴───────────────────────────┐      │
│  │                   PrismiqEngine                       │      │
│  │  SchemaIntrospector │ QueryBuilder │ QueryExecutor   │      │
│  └──────────────────────────┬───────────────────────────┘      │
│                             │                                   │
│                      ┌──────┴──────┐                           │
│                      │   asyncpg   │                           │
│                      │ Connection  │                           │
│                      │    Pool     │                           │
│                      └──────┬──────┘                           │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │    PostgreSQL     │
                    │  Customer's DB    │
                    └───────────────────┘
```

---

## Week-by-Week Plan

### Week 1: Foundation (Current)

**Python Backend** (`tasks/week1-python.md`)
| Task | Description | Status |
|------|-------------|--------|
| Project setup | Package structure, dependencies | ✅ |
| Type definitions | Pydantic models for queries, results | ⬜ |
| Schema introspection | Read PostgreSQL metadata | ⬜ |
| Query builder | Convert QueryDefinition → SQL | ⬜ |
| Query executor | Execute with timeout, limits | ⬜ |
| FastAPI routes | REST API endpoints | ⬜ |
| Main engine class | PrismiqEngine orchestrator | ⬜ |
| **Connection pool config** | Pool size, timeouts | ⬜ |
| **Query cancellation** | Cancel long-running queries | ⬜ |

**React SDK** (`tasks/week1-react.md`)
| Task | Description | Status |
|------|-------------|--------|
| Package setup | TypeScript, build config | ✅ |
| Type definitions | TypeScript types matching Python | ⬜ |
| API client | Typed HTTP client | ⬜ |
| Provider/context | AnalyticsProvider | ⬜ |
| Core hooks | useSchema, useQuery | ⬜ |
| **Query cancellation** | AbortController support | ⬜ |

**Deliverable:** Working backend + SDK that can execute queries programmatically.

---

### Week 2: Query Builder UI + Theming

**Python Backend** (`tasks/week2-python.md`)
| Task | Description |
|------|-------------|
| Date/time utilities | Relative dates, date math, formatting |
| Number formatting | Currency, percentages, compact notation |
| **Schema customization** | Display names, hidden columns, column metadata |
| Query validation | Improved error messages |

**React SDK** (`tasks/week2-react.md`)
| Task | Description |
|------|-------------|
| **Theme system** | Colors, fonts, spacing, CSS variables |
| **Theme presets** | Light, dark, system preference |
| SchemaExplorer | Table/column tree with friendly names |
| ColumnSelector | Drag-drop column picker |
| FilterBuilder | Visual filter conditions |
| SortBuilder | Sort controls |
| AggregationPicker | sum, avg, count, etc. |
| QueryBuilder | Container combining above |
| ResultsTable | Paginated data grid with sorting |
| **Event callbacks** | onQueryExecute, onError, onExport |

**Theme Interface:**
```typescript
interface PrismiqTheme {
  name: string;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  fonts: { sans: string; mono: string; };
  radius: { sm: string; md: string; lg: string; };
  chart: { colors: string[]; gridColor: string; };
}
```

**Deliverable:** Visual query builder with theming support.

---

### Week 3: Charts + Visualizations

**Python Backend** (`tasks/week3-python.md`)
| Task | Description |
|------|-------------|
| Time series bucketing | date_trunc, interval grouping |
| Data transformation | Pivot, transpose, fill nulls |
| **Trend calculation** | Period-over-period comparison |

**React SDK** (`tasks/week3-react.md`)
| Task | Description |
|------|-------------|
| ECharts integration | Base chart wrapper |
| **MetricCard** | KPI display with trend indicator |
| BarChart | Vertical, horizontal, stacked variants |
| LineChart | Multi-series support |
| AreaChart | Stacked area |
| PieChart | Pie and donut variants |
| ScatterChart | Scatter/bubble |
| **Chart features** | Data labels, reference lines, legend |
| Chart theme | Colors, fonts from theme |
| useChartData | Transform QueryResult → chart format |
| **Auto chart suggestion** | Recommend chart type from data |

**Chart Props Pattern:**
```tsx
<BarChart
  data={queryResult}
  xAxis="month"
  yAxis={["revenue", "cost"]}  // Multi-series
  orientation="vertical"
  stacked={false}
  showDataLabels={true}
  referenceLines={[{ value: 100000, label: "Target" }]}
/>
```

**Deliverable:** Full chart library with multi-series support.

---

### Week 4: Dashboard System

**Python Backend** (`tasks/week4-python.md`)
| Task | Description |
|------|-------------|
| Dashboard model | id, name, layout, filters, widgets[] |
| Widget model | id, type, query, position, config |
| **Dashboard filter model** | Global filters applied to all widgets |
| Dashboard CRUD API | Create, read, update, delete |
| Widget CRUD API | Add, update, remove widgets |
| **Dashboard import/export** | JSON serialization |
| Permissions (basic) | Owner, viewer roles |

**React SDK** (`tasks/week4-react.md`)
| Task | Description |
|------|-------------|
| react-grid-layout | Drag-drop layout engine |
| DashboardLayout | Grid container |
| Widget | Container with header, actions |
| WidgetHeader | Title, menu (edit, delete, **duplicate**) |
| **DashboardFilters** | Date picker, dropdowns, text input |
| **FilterBar** | Horizontal filter display |
| useDashboard | Load and manage dashboard state |
| useWidget | Individual widget state |
| DashboardEditor | Edit mode with save/cancel |
| Dashboard (embed) | Read-only embed component |
| **Auto-refresh** | Periodic data refresh |
| **Full-screen mode** | Maximize dashboard/widget |
| **Responsive layout** | Mobile-friendly stacking |

**Dashboard Filter System:**
```tsx
// Dashboard with global date filter
<Dashboard
  id="sales-overview"
  filters={[
    { type: "dateRange", field: "order_date", default: "last30days" },
    { type: "select", field: "region", options: regions }
  ]}
  refreshInterval={60000}  // 1 minute
/>
```

**Deliverable:** Drag-drop dashboard builder with global filters.

---

### Week 5: Polish + Production Ready

**Python Backend** (`tasks/week5-python.md`)
| Task | Description |
|------|-------------|
| Redis caching | Query result cache |
| Schema caching | TTL-based schema cache |
| Cache invalidation | Manual + time-based |
| Rate limiting | Request throttling middleware |
| Request logging | Structured logging |
| Health check | `GET /health` endpoint |
| Metrics | Prometheus-compatible metrics |

**React SDK** (`tasks/week5-react.md`)
| Task | Description |
|------|-------------|
| Loading skeletons | Shimmer placeholders |
| Error boundaries | Graceful error handling |
| Empty states | "No data" illustrations |
| Export CSV | Client-side CSV generation |
| Export Excel | XLSX with formatting |
| Export PDF/Print | Print-friendly layout |
| **Undo/redo** | Editor history stack |
| Keyboard navigation | Accessibility shortcuts |
| **SSR support** | Next.js compatibility |
| **Bundle optimization** | Tree-shaking, lazy loading |
| Accessibility audit | WCAG 2.1 AA compliance |

**Documentation:**
| Doc | Description |
|-----|-------------|
| API reference | Auto-generated from OpenAPI |
| Component Storybook | Interactive component docs |
| Getting started | Quick start guide |
| Embedding guide | Integration patterns |
| Theming guide | Customization deep-dive |
| **Next.js guide** | SSR integration |

**Deliverable:** Production-ready with caching, exports, docs.

---

### Week 6: Advanced Features

**Python Backend** (`tasks/week6-python.md`)
| Task | Description |
|------|-------------|
| Calculated fields | Virtual columns with expressions |
| Row-level security | Filter data by user context |
| Multi-tenant pools | Separate pools per tenant |
| Query audit logging | Log all queries with user info |
| **Custom SQL mode** | Raw SQL with sandboxing |

**React SDK** (`tasks/week6-react.md`)
| Task | Description |
|------|-------------|
| Drill-down | Click → navigate to detail |
| Cross-filtering | Click chart → filter others |
| DateRangePicker | Calendar with presets |
| Relative date presets | "Last 7 days", "This month" |
| Saved queries | Save and reuse queries |
| Query history | Recent query list |
| **Custom SQL editor** | Monaco editor with syntax highlighting |
| **Parameterized queries** | Variables in saved queries |

**Deliverable:** Advanced analytics for power users.

---

## Future Roadmap (Post-MVP)

### Phase 2: Collaboration & Sharing
- Dashboard sharing (public links, embed codes)
- Scheduled reports (email/Slack delivery)
- Annotations on charts
- Comments on dashboards
- **Headless mode** (`@prismiq/core` - data only)
- **Internationalization** (i18n, locale-aware formatting)

### Phase 3: Advanced Visualizations
- Maps (choropleth, point maps)
- Pivot tables
- Cohort analysis
- Funnel charts
- Gauges/KPIs (advanced)
- Heatmaps
- Waterfall charts

### Phase 4: Performance & Scale
- Query optimization suggestions
- Materialized view management
- Cursor-based pagination
- WebSocket for live updates
- Background query execution
- Query result streaming

### Phase 5: Enterprise Features
- SSO (SAML, OIDC)
- Column-level security
- Detailed audit logging
- Usage analytics
- White-label admin panel
- Custom branding (logo, favicon)

---

## Component Inventory

### Python Backend Modules

| Module | Purpose | Week |
|--------|---------|------|
| `types.py` | Pydantic models | 1 |
| `schema.py` | Schema introspection | 1 |
| `query.py` | SQL query builder | 1 |
| `executor.py` | Query execution | 1 |
| `api.py` | FastAPI routes | 1 |
| `engine.py` | Main engine class | 1 |
| `dates.py` | Date utilities | 2 |
| `formatting.py` | Number/date formatting | 2 |
| `schema_config.py` | Display names, hidden cols | 2 |
| `transforms.py` | Data transformations | 3 |
| `trends.py` | Trend calculations | 3 |
| `dashboards.py` | Dashboard models/API | 4 |
| `widgets.py` | Widget models/API | 4 |
| `filters.py` | Dashboard filter logic | 4 |
| `cache.py` | Redis caching | 5 |
| `security.py` | Row-level security | 6 |
| `custom_sql.py` | SQL mode handler | 6 |

### React Components

| Component | Purpose | Week |
|-----------|---------|------|
| `AnalyticsProvider` | Context + theme provider | 1 |
| `SchemaExplorer` | Table/column tree | 2 |
| `ColumnSelector` | Column picker | 2 |
| `FilterBuilder` | Filter conditions UI | 2 |
| `SortBuilder` | Sort controls | 2 |
| `QueryBuilder` | Full query UI | 2 |
| `ResultsTable` | Data grid | 2 |
| `MetricCard` | KPI display | 3 |
| `BarChart` | Bar visualization | 3 |
| `LineChart` | Line visualization | 3 |
| `PieChart` | Pie/donut | 3 |
| `AreaChart` | Area visualization | 3 |
| `ScatterChart` | Scatter plot | 3 |
| `Dashboard` | Embed component | 4 |
| `DashboardEditor` | Edit mode | 4 |
| `DashboardFilters` | Global filter bar | 4 |
| `Widget` | Widget container | 4 |
| `DateRangePicker` | Date selection | 6 |
| `CustomSqlEditor` | SQL input | 6 |

### React Hooks

| Hook | Purpose | Week |
|------|---------|------|
| `useAnalytics` | Context access | 1 |
| `useSchema` | Schema data | 1 |
| `useQuery` | Execute queries | 1 |
| `useTheme` | Access theme | 2 |
| `useChartData` | Chart-ready data | 3 |
| `useDashboard` | Dashboard state | 4 |
| `useWidget` | Widget state | 4 |
| `useDashboardFilters` | Filter state | 4 |
| `useExport` | Export functions | 5 |

---

## API Endpoints (Complete)

### Schema API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/schema` | Full database schema |
| GET | `/schema/config` | Schema customizations |
| PUT | `/schema/config` | Update display names |
| GET | `/tables` | Table names only |
| GET | `/tables/{name}` | Single table details |

### Query API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/query/validate` | Validate without executing |
| POST | `/query/execute` | Execute query |
| POST | `/query/preview` | Execute with limit |
| POST | `/query/explain` | EXPLAIN ANALYZE |
| DELETE | `/query/{id}` | Cancel running query |
| POST | `/query/sql` | Execute raw SQL (Week 6) |

### Dashboard API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboards` | List dashboards |
| POST | `/dashboards` | Create dashboard |
| GET | `/dashboards/{id}` | Get dashboard |
| PUT | `/dashboards/{id}` | Update dashboard |
| DELETE | `/dashboards/{id}` | Delete dashboard |
| GET | `/dashboards/{id}/export` | Export as JSON |
| POST | `/dashboards/import` | Import from JSON |

### Widget API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboards/{id}/widgets` | List widgets |
| POST | `/dashboards/{id}/widgets` | Add widget |
| PUT | `/widgets/{id}` | Update widget |
| DELETE | `/widgets/{id}` | Delete widget |
| POST | `/widgets/{id}/duplicate` | Duplicate widget |

### Export API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/export/csv` | Export to CSV |
| POST | `/export/xlsx` | Export to Excel |

### System API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

---

## Dashboard Filter System Design

### Filter Types

```typescript
type DashboardFilter =
  | DateRangeFilter
  | SelectFilter
  | MultiSelectFilter
  | TextFilter
  | NumberRangeFilter;

interface DateRangeFilter {
  type: "dateRange";
  id: string;
  label: string;
  field: string;           // Column to filter
  default?: DatePreset;    // "today", "last7days", "lastMonth"
  allowCustom?: boolean;   // Allow custom date range
}

interface SelectFilter {
  type: "select";
  id: string;
  label: string;
  field: string;
  options: { value: string; label: string; }[];
  default?: string;
}
```

### Filter Application Flow

```
Dashboard loads
    │
    ▼
DashboardFilters component renders
    │
    ▼
User changes filter value
    │
    ▼
useDashboardFilters updates state
    │
    ▼
Each widget's useQuery receives merged filters
    │
    ▼
Queries re-execute with new filters
    │
    ▼
All charts/tables update
```

### Backend Merge Logic

```python
# Widget query + dashboard filters → final query
def merge_filters(widget_query: QueryDefinition, dashboard_filters: list[FilterValue]):
    merged = widget_query.model_copy(deep=True)
    for filter in dashboard_filters:
        # Add filter to query if field exists in query tables
        if filter.field in get_query_columns(merged):
            merged.filters.append(filter.to_filter_definition())
    return merged
```

---

## Testing Strategy

### Backend Testing

| Type | Tool | Coverage |
|------|------|----------|
| Unit | pytest | All modules |
| Integration | pytest + testcontainers | Real PostgreSQL |
| API | pytest + httpx | All endpoints |
| Load | locust | Query performance |

### Frontend Testing

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Vitest | Hooks, utilities |
| Component | Testing Library | All components |
| E2E | Playwright | Critical user flows |
| Visual | Storybook + Chromatic | Regression |
| A11y | axe-core | Accessibility |

---

## Success Metrics

### Week 1 Complete When:
- [ ] Can connect to PostgreSQL and introspect schema
- [ ] Can build and execute queries via API
- [ ] React SDK can fetch schema and execute queries
- [ ] Query cancellation works
- [ ] All tests pass, types check

### Week 4 Complete When:
- [ ] Visual query builder works end-to-end
- [ ] Charts render query results (multi-series)
- [ ] MetricCards show KPIs with trends
- [ ] Dashboards can be created with drag-drop
- [ ] **Dashboard filters work** (date range + dropdowns)
- [ ] Theming changes colors/fonts across all components

### MVP Complete When (Week 5):
- [ ] All above criteria met
- [ ] Export to CSV/Excel works
- [ ] Full documentation available
- [ ] SSR compatible (Next.js works)
- [ ] Bundle size < 200KB gzipped (excluding ECharts)
- [ ] Can embed in a real app with <50 lines of code

### Production Ready When:
- [ ] Caching reduces repeated query load by 80%
- [ ] Errors are user-friendly
- [ ] Accessibility audit passes (WCAG 2.1 AA)
- [ ] Performance: p95 query response < 500ms
- [ ] Security review complete
- [ ] Load tested to 100 concurrent users

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dashboard filters add complexity | High | High | Start with date-only, iterate |
| ECharts bundle too large | Medium | Medium | Lazy load, document tree-shaking |
| Multi-tenant security gaps | Medium | High | Security review, penetration testing |
| SSR breaks React components | Medium | Medium | Test with Next.js early in Week 2 |
| Scope creep | High | Medium | Strict prioritization, defer to Phase 2 |
| PostgreSQL-only limits adoption | Low | Medium | Document, plan MySQL in Phase 2 |

---

## Quick Reference: What Ships When

| Week | Backend | Frontend | Key Deliverable |
|------|---------|----------|-----------------|
| 1 | Query engine | SDK + hooks | Programmatic queries |
| 2 | Schema config, dates | Query builder, theme | Visual query building |
| 3 | Time series, trends | Charts, MetricCard | Data visualization |
| 4 | Dashboard API, filters | Dashboard builder | Interactive dashboards |
| 5 | Caching, metrics | Export, SSR, polish | Production readiness |
| 6 | Custom SQL, security | Drill-down, advanced | Power user features |
