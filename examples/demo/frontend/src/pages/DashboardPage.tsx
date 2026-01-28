import { useState, CSSProperties, ReactNode } from 'react'
import {
  useTheme,
  useDashboards,
  useDashboardMutations,
  DashboardEditor,
  DashboardList,
  DashboardDialog,
  DashboardCard,
  PinMenu,
  Button,
  Icon,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from '@prismiq/react'
import type { DashboardCreate, DashboardUpdate, DashboardCardProps } from '@prismiq/react'

// Use the same Dashboard type that DashboardList uses
type Dashboard = NonNullable<Parameters<NonNullable<React.ComponentProps<typeof DashboardList>['onDashboardClick']>>[0]>

// Pin contexts available in the demo
const PIN_CONTEXTS = [
  { id: 'demo-favorites', label: 'Favorites' },
  { id: 'demo-home', label: 'Home Page' },
]

export function DashboardPage() {
  const { resolvedMode } = useTheme()
  const { data: dashboards, isLoading: loading, error: fetchError, refetch } = useDashboards()
  const { createDashboard, updateDashboard, deleteDashboard, state: mutationState } = useDashboardMutations()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null)

  const error = fetchError?.message ?? null

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

  // Handle dialog submit
  const handleDialogSubmit = async (data: DashboardCreate | DashboardUpdate) => {
    if (editingDashboard) {
      await updateDashboard(editingDashboard.id, data)
    } else {
      await createDashboard(data as DashboardCreate)
    }
    setDialogOpen(false)
    setEditingDashboard(null)
    await refetch()
  }

  // Handle dashboard click
  const handleDashboardClick = (dashboard: Dashboard) => {
    setSelectedId(dashboard.id)
  }

  // Handle edit
  const handleEdit = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard)
    setDialogOpen(true)
  }

  // Handle delete
  const handleDelete = async (dashboard: Dashboard) => {
    if (window.confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      await deleteDashboard(dashboard.id)
      if (selectedId === dashboard.id) {
        setSelectedId(null)
      }
      await refetch()
    }
  }

  // Handle create
  const handleCreate = () => {
    setEditingDashboard(null)
    setDialogOpen(true)
  }

  // Custom card renderer with PinMenu
  const renderDashboardCard = (dashboard: Dashboard, props: DashboardCardProps): ReactNode => {
    const actionsStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    }

    return (
      <DashboardCard
        key={dashboard.id}
        {...props}
        actions={
          <div style={actionsStyle} onClick={(e) => e.stopPropagation()}>
            <PinMenu
              dashboardId={dashboard.id}
              contexts={PIN_CONTEXTS}
            />
            <Dropdown
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Dashboard actions"
                >
                  <Icon name="more-vertical" size={16} />
                </Button>
              }
            >
              <DropdownItem onClick={() => handleEdit(dashboard)}>
                <Icon name="edit" size={14} />
                Edit
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => handleDelete(dashboard)}>
                <Icon name="trash" size={14} />
                Delete
              </DropdownItem>
            </Dropdown>
          </div>
        }
      />
    )
  }

  // Handle back to list
  const handleBackToList = () => {
    setSelectedId(null)
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

  // Show dashboard view when one is selected
  if (selectedId) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <button
            onClick={handleBackToList}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              border: `1px solid ${resolvedMode === 'dark' ? '#3f3f46' : '#d1d5db'}`,
              borderRadius: '6px',
              backgroundColor: 'transparent',
              color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
          {dashboards && dashboards.length > 0 && (
            <select
              style={selectStyle}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {dashboards.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
        <div style={contentStyle}>
          <DashboardEditor
            dashboardId={selectedId}
            onSave={() => refetch()}
          />
        </div>
      </div>
    )
  }

  // Show dashboard list
  return (
    <div style={containerStyle}>
      <DashboardList
        dashboards={dashboards}
        isLoading={loading}
        error={fetchError}
        onDashboardClick={handleDashboardClick}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        columns={3}
        renderCard={renderDashboardCard}
      />

      <DashboardDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingDashboard(null)
        }}
        onSubmit={handleDialogSubmit}
        dashboard={editingDashboard}
        isLoading={mutationState.isLoading}
        error={mutationState.error?.message}
      />
    </div>
  )
}
