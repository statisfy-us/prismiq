import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000/api';
const DEMO_TENANT_ID = 'demo-tenant';
const DEMO_USER_ID = 'demo-user';
const TEST_CONTEXT = 'e2e-test-context';

// Headers for API calls
const headers = {
  'Content-Type': 'application/json',
  'X-Tenant-ID': DEMO_TENANT_ID,
  'X-User-ID': DEMO_USER_ID,
};

// Run API tests serially to avoid race conditions
test.describe.configure({ mode: 'serial' });

test.describe('Pin API E2E Tests', () => {
  let testDashboardId: string;
  const uniqueId = Date.now().toString();

  test.beforeAll(async ({ request }) => {
    // Create a test dashboard to use for pinning tests
    const response = await request.post(`${API_BASE}/dashboards`, {
      headers,
      data: {
        name: `E2E Test Dashboard for Pins ${uniqueId}`,
        description: 'Dashboard created for pin E2E testing',
      },
    });
    if (!response.ok()) {
      console.error('Failed to create dashboard:', await response.text());
    }
    expect(response.ok()).toBeTruthy();
    const dashboard = await response.json();
    testDashboardId = dashboard.id;
  });

  test.afterAll(async ({ request }) => {
    // Clean up: delete the test dashboard
    if (testDashboardId) {
      await request.delete(`${API_BASE}/dashboards/${testDashboardId}`, {
        headers,
      }).catch(() => {});
    }
  });

  test.afterEach(async ({ request }) => {
    // Clean up any pins created during tests
    if (testDashboardId) {
      await request.delete(`${API_BASE}/pins`, {
        headers,
        data: {
          dashboard_id: testDashboardId,
          context: TEST_CONTEXT,
        },
      }).catch(() => {
        // Ignore errors if pin doesn't exist
      });
    }
  });

  test('should pin a dashboard to a context', async ({ request }) => {
    const response = await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    expect(response.status()).toBe(201);
    const pin = await response.json();
    expect(pin.dashboard_id).toBe(testDashboardId);
    expect(pin.context).toBe(TEST_CONTEXT);
    expect(pin.position).toBe(0);
    expect(pin.id).toBeDefined();
    expect(pin.pinned_at).toBeDefined();
  });

  test('should get pinned dashboards for a context', async ({ request }) => {
    // First pin the dashboard
    await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    // Then fetch pinned dashboards
    const response = await request.get(`${API_BASE}/pins?context=${TEST_CONTEXT}`, {
      headers,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.dashboards).toBeDefined();
    expect(data.pins).toBeDefined();
    expect(data.dashboards.length).toBeGreaterThan(0);

    const dashboard = data.dashboards.find((d: { id: string }) => d.id === testDashboardId);
    expect(dashboard).toBeDefined();
    expect(dashboard.name).toContain('E2E Test Dashboard for Pins');
  });

  test('should get pin contexts for a dashboard', async ({ request }) => {
    // Pin to a context first
    await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    // Get pin contexts
    const response = await request.get(`${API_BASE}/dashboards/${testDashboardId}/pins`, {
      headers,
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.contexts).toContain(TEST_CONTEXT);
  });

  test('should unpin a dashboard from a context', async ({ request }) => {
    // First pin the dashboard
    await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    // Then unpin it
    const response = await request.delete(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);

    // Verify it's unpinned
    const contextsResponse = await request.get(`${API_BASE}/dashboards/${testDashboardId}/pins`, {
      headers,
    });
    const contextsData = await contextsResponse.json();
    expect(contextsData.contexts).not.toContain(TEST_CONTEXT);
  });

  test('should not allow duplicate pins', async ({ request }) => {
    // Pin the dashboard
    await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    // Try to pin again - should fail or return existing
    const response = await request.post(`${API_BASE}/pins`, {
      headers,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    // Either 409 conflict or 400 bad request
    expect([400, 409]).toContain(response.status());
  });

  test('should reorder pinned dashboards', async ({ request }) => {
    // Create a second test dashboard
    const createResponse = await request.post(`${API_BASE}/dashboards`, {
      headers,
      data: {
        name: 'E2E Test Dashboard 2 for Pins',
        description: 'Second dashboard for reorder testing',
      },
    });
    const dashboard2 = await createResponse.json();
    const testDashboardId2 = dashboard2.id;

    try {
      // Pin both dashboards
      await request.post(`${API_BASE}/pins`, {
        headers,
        data: {
          dashboard_id: testDashboardId,
          context: TEST_CONTEXT,
        },
      });

      await request.post(`${API_BASE}/pins`, {
        headers,
        data: {
          dashboard_id: testDashboardId2,
          context: TEST_CONTEXT,
        },
      });

      // Reorder: put dashboard2 first
      const reorderResponse = await request.put(`${API_BASE}/pins/order`, {
        headers,
        data: {
          context: TEST_CONTEXT,
          dashboard_ids: [testDashboardId2, testDashboardId],
        },
      });

      expect(reorderResponse.ok()).toBeTruthy();

      // Verify order
      const pinsResponse = await request.get(`${API_BASE}/pins?context=${TEST_CONTEXT}`, {
        headers,
      });
      const pinsData = await pinsResponse.json();

      const pin1 = pinsData.pins.find((p: { dashboard_id: string }) => p.dashboard_id === testDashboardId2);
      const pin2 = pinsData.pins.find((p: { dashboard_id: string }) => p.dashboard_id === testDashboardId);
      expect(pin1.position).toBeLessThan(pin2.position);
    } finally {
      // Clean up
      await request.delete(`${API_BASE}/pins`, {
        headers,
        data: {
          dashboard_id: testDashboardId2,
          context: TEST_CONTEXT,
        },
      }).catch(() => {});

      await request.delete(`${API_BASE}/dashboards/${testDashboardId2}`, {
        headers,
      }).catch(() => {});
    }
  });

  test('should require user_id for pin operations', async ({ request }) => {
    const headersNoUser = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': DEMO_TENANT_ID,
      // No X-User-ID
    };

    const response = await request.post(`${API_BASE}/pins`, {
      headers: headersNoUser,
      data: {
        dashboard_id: testDashboardId,
        context: TEST_CONTEXT,
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Pin UI E2E Tests', () => {
  test('should navigate to pinned page', async ({ page }) => {
    await page.goto('/');

    // Click on Pinned nav link
    await page.click('a[href="/pinned"]');

    // Verify we're on the pinned page
    await expect(page.locator('[data-testid="pinned-page"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Pinned Dashboards');
  });

  test('should show empty state when no dashboards pinned', async ({ page }) => {
    await page.goto('/pinned');

    // Should show empty state message
    await expect(page.locator('text=No pinned dashboards')).toBeVisible();
  });

  test('should show pin menu on dashboard cards', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for dashboard list to load
    await page.waitForSelector('h2:has-text("Dashboards")');

    // Look for pin button (part of PinMenu)
    const pinButtons = page.locator('button:has-text("Pin")');
    const count = await pinButtons.count();
    expect(count).toBeGreaterThan(0);
  });
});
