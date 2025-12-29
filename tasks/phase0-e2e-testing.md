# Phase 0: E2E Testing Infrastructure with Playwright

## Overview
Set up Playwright for end-to-end testing of the Prismiq demo application. All future phases will use these tests for validation.

## Prerequisites
- Demo app functional (`make demo` works)
- Node.js 18+

## Validation Command
```bash
cd examples/demo/frontend && npx playwright test
```

---

## Task 1: Playwright Installation & Configuration

**Install Playwright in demo frontend:**

```bash
cd examples/demo/frontend
npm install -D @playwright/test
npx playwright install chromium  # Just chromium for speed
```

**File:** `examples/demo/frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start demo servers before running tests
  webServer: [
    {
      command: 'cd ../backend && python main.py',
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:headed": "playwright test --headed"
  }
}
```

---

## Task 2: Test Utilities & Fixtures

**File:** `examples/demo/frontend/e2e/fixtures.ts`

```typescript
import { test as base, expect } from '@playwright/test';

// Custom fixtures for Prismiq testing
export const test = base.extend<{
  dashboardPage: DashboardPage;
  explorePage: ExplorePage;
  schemaPage: SchemaPage;
}>({
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },
  explorePage: async ({ page }, use) => {
    const explorePage = new ExplorePage(page);
    await use(explorePage);
  },
  schemaPage: async ({ page }, use) => {
    const schemaPage = new SchemaPage(page);
    await use(schemaPage);
  },
});

export { expect };

// Page Object: Dashboard
class DashboardPage {
  constructor(private page: Page) {}

  async goto(dashboardId: string = 'sales-overview') {
    await this.page.goto(`/dashboard/${dashboardId}`);
    await this.page.waitForSelector('[data-testid="dashboard-container"]');
  }

  async waitForWidgetsLoaded() {
    // Wait for all widgets to finish loading
    await this.page.waitForFunction(() => {
      const widgets = document.querySelectorAll('[data-testid^="widget-"]');
      const loading = document.querySelectorAll('[data-testid="widget-loading"]');
      return widgets.length > 0 && loading.length === 0;
    }, { timeout: 30000 });
  }

  async getWidgetCount() {
    return await this.page.locator('[data-testid^="widget-"]').count();
  }

  async getWidgetByTitle(title: string) {
    return this.page.locator(`[data-testid^="widget-"]:has-text("${title}")`);
  }

  async clickFilter(filterName: string) {
    await this.page.click(`[data-testid="filter-${filterName}"]`);
  }

  async setDateFilter(start: string, end: string) {
    await this.page.fill('[data-testid="date-start"]', start);
    await this.page.fill('[data-testid="date-end"]', end);
    await this.page.click('[data-testid="filter-apply"]');
  }

  async toggleEditMode() {
    await this.page.click('[data-testid="edit-mode-toggle"]');
  }

  async addWidget() {
    await this.page.click('[data-testid="add-widget-button"]');
  }

  async saveLayout() {
    await this.page.click('[data-testid="save-layout-button"]');
  }
}

// Page Object: Explore (Query Builder)
class ExplorePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/explore');
    await this.page.waitForSelector('[data-testid="query-builder"]');
  }

  async selectTable(tableName: string) {
    await this.page.click('[data-testid="table-selector"]');
    await this.page.click(`[data-testid="table-option-${tableName}"]`);
  }

  async addColumn(columnName: string) {
    await this.page.click('[data-testid="add-column-button"]');
    await this.page.click(`[data-testid="column-option-${columnName}"]`);
  }

  async setAggregation(columnIndex: number, aggregation: string) {
    await this.page.click(`[data-testid="column-${columnIndex}-aggregation"]`);
    await this.page.click(`[data-testid="aggregation-option-${aggregation}"]`);
  }

  async addFilter(column: string, operator: string, value: string) {
    await this.page.click('[data-testid="add-filter-button"]');
    await this.page.selectOption('[data-testid="filter-column"]', column);
    await this.page.selectOption('[data-testid="filter-operator"]', operator);
    await this.page.fill('[data-testid="filter-value"]', value);
  }

  async executeQuery() {
    await this.page.click('[data-testid="execute-query-button"]');
    await this.page.waitForSelector('[data-testid="results-table"]');
  }

  async getResultsCount() {
    const text = await this.page.textContent('[data-testid="results-count"]');
    return parseInt(text?.replace(/\D/g, '') || '0');
  }

  async getSQLPreview() {
    return await this.page.textContent('[data-testid="sql-preview"]');
  }
}

// Page Object: Schema
class SchemaPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/schema');
    await this.page.waitForSelector('[data-testid="schema-explorer"]');
  }

  async expandTable(tableName: string) {
    await this.page.click(`[data-testid="table-${tableName}"]`);
  }

  async getColumnCount(tableName: string) {
    return await this.page.locator(`[data-testid="table-${tableName}"] [data-testid^="column-"]`).count();
  }

  async getTableCount() {
    return await this.page.locator('[data-testid^="table-"]').count();
  }
}
```

---

## Task 3: Core E2E Tests

**File:** `examples/demo/frontend/e2e/dashboard.spec.ts`

```typescript
import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
  test('loads sales overview dashboard', async ({ dashboardPage }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    // Should have multiple widgets
    const widgetCount = await dashboardPage.getWidgetCount();
    expect(widgetCount).toBeGreaterThan(0);
  });

  test('displays metric widgets with values', async ({ dashboardPage }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    // Check Total Revenue widget exists and has a value
    const revenueWidget = await dashboardPage.getWidgetByTitle('Total Revenue');
    await expect(revenueWidget).toBeVisible();

    // Value should be formatted as currency
    const value = await revenueWidget.locator('[data-testid="metric-value"]').textContent();
    expect(value).toMatch(/\$[\d,]+/);
  });

  test('renders bar chart widget', async ({ dashboardPage, page }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    // Find bar chart widget
    const barChart = page.locator('[data-testid="widget-bar-chart"]').first();
    await expect(barChart).toBeVisible();

    // ECharts canvas should be present
    const canvas = barChart.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('renders line chart widget', async ({ dashboardPage, page }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    const lineChart = page.locator('[data-testid="widget-line-chart"]').first();
    await expect(lineChart).toBeVisible();
  });

  test('renders pie chart widget', async ({ dashboardPage, page }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    const pieChart = page.locator('[data-testid="widget-pie-chart"]').first();
    await expect(pieChart).toBeVisible();
  });

  test('renders table widget with data', async ({ dashboardPage, page }) => {
    await dashboardPage.goto('sales-overview');
    await dashboardPage.waitForWidgetsLoaded();

    const table = page.locator('[data-testid="widget-table"]').first();
    await expect(table).toBeVisible();

    // Should have rows
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('handles widget error gracefully', async ({ page }) => {
    // Navigate to non-existent dashboard
    await page.goto('/dashboard/non-existent');

    // Should show error state, not crash
    await expect(page.locator('[data-testid="dashboard-error"]')).toBeVisible();
  });
});
```

**File:** `examples/demo/frontend/e2e/query-builder.spec.ts`

```typescript
import { test, expect } from './fixtures';

test.describe('Query Builder', () => {
  test('loads schema and shows tables', async ({ explorePage, page }) => {
    await explorePage.goto();

    // Schema should load
    await page.waitForSelector('[data-testid="table-selector"]');

    // Should have tables available
    await page.click('[data-testid="table-selector"]');
    const tables = page.locator('[data-testid^="table-option-"]');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);
  });

  test('builds and executes simple query', async ({ explorePage }) => {
    await explorePage.goto();

    // Select customers table
    await explorePage.selectTable('customers');

    // Add name column
    await explorePage.addColumn('name');

    // Execute query
    await explorePage.executeQuery();

    // Should have results
    const count = await explorePage.getResultsCount();
    expect(count).toBeGreaterThan(0);
  });

  test('builds query with aggregation', async ({ explorePage }) => {
    await explorePage.goto();

    await explorePage.selectTable('orders');
    await explorePage.addColumn('total_amount');
    await explorePage.setAggregation(0, 'SUM');

    await explorePage.executeQuery();

    const count = await explorePage.getResultsCount();
    expect(count).toBe(1); // Single aggregated result
  });

  test('shows SQL preview', async ({ explorePage }) => {
    await explorePage.goto();

    await explorePage.selectTable('customers');
    await explorePage.addColumn('name');

    const sql = await explorePage.getSQLPreview();
    expect(sql).toContain('SELECT');
    expect(sql).toContain('customers');
    expect(sql).toContain('name');
  });

  test('applies filter to query', async ({ explorePage }) => {
    await explorePage.goto();

    await explorePage.selectTable('customers');
    await explorePage.addColumn('name');
    await explorePage.addColumn('region');
    await explorePage.addFilter('region', 'equals', 'North');

    await explorePage.executeQuery();

    // All results should have region = North
    const sql = await explorePage.getSQLPreview();
    expect(sql).toContain("'North'");
  });
});
```

**File:** `examples/demo/frontend/e2e/schema.spec.ts`

```typescript
import { test, expect } from './fixtures';

test.describe('Schema Explorer', () => {
  test('loads and displays tables', async ({ schemaPage }) => {
    await schemaPage.goto();

    const tableCount = await schemaPage.getTableCount();
    expect(tableCount).toBeGreaterThan(0);
  });

  test('expands table to show columns', async ({ schemaPage }) => {
    await schemaPage.goto();

    await schemaPage.expandTable('customers');

    const columnCount = await schemaPage.getColumnCount('customers');
    expect(columnCount).toBeGreaterThan(0);
  });

  test('shows all demo tables', async ({ schemaPage, page }) => {
    await schemaPage.goto();

    const expectedTables = ['customers', 'orders', 'products', 'order_items', 'events'];

    for (const table of expectedTables) {
      await expect(page.locator(`[data-testid="table-${table}"]`)).toBeVisible();
    }
  });
});
```

---

## Task 4: API Health Tests

**File:** `examples/demo/frontend/e2e/api.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const API_BASE = 'http://localhost:8000/api';

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('schema endpoint returns tables', async ({ request }) => {
    const response = await request.get(`${API_BASE}/schema`);
    expect(response.ok()).toBeTruthy();

    const schema = await response.json();
    expect(schema.tables).toBeDefined();
    expect(Object.keys(schema.tables).length).toBeGreaterThan(0);
  });

  test('dashboards endpoint returns list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/dashboards`);
    expect(response.ok()).toBeTruthy();

    const dashboards = await response.json();
    expect(Array.isArray(dashboards)).toBeTruthy();
  });

  test('query validation works', async ({ request }) => {
    const response = await request.post(`${API_BASE}/query/validate`, {
      data: {
        tables: [{ schema: 'public', table: 'customers' }],
        columns: [{ table: 'customers', column: 'name' }],
      },
    });
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.valid).toBe(true);
  });

  test('query execution returns data', async ({ request }) => {
    const response = await request.post(`${API_BASE}/query/execute`, {
      data: {
        tables: [{ schema: 'public', table: 'customers' }],
        columns: [{ table: 'customers', column: 'name' }],
        limit: 10,
      },
    });
    expect(response.ok()).toBeTruthy();

    const result = await response.json();
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeLessThanOrEqual(10);
  });
});
```

---

## Task 5: Add Data Testids to Components

**Update React components to include data-testid attributes:**

Components to update:
- `Dashboard.tsx` - add `data-testid="dashboard-container"`
- `Widget.tsx` - add `data-testid="widget-{type}"`
- `MetricCard.tsx` - add `data-testid="metric-value"`
- `FilterBar.tsx` - add `data-testid="filter-{name}"`
- `QueryBuilder.tsx` - add testids for all interactive elements
- `SchemaExplorer.tsx` - add `data-testid="table-{name}"`
- `ResultsTable.tsx` - add `data-testid="results-table"`

**Pattern:**
```tsx
// Before
<div className="widget">

// After
<div className="widget" data-testid={`widget-${widget.type}`}>
```

---

## Task 6: CI Integration

**File:** `.github/workflows/e2e.yml`

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: prismiq
          POSTGRES_PASSWORD: prismiq_demo
          POSTGRES_DB: prismiq_demo
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install uv
        run: curl -LsSf https://astral.sh/uv/install.sh | sh

      - name: Install Python dependencies
        run: uv sync --dev

      - name: Seed database
        run: |
          cd examples/demo/backend
          DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo \
          uv run python seed_data.py

      - name: Install frontend dependencies
        run: |
          cd examples/demo/frontend
          npm ci

      - name: Install Playwright
        run: |
          cd examples/demo/frontend
          npx playwright install chromium --with-deps

      - name: Run E2E tests
        run: |
          cd examples/demo/frontend
          DATABASE_URL=postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo \
          npm test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: examples/demo/frontend/playwright-report/
```

---

## Completion Criteria

- [ ] Playwright installed in demo frontend
- [ ] `playwright.config.ts` configured with webServer
- [ ] Page objects created for Dashboard, Explore, Schema
- [ ] Dashboard tests pass (widgets load, charts render)
- [ ] Query Builder tests pass (select, execute, filter)
- [ ] Schema Explorer tests pass (tables, columns)
- [ ] API endpoint tests pass
- [ ] Components have data-testid attributes
- [ ] `npm test` runs all e2e tests successfully
- [ ] GitHub Actions workflow configured
