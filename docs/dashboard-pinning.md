# Dashboard Pinning

Dashboard pinning allows users to save dashboards to predefined contexts for quick access in different areas of your application. For example, users can pin dashboards to an "Accounts" page, a "Home" page, or any other context you define.

## Overview

**Key concepts:**
- **Context**: A string identifier representing where dashboards can be pinned (e.g., `"accounts"`, `"home"`, `"favorites"`)
- **Pin**: An association between a user, dashboard, and context with a position for ordering
- **User-scoped**: Each user has their own set of pins, isolated from other users
- **Tenant-scoped**: Pins are also isolated by tenant for multi-tenant applications

## Backend Setup

### API Endpoints

The pinning feature adds these endpoints to the Prismiq API:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pins` | Pin a dashboard to a context |
| `DELETE` | `/pins` | Unpin a dashboard from a context |
| `GET` | `/pins?context={context}` | Get pinned dashboards for a context |
| `GET` | `/dashboards/{id}/pins` | Get contexts where a dashboard is pinned |
| `PUT` | `/pins/order` | Reorder pins within a context |

### Request/Response Examples

**Pin a dashboard:**
```bash
POST /pins
Content-Type: application/json
X-Tenant-ID: tenant_123
X-User-ID: user_456

{
  "dashboard_id": "abc123",
  "context": "accounts",
  "position": 0  // optional, appends at end if omitted
}
```

**Get pinned dashboards:**
```bash
GET /pins?context=accounts
X-Tenant-ID: tenant_123
X-User-ID: user_456

# Response:
{
  "dashboards": [
    { "id": "abc123", "name": "Sales Overview", ... },
    { "id": "def456", "name": "Revenue Trends", ... }
  ],
  "pins": [
    { "id": "pin1", "dashboard_id": "abc123", "context": "accounts", "position": 0, ... },
    { "id": "pin2", "dashboard_id": "def456", "context": "accounts", "position": 1, ... }
  ]
}
```

## React SDK

### Components

The React SDK provides ready-to-use components for pinning:

#### PinButton

A simple button to pin/unpin a dashboard to a single context.

```tsx
import { PinButton } from '@prismiq/react';

function DashboardCard({ dashboard }) {
  return (
    <div>
      <h3>{dashboard.name}</h3>
      <PinButton
        dashboardId={dashboard.id}
        context="favorites"
        label="Pin"
        unpinLabel="Unpin"
        onPinChange={(isPinned) => console.log('Pinned:', isPinned)}
      />
    </div>
  );
}
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dashboardId` | `string` | required | Dashboard ID to pin/unpin |
| `context` | `string` | required | Context to pin to |
| `label` | `string` | `"Pin"` | Button label when not pinned |
| `unpinLabel` | `string` | `"Unpin"` | Button label when pinned |
| `iconOnly` | `boolean` | `false` | Show only icon, no text |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `onPinChange` | `(isPinned: boolean) => void` | - | Callback after pin state changes |

#### PinMenu

A dropdown menu for pinning to multiple contexts.

```tsx
import { PinMenu } from '@prismiq/react';

const PIN_CONTEXTS = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'accounts', label: 'Accounts Page' },
  { id: 'home', label: 'Home Dashboard' },
];

function DashboardCard({ dashboard }) {
  return (
    <div>
      <h3>{dashboard.name}</h3>
      <PinMenu
        dashboardId={dashboard.id}
        contexts={PIN_CONTEXTS}
        onPinChange={(context, isPinned) => {
          console.log(`${context}: ${isPinned}`);
        }}
      />
    </div>
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `dashboardId` | `string` | Dashboard ID to pin/unpin |
| `contexts` | `PinContextOption[]` | Available contexts with `id`, `label`, optional `icon` |
| `onPinChange` | `(context: string, isPinned: boolean) => void` | Callback after pin state changes |

#### PinnedDashboardList

Displays a list of dashboards pinned to a context.

```tsx
import { PinnedDashboardList } from '@prismiq/react';

function FavoritesSection() {
  const [selectedDashboard, setSelectedDashboard] = useState(null);

  return (
    <PinnedDashboardList
      context="favorites"
      onSelect={setSelectedDashboard}
      emptyState={<p>No favorites yet. Pin dashboards to see them here.</p>}
    />
  );
}
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `context` | `string` | Context to show pins for |
| `onSelect` | `(dashboard: Dashboard) => void` | Called when user clicks a dashboard |
| `emptyState` | `ReactNode` | Custom empty state content |
| `renderItem` | `(dashboard, actions) => ReactNode` | Custom render for each item |

#### PinnedDashboardView

A complete view with list and dashboard display, including back navigation.

```tsx
import { PinnedDashboardView } from '@prismiq/react';
import type { Dashboard } from '@prismiq/react';

function AccountsDashboardSection() {
  const [selected, setSelected] = useState<Dashboard | null>(null);

  return (
    <PinnedDashboardView
      context="accounts"
      selectedDashboard={selected}
      onSelect={setSelected}
      onBack={() => setSelected(null)}
      backLabel="Back to Accounts"
      showUnpin={true}
      emptyState={
        <p>No dashboards pinned. Pin dashboards from the Analytics page.</p>
      }
    />
  );
}
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `context` | `string` | required | Context this view is for |
| `selectedDashboard` | `Dashboard \| null` | required | Currently selected dashboard (null = show list) |
| `onSelect` | `(dashboard: Dashboard) => void` | required | Called when user selects from list |
| `onBack` | `() => void` | required | Called when user clicks back |
| `showUnpin` | `boolean` | `true` | Show unpin button in header |
| `backLabel` | `string` | `"Back"` | Custom back button label |
| `emptyState` | `ReactNode` | - | Custom empty state for list |

### Hooks

For more control, use the lower-level hooks:

#### usePinnedDashboards

Fetch dashboards pinned to a context.

```tsx
import { usePinnedDashboards } from '@prismiq/react';

function MyComponent() {
  const { dashboards, isLoading, error, refetch } = usePinnedDashboards({
    context: 'accounts',
    enabled: true, // optional, default true
  });

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {dashboards?.map((d) => (
        <li key={d.id}>{d.name}</li>
      ))}
    </ul>
  );
}
```

#### useDashboardPinStatus

Check which contexts a dashboard is pinned to.

```tsx
import { useDashboardPinStatus } from '@prismiq/react';

function DashboardInfo({ dashboardId }) {
  const { pinnedContexts, isPinned, isLoading, refetch } = useDashboardPinStatus({
    dashboardId,
    contexts: ['accounts', 'home'], // optional filter
  });

  return (
    <div>
      <p>Pinned to: {pinnedContexts?.join(', ') || 'None'}</p>
      <p>Is pinned to accounts: {isPinned('accounts') ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

#### usePinMutations

Perform pin/unpin/reorder operations.

```tsx
import { usePinMutations } from '@prismiq/react';

function MyComponent() {
  const { pin, unpin, reorder, state } = usePinMutations();

  const handlePin = async () => {
    try {
      await pin('dashboard-123', 'favorites');
      console.log('Pinned!');
    } catch (err) {
      console.error('Failed to pin:', err);
    }
  };

  const handleReorder = async () => {
    // Reorder dashboards in the favorites context
    await reorder('favorites', ['dashboard-456', 'dashboard-123', 'dashboard-789']);
  };

  return (
    <div>
      <button onClick={handlePin} disabled={state.isLoading}>
        Pin Dashboard
      </button>
      {state.error && <p>Error: {state.error.message}</p>}
    </div>
  );
}
```

## Integration Patterns

### Pattern 1: Simple Favorites

Add a favorites button to dashboard cards:

```tsx
import { AnalyticsProvider, DashboardList, PinButton } from '@prismiq/react';

function App() {
  return (
    <AnalyticsProvider endpoint="/api/analytics" tenantId="t1" userId="u1">
      <DashboardList
        renderCard={(dashboard) => (
          <div className="dashboard-card">
            <h3>{dashboard.name}</h3>
            <PinButton dashboardId={dashboard.id} context="favorites" iconOnly />
          </div>
        )}
      />
    </AnalyticsProvider>
  );
}
```

### Pattern 2: Contextual Pinning

Pin dashboards to different pages in your app:

```tsx
// In your Accounts page
function AccountsPage() {
  const [dashboard, setDashboard] = useState(null);

  if (dashboard) {
    return (
      <div>
        <button onClick={() => setDashboard(null)}>Back to Accounts</button>
        <Dashboard id={dashboard.id} />
      </div>
    );
  }

  return (
    <div>
      <h1>Account Analytics</h1>
      <PinnedDashboardList context="accounts" onSelect={setDashboard} />
    </div>
  );
}
```

### Pattern 3: Multi-Context Pin Menu

Let users pin to multiple contexts from one menu:

```tsx
const CONTEXTS = [
  { id: 'home', label: 'Home Page', icon: <HomeIcon /> },
  { id: 'accounts', label: 'Accounts', icon: <AccountIcon /> },
  { id: 'reports', label: 'Reports', icon: <ReportIcon /> },
];

function DashboardActions({ dashboard }) {
  return (
    <div className="actions">
      <PinMenu dashboardId={dashboard.id} contexts={CONTEXTS} />
      <button>Edit</button>
      <button>Delete</button>
    </div>
  );
}
```

## Styling

All pin components use CSS custom properties for theming:

```css
:root {
  /* Colors */
  --prismiq-color-primary: #1976d2;
  --prismiq-color-primary-light: #e3f2fd;
  --prismiq-color-surface: #ffffff;
  --prismiq-color-surface-hover: #f5f5f5;
  --prismiq-color-border: #e0e0e0;
  --prismiq-color-text: #212121;
  --prismiq-color-text-muted: #757575;
  --prismiq-color-text-inverse: #ffffff;
  --prismiq-color-error: #d32f2f;
  --prismiq-color-error-light: #ffebee;

  /* Spacing */
  --prismiq-spacing-xs: 4px;
  --prismiq-spacing-sm: 8px;
  --prismiq-spacing-md: 12px;
  --prismiq-spacing-lg: 16px;
  --prismiq-spacing-xl: 24px;

  /* Typography */
  --prismiq-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --prismiq-font-size-xs: 11px;
  --prismiq-font-size-sm: 13px;
  --prismiq-font-size-base: 14px;
  --prismiq-font-size-lg: 16px;

  /* Borders */
  --prismiq-radius-sm: 4px;
  --prismiq-radius-md: 6px;

  /* Shadows */
  --prismiq-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --prismiq-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

## Multi-Tenant Considerations

Pins are automatically scoped by:
- **Tenant ID**: Set via `AnalyticsProvider` or `X-Tenant-ID` header
- **User ID**: Set via `AnalyticsProvider` or `X-User-ID` header

```tsx
<AnalyticsProvider
  endpoint="/api/analytics"
  tenantId={currentOrg.id}
  userId={currentUser.id}
>
  {/* Pins are isolated per tenant and user */}
  <PinnedDashboardList context="favorites" onSelect={handleSelect} />
</AnalyticsProvider>
```

## Database Schema

The pinning feature uses this table (auto-created by Prismiq):

```sql
CREATE TABLE prismiq_pinned_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  dashboard_id UUID NOT NULL REFERENCES prismiq_dashboards(id) ON DELETE CASCADE,
  context VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, dashboard_id, context)
);

CREATE INDEX idx_pinned_tenant_user_context
  ON prismiq_pinned_dashboards(tenant_id, user_id, context);
CREATE INDEX idx_pinned_dashboard
  ON prismiq_pinned_dashboards(dashboard_id);
```

## Error Handling

All components display user-friendly error messages. For custom error handling:

```tsx
import { usePinMutations } from '@prismiq/react';

function MyComponent() {
  const { pin, state } = usePinMutations();

  const handlePin = async () => {
    try {
      await pin(dashboardId, 'favorites');
      toast.success('Dashboard pinned!');
    } catch (err) {
      if (err.message.includes('already pinned')) {
        toast.info('Already in favorites');
      } else {
        toast.error('Failed to pin dashboard');
      }
    }
  };

  return <button onClick={handlePin}>Pin</button>;
}
```

## Next Steps

- [Getting Started](./getting-started.md) - Initial setup
- [Multi-Tenant Integration](./multi-tenant-integration.md) - Tenant isolation
- [API Reference](./api-reference.md) - Full API documentation
