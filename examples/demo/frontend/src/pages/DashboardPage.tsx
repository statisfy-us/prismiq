import { useState, useEffect, CSSProperties } from 'react'
import { useTheme, useAnalytics, Dashboard } from '@prismiq/react'
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
  }, [client])

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
        {!selectedId ? (
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
          <Dashboard id={selectedId} showTitle={false} />
        )}
      </div>
    </div>
  )
}
