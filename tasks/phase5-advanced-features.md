# Phase 5: Advanced Features

## Overview
Advanced analytics features: drill-down, cross-filtering, saved queries, scheduled reports, custom SQL, and row-level security.

## Prerequisites
- Phases 1-4 complete
- E2E testing infrastructure (Phase 0)

## Priority Order
1. Drill-down & Cross-filtering (High user value)
2. Saved Queries (Reduces repetitive work)
3. Dashboard Sharing & Embedding (Expands use cases)
4. Custom SQL Mode (Power users)
5. Row-Level Security (Enterprise requirement)
6. Scheduled Reports (Nice-to-have)

---

## Feature 5.1: Drill-Down & Cross-Filtering

### Overview
Click on a chart element to filter other widgets. Click on a bar in "Sales by Region" to filter all widgets to that region.

### Task 5.1.1: Cross-Filter Context

**File:** `packages/react/src/context/CrossFilterContext.tsx`

```tsx
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CrossFilter {
  /** Widget that triggered the filter */
  sourceWidgetId: string;
  /** Column being filtered */
  column: string;
  /** Filter value */
  value: string | number;
  /** Table the column belongs to */
  table?: string;
}

interface CrossFilterContextValue {
  /** Active cross-filters */
  filters: CrossFilter[];
  /** Add a cross-filter */
  addFilter: (filter: CrossFilter) => void;
  /** Remove a cross-filter */
  removeFilter: (sourceWidgetId: string) => void;
  /** Clear all cross-filters */
  clearFilters: () => void;
  /** Check if a widget is being filtered */
  isFiltered: (widgetId: string) => boolean;
}

const CrossFilterContext = createContext<CrossFilterContextValue | null>(null);

export function CrossFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CrossFilter[]>([]);

  const addFilter = useCallback((filter: CrossFilter) => {
    setFilters((prev) => {
      // Replace existing filter from same source
      const filtered = prev.filter((f) => f.sourceWidgetId !== filter.sourceWidgetId);
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = useCallback((sourceWidgetId: string) => {
    setFilters((prev) => prev.filter((f) => f.sourceWidgetId !== sourceWidgetId));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const isFiltered = useCallback(
    (widgetId: string) => filters.some((f) => f.sourceWidgetId !== widgetId),
    [filters]
  );

  return (
    <CrossFilterContext.Provider
      value={{ filters, addFilter, removeFilter, clearFilters, isFiltered }}
    >
      {children}
    </CrossFilterContext.Provider>
  );
}

export function useCrossFilter() {
  const context = useContext(CrossFilterContext);
  if (!context) {
    throw new Error('useCrossFilter must be used within CrossFilterProvider');
  }
  return context;
}
```

### Task 5.1.2: Chart Click Handlers

**File:** Update `packages/react/src/charts/BarChart.tsx`

```tsx
interface BarChartProps {
  // ... existing props
  /** Enable cross-filtering on click */
  enableCrossFilter?: boolean;
  /** Widget ID for cross-filter source */
  widgetId?: string;
}

export function BarChart({
  data,
  xAxis,
  yAxis,
  enableCrossFilter = false,
  widgetId,
  ...props
}: BarChartProps) {
  const { addFilter, removeFilter } = useCrossFilter();
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const handleClick = useCallback(
    (params: any) => {
      if (!enableCrossFilter || !widgetId) return;

      const clickedValue = params.name;

      if (selectedBar === clickedValue) {
        // Deselect
        setSelectedBar(null);
        removeFilter(widgetId);
      } else {
        // Select
        setSelectedBar(clickedValue);
        addFilter({
          sourceWidgetId: widgetId,
          column: xAxis,
          value: clickedValue,
        });
      }
    },
    [enableCrossFilter, widgetId, xAxis, selectedBar, addFilter, removeFilter]
  );

  const option = useMemo(() => ({
    // ... existing options
    series: [
      {
        // ... existing series config
        emphasis: {
          focus: 'series',
        },
        // Highlight selected bar
        itemStyle: {
          opacity: (params: any) =>
            selectedBar && params.name !== selectedBar ? 0.3 : 1,
        },
      },
    ],
  }), [data, selectedBar]);

  return (
    <EChartWrapper
      option={option}
      onEvents={{ click: handleClick }}
      {...props}
    />
  );
}
```

### Task 5.1.3: Apply Cross-Filters to Widget Queries

**File:** Update `packages/react/src/hooks/useWidgetData.ts`

```tsx
export function useWidgetData(widget: Widget, dashboardId: string) {
  const { client } = useAnalytics();
  const { filters: crossFilters } = useCrossFilter();

  // Merge cross-filters into widget query
  const queryWithFilters = useMemo(() => {
    if (!widget.query) return null;

    const additionalFilters = crossFilters
      .filter((f) => f.sourceWidgetId !== widget.id)
      .map((f) => ({
        column: f.column,
        operator: 'eq' as const,
        value: f.value,
        table: f.table,
      }));

    return {
      ...widget.query,
      filters: [...(widget.query.filters || []), ...additionalFilters],
    };
  }, [widget.query, widget.id, crossFilters]);

  // Fetch data with merged filters
  const { data, isLoading, error } = useQuery({
    queryKey: ['widget-data', widget.id, queryWithFilters],
    queryFn: () => client.executeQuery(queryWithFilters!),
    enabled: !!queryWithFilters,
  });

  return { data, isLoading, error };
}
```

### E2E Test

**File:** `examples/demo/frontend/e2e/cross-filtering.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cross-Filtering', () => {
  test('clicking bar filters other widgets', async ({ page }) => {
    await page.goto('/dashboard/sales-overview');
    await page.waitForSelector('[data-testid="dashboard-container"]');

    // Get initial table row count
    const table = page.locator('[data-testid="widget-table"]');
    const initialRows = await table.locator('tbody tr').count();

    // Click on a bar (e.g., "North" region)
    const barChart = page.locator('[data-testid="widget-bar-chart"]').first();
    await barChart.click({ position: { x: 100, y: 100 } }); // Approximate bar position

    // Wait for other widgets to update
    await page.waitForTimeout(500);

    // Table should have fewer rows (filtered)
    const filteredRows = await table.locator('tbody tr').count();
    expect(filteredRows).toBeLessThan(initialRows);

    // Click same bar to deselect
    await barChart.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    // Should return to original count
    const restoredRows = await table.locator('tbody tr').count();
    expect(restoredRows).toBe(initialRows);
  });
});
```

---

## Feature 5.2: Saved Queries

### Overview
Save frequently used queries for reuse across dashboards.

### Task 5.2.1: Saved Query API

**File:** Add endpoints to `packages/python/prismiq/api.py`

```python
from prismiq.types import QueryDefinition

class SavedQuery(BaseModel):
    id: str
    name: str
    description: str | None
    query: QueryDefinition
    owner_id: str | None

class SavedQueryCreate(BaseModel):
    name: str
    description: str | None = None
    query: QueryDefinition

@router.get("/saved-queries")
async def list_saved_queries(
    auth: AuthContext = Depends(get_auth_context),
) -> list[SavedQuery]:
    """List saved queries for the tenant."""
    return await engine.saved_queries.list(auth.tenant_id, auth.user_id)

@router.post("/saved-queries")
async def create_saved_query(
    data: SavedQueryCreate,
    auth: AuthContext = Depends(get_auth_context),
) -> SavedQuery:
    """Save a query for reuse."""
    return await engine.saved_queries.create(data, auth.tenant_id, auth.user_id)

@router.delete("/saved-queries/{query_id}")
async def delete_saved_query(
    query_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, str]:
    """Delete a saved query."""
    success = await engine.saved_queries.delete(query_id, auth.tenant_id, auth.user_id)
    if not success:
        raise HTTPException(status_code=404)
    return {"status": "deleted"}
```

### Task 5.2.2: Saved Query Store

**File:** `packages/python/prismiq/persistence/saved_query_store.py`

```python
class SavedQueryStore:
    """PostgreSQL store for saved queries."""

    def __init__(self, pool: Pool) -> None:
        self._pool = pool

    async def list(
        self,
        tenant_id: str,
        user_id: str | None = None,
    ) -> list[SavedQuery]:
        """List saved queries for tenant, optionally filtered by owner."""
        query = """
            SELECT * FROM prismiq_saved_queries
            WHERE tenant_id = $1
        """
        params = [tenant_id]
        if user_id:
            query += " AND (owner_id = $2 OR owner_id IS NULL)"
            params.append(user_id)
        query += " ORDER BY name"

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [self._row_to_query(row) for row in rows]

    async def create(
        self,
        data: SavedQueryCreate,
        tenant_id: str,
        owner_id: str | None,
    ) -> SavedQuery:
        """Create a saved query."""
        query_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        query = """
            INSERT INTO prismiq_saved_queries
            (id, tenant_id, name, description, query, owner_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                query_id,
                tenant_id,
                data.name,
                data.description,
                data.query.model_dump(),
                owner_id,
                now,
                now,
            )
            return self._row_to_query(row)

    async def delete(
        self,
        query_id: str,
        tenant_id: str,
        user_id: str | None,
    ) -> bool:
        """Delete a saved query (owner only)."""
        query = """
            DELETE FROM prismiq_saved_queries
            WHERE id = $1 AND tenant_id = $2 AND owner_id = $3
        """
        async with self._pool.acquire() as conn:
            result = await conn.execute(query, uuid.UUID(query_id), tenant_id, user_id)
            return result == "DELETE 1"
```

### Task 5.2.3: React UI for Saved Queries

**File:** `packages/react/src/components/SavedQueryPicker/SavedQueryPicker.tsx`

```tsx
interface SavedQueryPickerProps {
  /** Called when a saved query is selected */
  onSelect: (query: QueryDefinition) => void;
  /** Show save button for current query */
  showSave?: boolean;
  /** Current query to save */
  currentQuery?: QueryDefinition;
}

export function SavedQueryPicker({
  onSelect,
  showSave = false,
  currentQuery,
}: SavedQueryPickerProps) {
  const { client } = useAnalytics();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    client.listSavedQueries().then(setQueries);
  }, [client]);

  const handleSave = async (name: string, description?: string) => {
    if (!currentQuery) return;

    await client.createSavedQuery({ name, description, query: currentQuery });
    const updated = await client.listSavedQueries();
    setQueries(updated);
    setSaveDialogOpen(false);
  };

  return (
    <div className="saved-query-picker">
      <div className="saved-query-header">
        <h4>Saved Queries</h4>
        {showSave && currentQuery && (
          <Button size="sm" onClick={() => setSaveDialogOpen(true)}>
            Save Current Query
          </Button>
        )}
      </div>

      {queries.length === 0 ? (
        <p className="empty">No saved queries yet</p>
      ) : (
        <ul className="saved-query-list">
          {queries.map((q) => (
            <li key={q.id}>
              <button onClick={() => onSelect(q.query)}>
                <strong>{q.name}</strong>
                {q.description && <span>{q.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {saveDialogOpen && (
        <SaveQueryDialog onSave={handleSave} onClose={() => setSaveDialogOpen(false)} />
      )}
    </div>
  );
}
```

---

## Feature 5.3: Dashboard Sharing & Embedding

### Overview
Generate shareable links and embed codes for dashboards.

### Task 5.3.1: Share Token Generation

**File:** `packages/python/prismiq/sharing.py`

```python
import secrets
from datetime import datetime, timedelta

class ShareToken(BaseModel):
    token: str
    dashboard_id: str
    tenant_id: str
    expires_at: datetime | None
    permissions: list[str]  # ['view', 'filter']

async def create_share_token(
    dashboard_id: str,
    tenant_id: str,
    expires_in_days: int | None = None,
    permissions: list[str] = ['view'],
) -> ShareToken:
    """Generate a shareable token for a dashboard."""
    token = secrets.token_urlsafe(32)
    expires_at = None
    if expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    # Store token in database
    # ...

    return ShareToken(
        token=token,
        dashboard_id=dashboard_id,
        tenant_id=tenant_id,
        expires_at=expires_at,
        permissions=permissions,
    )
```

### Task 5.3.2: Embed Component

**File:** `packages/react/src/embed/EmbeddedDashboard.tsx`

```tsx
interface EmbeddedDashboardProps {
  /** Share token for authentication */
  token: string;
  /** Prismiq API endpoint */
  endpoint: string;
  /** Custom theme */
  theme?: 'light' | 'dark' | 'auto';
  /** CSS class */
  className?: string;
}

export function EmbeddedDashboard({
  token,
  endpoint,
  theme = 'auto',
  className,
}: EmbeddedDashboardProps) {
  // Create client with share token auth
  const client = useMemo(
    () =>
      new PrismiqClient({
        endpoint,
        headers: { 'X-Share-Token': token },
      }),
    [endpoint, token]
  );

  return (
    <AnalyticsProvider config={{ endpoint }} shareToken={token}>
      <ThemeProvider defaultMode={theme}>
        <Dashboard
          id="shared"
          editable={false}
          showFilters={true}
          className={className}
        />
      </ThemeProvider>
    </AnalyticsProvider>
  );
}
```

---

## Feature 5.4: Custom SQL Mode

### Overview
Allow power users to write raw SQL queries with parameter support.

### Task 5.4.1: SQL Query Execution

**File:** Add to `packages/python/prismiq/api.py`

```python
class RawSQLQuery(BaseModel):
    sql: str
    parameters: dict[str, Any] = {}

@router.post("/query/sql")
async def execute_raw_sql(
    query: RawSQLQuery,
    auth: AuthContext = Depends(get_auth_context),
) -> QueryResult:
    """
    Execute raw SQL (power user feature).

    SQL is validated and sandboxed:
    - Only SELECT statements allowed
    - Table access checked against schema permissions
    - Parameters must use $1, $2 syntax
    """
    # Validate SQL is safe
    if not is_safe_sql(query.sql):
        raise HTTPException(status_code=400, detail="Only SELECT statements are allowed")

    # Check table permissions
    tables = extract_tables_from_sql(query.sql)
    for table in tables:
        if not can_access_table(table, auth.tenant_id):
            raise HTTPException(status_code=403, detail=f"Access denied to table: {table}")

    return await engine.execute_raw_sql(query.sql, query.parameters)
```

### Task 5.4.2: SQL Validation

**File:** `packages/python/prismiq/sql_validator.py`

```python
import sqlparse

ALLOWED_STATEMENTS = {'SELECT'}
FORBIDDEN_KEYWORDS = {'DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER', 'CREATE'}

def is_safe_sql(sql: str) -> bool:
    """Check if SQL is safe to execute."""
    parsed = sqlparse.parse(sql)

    for statement in parsed:
        # Must be a SELECT
        if statement.get_type() not in ALLOWED_STATEMENTS:
            return False

        # Check for forbidden keywords
        tokens = [t.ttype for t in statement.flatten()]
        normalized = sql.upper()
        for keyword in FORBIDDEN_KEYWORDS:
            if keyword in normalized:
                return False

    return True

def extract_tables_from_sql(sql: str) -> list[str]:
    """Extract table names from SQL for permission checking."""
    parsed = sqlparse.parse(sql)[0]
    tables = []

    # Walk tokens to find table references
    from_seen = False
    for token in parsed.tokens:
        if token.ttype is sqlparse.tokens.Keyword and token.value.upper() == 'FROM':
            from_seen = True
        elif from_seen and token.ttype is sqlparse.tokens.Name:
            tables.append(token.value)
            from_seen = False

    return tables
```

### Task 5.4.3: SQL Editor Component

**File:** `packages/react/src/query/SQLEditor/SQLEditor.tsx`

```tsx
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-sql';
import Editor from 'react-simple-code-editor';

interface SQLEditorProps {
  value: string;
  onChange: (sql: string) => void;
  onExecute: () => void;
  parameters?: Record<string, any>;
  onParametersChange?: (params: Record<string, any>) => void;
  error?: string;
  isLoading?: boolean;
}

export function SQLEditor({
  value,
  onChange,
  onExecute,
  parameters = {},
  onParametersChange,
  error,
  isLoading,
}: SQLEditorProps) {
  // Extract $1, $2, etc. from SQL
  const paramPlaceholders = useMemo(() => {
    const matches = value.match(/\$\d+/g) || [];
    return [...new Set(matches)].sort();
  }, [value]);

  return (
    <div className="sql-editor">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, languages.sql, 'sql')}
        padding={10}
        className="sql-code-editor"
      />

      {paramPlaceholders.length > 0 && (
        <div className="sql-parameters">
          <h4>Parameters</h4>
          {paramPlaceholders.map((param) => (
            <div key={param} className="param-field">
              <label>{param}</label>
              <Input
                value={parameters[param] || ''}
                onChange={(e) =>
                  onParametersChange?.({ ...parameters, [param]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      )}

      {error && <div className="sql-error">{error}</div>}

      <div className="sql-actions">
        <Button onClick={onExecute} loading={isLoading}>
          Execute Query
        </Button>
      </div>
    </div>
  );
}
```

---

## Feature 5.5: Row-Level Security

### Overview
Filter query results based on user context. E.g., sales reps only see their own customers.

### Task 5.5.1: RLS Policy Model

**File:** `packages/python/prismiq/rls.py`

```python
from pydantic import BaseModel

class RLSPolicy(BaseModel):
    """Row-level security policy."""
    table: str
    column: str
    context_field: str  # Field in AuthContext to compare
    operator: str = 'eq'  # eq, in, contains

class RLSConfig(BaseModel):
    """RLS configuration for a tenant."""
    policies: list[RLSPolicy]

def apply_rls_filters(
    query: QueryDefinition,
    policies: list[RLSPolicy],
    auth_context: AuthContext,
) -> QueryDefinition:
    """Apply RLS policies to a query."""
    additional_filters = []

    for policy in policies:
        # Check if query touches this table
        if policy.table not in [t.table for t in query.tables]:
            continue

        # Get value from auth context
        context_value = getattr(auth_context, policy.context_field, None)
        if context_value is None:
            continue

        additional_filters.append({
            'table': policy.table,
            'column': policy.column,
            'operator': policy.operator,
            'value': context_value,
        })

    return query.model_copy(update={
        'filters': [*query.filters, *additional_filters]
    })
```

### Task 5.5.2: RLS Configuration API

**File:** Add to `packages/python/prismiq/api.py`

```python
@router.get("/rls/policies")
async def list_rls_policies(
    auth: AuthContext = Depends(get_auth_context),
) -> list[RLSPolicy]:
    """List RLS policies for tenant."""
    return await engine.rls.list_policies(auth.tenant_id)

@router.post("/rls/policies")
async def create_rls_policy(
    policy: RLSPolicy,
    auth: AuthContext = Depends(get_auth_context),
) -> RLSPolicy:
    """Create an RLS policy."""
    return await engine.rls.create_policy(policy, auth.tenant_id)

@router.delete("/rls/policies/{policy_id}")
async def delete_rls_policy(
    policy_id: str,
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, str]:
    """Delete an RLS policy."""
    await engine.rls.delete_policy(policy_id, auth.tenant_id)
    return {"status": "deleted"}
```

### Task 5.5.3: Apply RLS in Query Execution

**File:** Update `packages/python/prismiq/executor.py`

```python
class QueryExecutor:
    async def execute(
        self,
        query: QueryDefinition,
        auth_context: AuthContext | None = None,
        rls_policies: list[RLSPolicy] | None = None,
    ) -> QueryResult:
        # Apply RLS if configured
        if auth_context and rls_policies:
            query = apply_rls_filters(query, rls_policies, auth_context)

        # Generate and execute SQL
        sql, params = self._query_builder.build(query)
        # ...
```

---

## Feature 5.6: Scheduled Reports

### Overview
Email/Slack delivery of dashboard snapshots on a schedule.

### Task 5.6.1: Schedule Model

**File:** `packages/python/prismiq/schedules.py`

```python
from pydantic import BaseModel
from enum import Enum

class Frequency(str, Enum):
    DAILY = 'daily'
    WEEKLY = 'weekly'
    MONTHLY = 'monthly'

class DeliveryMethod(str, Enum):
    EMAIL = 'email'
    SLACK = 'slack'
    WEBHOOK = 'webhook'

class ScheduledReport(BaseModel):
    id: str
    dashboard_id: str
    name: str
    frequency: Frequency
    time: str  # HH:MM UTC
    day_of_week: int | None  # 0-6 for weekly
    day_of_month: int | None  # 1-31 for monthly
    delivery_method: DeliveryMethod
    recipients: list[str]
    format: str = 'pdf'  # pdf, png, csv
    enabled: bool = True
```

### Task 5.6.2: Report Generation

**File:** `packages/python/prismiq/reports/generator.py`

```python
from playwright.async_api import async_playwright

async def generate_dashboard_pdf(
    dashboard_id: str,
    tenant_id: str,
    engine: PrismiqEngine,
) -> bytes:
    """Generate PDF snapshot of a dashboard."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to dashboard render endpoint
        url = f"{engine.base_url}/render/{tenant_id}/{dashboard_id}"
        await page.goto(url)

        # Wait for all widgets to load
        await page.wait_for_selector('[data-testid="dashboard-loaded"]')

        # Generate PDF
        pdf = await page.pdf(format='A4', print_background=True)

        await browser.close()
        return pdf
```

### Task 5.6.3: Scheduler Worker

**File:** `packages/python/prismiq/reports/scheduler.py`

```python
import asyncio
from datetime import datetime
from croniter import croniter

async def run_scheduler(engine: PrismiqEngine):
    """Run scheduled report worker."""
    while True:
        now = datetime.utcnow()

        # Get due reports
        due_reports = await engine.schedules.get_due_reports(now)

        for report in due_reports:
            try:
                # Generate report
                pdf = await generate_dashboard_pdf(
                    report.dashboard_id,
                    report.tenant_id,
                    engine,
                )

                # Deliver
                if report.delivery_method == DeliveryMethod.EMAIL:
                    await send_email_report(report.recipients, pdf)
                elif report.delivery_method == DeliveryMethod.SLACK:
                    await send_slack_report(report.recipients, pdf)

                # Mark as sent
                await engine.schedules.mark_sent(report.id)
            except Exception as e:
                await engine.schedules.mark_failed(report.id, str(e))

        # Sleep until next minute
        await asyncio.sleep(60)
```

---

## Completion Criteria for Phase 5

### Feature 5.1: Cross-Filtering
- [ ] CrossFilterContext provides filter state
- [ ] Bar/Pie/Line charts support click handlers
- [ ] Clicking element adds cross-filter
- [ ] Other widgets re-query with filter
- [ ] Clicking again removes filter
- [ ] Clear all filters button

### Feature 5.2: Saved Queries
- [ ] prismiq_saved_queries table exists
- [ ] CRUD API for saved queries
- [ ] SavedQueryPicker component
- [ ] Load saved query into QueryBuilder
- [ ] Save current query button

### Feature 5.3: Dashboard Sharing
- [ ] Share token generation API
- [ ] Token-based authentication
- [ ] EmbeddedDashboard component
- [ ] Embed code generator UI
- [ ] Token expiration support

### Feature 5.4: Custom SQL
- [ ] /query/sql endpoint
- [ ] SQL validation (SELECT only)
- [ ] Table permission checking
- [ ] Parameter substitution
- [ ] SQLEditor component with syntax highlighting

### Feature 5.5: Row-Level Security
- [ ] RLSPolicy model
- [ ] Policy CRUD API
- [ ] Filter injection in executor
- [ ] Works with auth context fields
- [ ] Admin UI for policy management

### Feature 5.6: Scheduled Reports
- [ ] ScheduledReport model
- [ ] CRUD API for schedules
- [ ] PDF generation via Playwright
- [ ] Email delivery
- [ ] Slack delivery
- [ ] Scheduler worker process
