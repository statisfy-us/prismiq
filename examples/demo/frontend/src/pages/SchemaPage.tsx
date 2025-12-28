import { CSSProperties } from 'react'
import { useTheme, SchemaExplorer } from '@prismiq/react'

export function SchemaPage() {
  const { resolvedMode } = useTheme()

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

  const descriptionStyle: CSSProperties = {
    fontSize: '14px',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    backgroundColor: resolvedMode === 'dark' ? '#18181b' : '#ffffff',
    borderRadius: '12px',
    border: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    overflow: 'hidden',
    padding: '20px',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Database Schema</h1>
        <p style={descriptionStyle}>
          Browse tables, columns, and relationships in your database
        </p>
      </div>

      <div style={contentStyle}>
        <SchemaExplorer />
      </div>
    </div>
  )
}
