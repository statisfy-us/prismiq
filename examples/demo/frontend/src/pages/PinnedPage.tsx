import { useState, CSSProperties } from 'react'
import {
  useTheme,
  PinnedDashboardView,
} from '@prismiq/react'

// Use the same Dashboard type that PinnedDashboardView uses
type Dashboard = NonNullable<React.ComponentProps<typeof PinnedDashboardView>['selectedDashboard']>

// Pin context for the demo
const DEMO_CONTEXT = 'demo-favorites'

export function PinnedPage() {
  const { resolvedMode } = useTheme()
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null)

  const containerStyle: CSSProperties = {
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle: CSSProperties = {
    marginBottom: '24px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
    marginBottom: '8px',
  }

  const subtitleStyle: CSSProperties = {
    fontSize: '14px',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    backgroundColor: resolvedMode === 'dark' ? '#18181b' : '#ffffff',
    borderRadius: '12px',
    border: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    overflow: 'hidden',
  }

  const emptyStateStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    textAlign: 'center',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  }

  return (
    <div style={containerStyle} data-testid="pinned-page">
      <div style={headerStyle}>
        <h1 style={titleStyle}>Pinned Dashboards</h1>
        <p style={subtitleStyle}>
          Quick access to your favorite dashboards. Pin dashboards from the Dashboard page.
        </p>
      </div>
      <div style={contentStyle}>
        <PinnedDashboardView
          context={DEMO_CONTEXT}
          selectedDashboard={selectedDashboard}
          onSelect={setSelectedDashboard}
          onBack={() => setSelectedDashboard(null)}
          backLabel="Back to Pinned"
          emptyState={
            <div style={emptyStateStyle}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 1 2-2h0a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2z" />
              </svg>
              <p style={{ marginTop: '16px', fontWeight: 500 }}>No pinned dashboards</p>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                Go to the Dashboard page and click the pin icon on a dashboard to add it here.
              </p>
            </div>
          }
        />
      </div>
    </div>
  )
}
