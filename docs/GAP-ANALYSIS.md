# Prismiq Roadmap - Gap Analysis

## Executive Summary

After thorough review, I've identified **23 gaps** across 8 categories. Most are addressable by adding to existing weeks or are natural "Phase 2" items. The core plan is solid, but these additions will make it production-ready.

---

## 🔴 Critical Gaps (Must Have for MVP)

### 1. Dashboard Filters / Parameters (Missing from Week 4)

**Problem:** Dashboards without global filters are nearly useless. Users expect to filter all widgets by date range, customer, region, etc.

**Solution:** Add to Week 4:
- `DashboardFilter` component (date range, dropdown, text input)
- Dashboard-level filter state
- Filters applied to all widget queries automatically
- Filter persistence (URL params or local storage)

**Backend:**
- Dashboard model needs `filters: FilterDefinition[]` field
- Query execution needs to merge dashboard filters with widget filters

---

### 2. KPI / Metric Cards (Missing from Week 3)

**Problem:** Single-value metrics (Total Revenue: $1.2M, Users: 45,231) are the most common dashboard element. No component for this.

**Solution:** Add to Week 3:
- `MetricCard` component
- Supports: value, label, trend (up/down %), sparkline (optional)
- Comparison to previous period

---

### 3. Schema Customization / Semantic Layer Lite (Missing)

**Problem:** Raw database column names are ugly (`cust_acct_num` vs "Customer Account Number"). Users need friendly names and the ability to hide sensitive columns.

**Solution:** Add to Week 2 (Python):
```python
# Schema override config
schema_config = {
    "customers": {
        "display_name": "Customers",
        "columns": {
            "cust_acct_num": {"display_name": "Account Number"},
            "ssn": {"hidden": True},  # Hide from UI
        }
    }
}
```

**React:** `SchemaExplorer` uses display names, hides hidden columns.

---

### 4. Custom SQL Escape Hatch (Missing from Week 6)

**Problem:** Power users will hit limits of the visual query builder. They need raw SQL access.

**Solution:** Add to Week 6:
- `POST /query/sql` endpoint (with validation/sandboxing)
- `CustomSqlEditor` component with syntax highlighting
- Query result works with existing charts/tables

**Security:** Configurable allow/deny, read-only by default.

---

### 5. Event Callbacks / Analytics Hooks (Missing)

**Problem:** Developers need to know when queries run, errors happen, exports complete for their own analytics/logging.

**Solution:** Add to Week 2 (React):
```typescript
<AnalyticsProvider
  onQueryExecute={(query, result) => trackEvent('query', query)}
  onQueryError={(query, error) => logError(error)}
  onExport={(format, rowCount) => trackExport(format)}
  onDashboardLoad={(id) => trackPageView(id)}
>
```

---

### 6. Multi-Series Charts (Missing from Week 3)

**Problem:** Charts show single series only. Real dashboards need: Revenue vs Cost over time, Sales by Region (multiple lines).

**Solution:** Expand Week 3 charts:
- `LineChart` supports `series: ColumnSelection[]`
- Legend component
- Color assignment per series

---

## 🟡 Important Gaps (Should Have)

### 7. Chart Variants (Incomplete in Week 3)

**Missing chart types:**
- Horizontal bar chart
- Stacked bar chart
- Combo chart (bar + line)
- Donut chart (Pie variant)
- Treemap

**Solution:** Add as props/variants:
```tsx
<BarChart orientation="horizontal" stacked={true} />
<PieChart variant="donut" />
```

---

### 8. Data Labels & Annotations (Missing from Week 3)

**Problem:** Charts need data labels, reference lines, goal lines.

**Solution:** Add to chart components:
```tsx
<LineChart
  showDataLabels={true}
  referenceLines={[{ value: 1000000, label: "Target" }]}
/>
```

---

### 9. Auto-Refresh for Dashboards (Missing from Week 4)

**Problem:** Real-time dashboards need periodic refresh.

**Solution:** Add to Dashboard component:
```tsx
<Dashboard id="live-metrics" refreshInterval={30000} />
```

Backend: Consider cache invalidation strategy.

---

### 10. Full-Screen Mode (Missing from Week 4)

**Problem:** Dashboards on TV displays, presentations need full-screen.

**Solution:** Add to Widget/Dashboard:
- Full-screen toggle button
- Keyboard shortcut (F11 or Escape)
- `<Dashboard fullScreen={true} />`

---

### 11. Responsive / Mobile Support (Missing)

**Problem:** Dashboards should work on tablets/phones.

**Solution:** Add to Week 4:
- Responsive breakpoints in react-grid-layout
- Stack widgets on mobile
- Touch-friendly interactions
- `<Dashboard layout="mobile" />`

---

### 12. SSR / Next.js Support (Missing from Week 5)

**Problem:** Many customers use Next.js. Current client-side only approach causes hydration issues.

**Solution:** Add to Week 5:
- Ensure all components are SSR-safe
- `use client` directives where needed
- Server-side data fetching pattern
- Document Next.js integration

---

### 13. Bundle Size Optimization (Missing from Week 5)

**Problem:** ECharts is huge (~1MB). Importing all charts bloats customer apps.

**Solution:**
- Tree-shakeable exports
- Lazy load chart types
- Document import patterns:
```typescript
// Full (large)
import { BarChart, LineChart } from '@prismiq/react';

// Optimized (smaller)
import { BarChart } from '@prismiq/react/charts/bar';
```

---

### 14. Query Cancellation (Missing from Week 1)

**Problem:** Long-running queries can't be cancelled. User navigates away, query keeps running.

**Solution:**
- Backend: Support `pg_cancel_backend()`
- Frontend: AbortController in useQuery
- UI: Cancel button on long queries

---

## 🟢 Nice-to-Have Gaps (Future)

### 15. Headless Mode (Future)

**Problem:** Some developers want data-only, bring their own components.

**Solution:** Phase 2 - separate `@prismiq/core` package with just hooks, no UI.

---

### 16. Column-Level Security (Future)

**Problem:** Row-level security exists, but some columns (salary, SSN) should be hidden per user.

**Solution:** Phase 2 - extend security hooks.

---

### 17. Query Templates / Saved Views (Partial in Week 6)

**Problem:** "Saved queries" mentioned but no detail.

**Solution:** Flesh out Week 6:
- Save query as template
- Parameterized queries (WHERE customer_id = $1)
- Share saved queries

---

### 18. Internationalization (i18n) (Missing)

**Problem:** Number/date formats, UI text should be localizable.

**Solution:** Phase 2:
- `<AnalyticsProvider locale="de-DE">`
- Format numbers/dates per locale
- Externalize UI strings

---

### 19. Undo/Redo in Dashboard Editor (Missing)

**Problem:** Users accidentally delete widgets, no undo.

**Solution:** Week 4 enhancement:
- Command pattern for edits
- Ctrl+Z / Ctrl+Y support
- History stack

---

### 20. Widget Duplication (Missing from Week 4)

**Problem:** Can't duplicate a widget to modify it.

**Solution:** Add to WidgetHeader actions: Duplicate button.

---

### 21. Import/Export Dashboard JSON (Missing)

**Problem:** Can't backup or share dashboard configurations.

**Solution:** Add to Week 4 API:
- `GET /dashboards/{id}/export` → JSON
- `POST /dashboards/import` ← JSON

---

### 22. Webhook for Query Completion (Future)

**Problem:** Long queries should notify when done.

**Solution:** Phase 2 - async query mode with webhook callback.

---

### 23. Database Connection Pooling Config (Missing from Week 1)

**Problem:** No config for pool size, timeouts.

**Solution:** Add to PrismiqEngine:
```python
PrismiqEngine(
    database_url="...",
    pool_min_size=5,
    pool_max_size=20,
    connection_timeout=10.0,
)
```

---

## Updated Week-by-Week Summary

### Week 1 (Updated)
- Add: Connection pool configuration
- Add: Query cancellation support

### Week 2 (Updated)
- Add: Schema customization (display names, hidden columns)
- Add: Event callbacks (onQueryExecute, onError)

### Week 3 (Updated)
- Add: MetricCard / KPI component
- Add: Multi-series chart support
- Add: Chart variants (horizontal, stacked, donut)
- Add: Data labels, reference lines

### Week 4 (Updated)
- Add: Dashboard filters / parameters ⚠️ **Critical**
- Add: Auto-refresh
- Add: Full-screen mode
- Add: Responsive/mobile layout
- Add: Widget duplication
- Add: Dashboard import/export

### Week 5 (Updated)
- Add: SSR/Next.js compatibility
- Add: Bundle size optimization (tree-shaking)
- Add: Undo/redo in editor

### Week 6 (Updated)
- Add: Custom SQL mode
- Add: Parameterized saved queries

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Dashboard filters add 1+ week | High | High | Start simple (date only), iterate |
| ECharts bundle too large | Medium | Medium | Lazy loading, document optimization |
| Multi-tenant security gaps | Medium | High | Security review in Week 5 |
| SSR breaks components | Medium | Medium | Test with Next.js early |
| Scope creep from gaps | High | Medium | Prioritize ruthlessly, defer to Phase 2 |

---

## Recommended Priority Order

### Must add now (blocks MVP):
1. ⚠️ Dashboard filters/parameters
2. ⚠️ KPI/Metric cards
3. ⚠️ Multi-series charts
4. Schema display names

### Add during development:
5. Event callbacks
6. Chart variants
7. Connection pool config
8. Query cancellation

### Add in Week 5 polish:
9. SSR support
10. Bundle optimization
11. Full-screen mode
12. Responsive layout

### Defer to Phase 2:
13. Custom SQL
14. Headless mode
15. i18n
16. Column-level security
17. Webhooks

---

## Conclusion

The roadmap is **85% complete**. The biggest gap is **dashboard filters** - without them, dashboards are static and far less useful. Adding this to Week 4 is critical.

The other gaps are additive improvements that can be woven into existing weeks without major restructuring.

Recommend updating the task files to incorporate these gaps before starting development.
