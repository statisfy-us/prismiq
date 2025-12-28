import { useState, useEffect, CSSProperties } from 'react'
import { useTheme, useAnalytics } from '@prismiq/react'
import type { DashboardDefinition } from '@prismiq/react'

export function DashboardPage() {
  const { resolvedMode } = useTheme()
  const { client } = useAnalytics()
  const [dashboards, setDashboards] = useState<DashboardDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch available dashboards
  useEffect(() => {
    async function fetchDashboards() {
      try {
        setLoading(true)
        const response = await client.get<{ dashboards: DashboardDefinition[] }>('/dashboards')
        setDashboards(response.dashboards)
        if (response.dashboards.length > 0 && !selectedId) {
          setSelectedId(response.dashboards[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboards')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboards()
  }, [client, selectedId])

  const containerStyle: CSSProperties = {
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: 600,
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
  }

  const selectStyle: CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: `1px solid ${resolvedMode === 'dark' ? '#3f3f46' : '#d1d5db'}`,
    backgroundColor: resolvedMode === 'dark' ? '#27272a' : '#ffffff',
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
    fontSize: '14px',
    cursor: 'pointer',
    minWidth: '200px',
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    backgroundColor: resolvedMode === 'dark' ? '#18181b' : '#ffffff',
    borderRadius: '12px',
    border: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    overflow: 'hidden',
  }

  const loadingStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  }

  const errorStyleDef: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#ef4444',
  }

  const emptyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
    gap: '12px',
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>Loading dashboards...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={errorStyleDef}>Error: {error}</div>
      </div>
    )
  }

  const selectedDashboard = dashboards.find(d => d.id === selectedId)

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Dashboards</h1>
        {dashboards.length > 0 && (
          <select
            style={selectStyle}
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      <div style={contentStyle}>
        {!selectedDashboard ? (
          <div style={emptyStyle}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>No dashboards available</span>
            <span style={{ fontSize: '14px' }}>Run the seed script to create sample dashboards</span>
          </div>
        ) : (
          <DashboardView dashboard={selectedDashboard} />
        )}
      </div>
    </div>
  )
}

interface DashboardViewProps {
  dashboard: DashboardDefinition
}

function DashboardView({ dashboard }: DashboardViewProps) {
  const { resolvedMode } = useTheme()

  const containerStyle: CSSProperties = {
    padding: '24px',
    height: '100%',
    overflowY: 'auto',
  }

  const descriptionStyle: CSSProperties = {
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
    marginBottom: '24px',
    fontSize: '14px',
  }

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '16px',
  }

  const getWidgetStyle = (position: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    gridColumn: `${position.x + 1} / span ${position.w}`,
    gridRow: `${position.y + 1} / span ${position.h}`,
    backgroundColor: resolvedMode === 'dark' ? '#27272a' : '#f9fafb',
    borderRadius: '8px',
    border: `1px solid ${resolvedMode === 'dark' ? '#3f3f46' : '#e5e7eb'}`,
    padding: '16px',
    minHeight: `${position.h * 80}px`,
  })

  const widgetTitleStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
  }

  const widgetContentStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100% - 32px)',
    color: resolvedMode === 'dark' ? '#71717a' : '#9ca3af',
    fontSize: '14px',
  }

  return (
    <div style={containerStyle}>
      {dashboard.description && (
        <p style={descriptionStyle}>{dashboard.description}</p>
      )}

      <div style={gridStyle}>
        {dashboard.widgets?.map((widget) => (
          <div key={widget.id} style={getWidgetStyle(widget.position)}>
            <div style={widgetTitleStyle}>{widget.title}</div>
            <div style={widgetContentStyle}>
              <WidgetPlaceholder type={widget.type} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WidgetPlaceholder({ type }: { type: string }) {
  const iconMap: Record<string, JSX.Element> = {
    metric: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    bar_chart: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
    line_chart: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-3 3" />
      </svg>
    ),
    pie_chart: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
    area_chart: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M3 15l5-5 4 4 8-8v12H3z" fill="currentColor" opacity="0.2" />
      </svg>
    ),
    scatter_chart: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="15" r="2" />
        <circle cx="12" cy="9" r="2" />
        <circle cx="17" cy="13" r="2" />
        <circle cx="9" cy="5" r="2" />
      </svg>
    ),
    table: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </svg>
    ),
  }

  return iconMap[type] || (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}
