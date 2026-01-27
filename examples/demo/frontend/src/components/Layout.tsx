import { Outlet, NavLink } from 'react-router-dom'
import { useTheme } from '@prismiq/react'
import { CSSProperties } from 'react'

export function Layout() {
  const { setMode, resolvedMode } = useTheme()

  const toggleMode = () => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark')
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    height: '100vh',
    backgroundColor: resolvedMode === 'dark' ? '#1a1a2e' : '#f5f7fa',
    color: resolvedMode === 'dark' ? '#e4e4e7' : '#1f2937',
  }

  const sidebarStyle: CSSProperties = {
    width: '240px',
    backgroundColor: resolvedMode === 'dark' ? '#16162a' : '#ffffff',
    borderRight: `1px solid ${resolvedMode === 'dark' ? '#2d2d4a' : '#e5e7eb'}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
  }

  const logoStyle: CSSProperties = {
    padding: '0 20px 20px',
    borderBottom: `1px solid ${resolvedMode === 'dark' ? '#2d2d4a' : '#e5e7eb'}`,
    marginBottom: '16px',
  }

  const logoTextStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  }

  const navStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '0 12px',
    flex: 1,
  }

  const baseLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  }

  const getLinkStyle = (isActive: boolean): CSSProperties => ({
    ...baseLinkStyle,
    backgroundColor: isActive
      ? resolvedMode === 'dark' ? '#3730a3' : '#eef2ff'
      : 'transparent',
    color: isActive
      ? resolvedMode === 'dark' ? '#c7d2fe' : '#4f46e5'
      : resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  })

  const themeToggleStyle: CSSProperties = {
    margin: '16px 12px 0',
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${resolvedMode === 'dark' ? '#2d2d4a' : '#e5e7eb'}`,
    backgroundColor: resolvedMode === 'dark' ? '#1a1a2e' : '#f9fafb',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
  }

  const mainStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
  }

  return (
    <div style={containerStyle}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <span style={logoTextStyle}>Prismiq</span>
        </div>

        <nav style={navStyle}>
          <NavLink
            to="/dashboard"
            style={({ isActive }) => getLinkStyle(isActive)}
          >
            <DashboardIcon />
            Dashboard
          </NavLink>

          <NavLink
            to="/pinned"
            style={({ isActive }) => getLinkStyle(isActive)}
          >
            <PinIcon />
            Pinned
          </NavLink>

          <NavLink
            to="/explore"
            style={({ isActive }) => getLinkStyle(isActive)}
          >
            <ExploreIcon />
            Explore
          </NavLink>

          <NavLink
            to="/schema"
            style={({ isActive }) => getLinkStyle(isActive)}
          >
            <SchemaIcon />
            Schema
          </NavLink>
        </nav>

        <button style={themeToggleStyle} onClick={toggleMode}>
          {resolvedMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          {resolvedMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </aside>

      <main style={mainStyle}>
        <Outlet />
      </main>
    </div>
  )
}

// Simple SVG icons
function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 1 2-2h0a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ExploreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function SchemaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
