import { useState, CSSProperties } from 'react'
import { useTheme, QueryBuilder, ResultsTable, useQuery } from '@prismiq/react'
import type { QueryDefinition } from '@prismiq/react'

export function ExplorePage() {
  const { resolvedMode } = useTheme()
  const [query, setQuery] = useState<QueryDefinition | null>(null)
  const { data, isLoading, error } = useQuery(query, { enabled: !!query })

  const containerStyle: CSSProperties = {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
  }

  const sidebarStyle: CSSProperties = {
    width: '400px',
    borderRight: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    backgroundColor: resolvedMode === 'dark' ? '#18181b' : '#ffffff',
    overflowY: 'auto',
    padding: '24px',
  }

  const mainStyle: CSSProperties = {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
    backgroundColor: resolvedMode === 'dark' ? '#1a1a2e' : '#f5f7fa',
  }

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
  }

  const resultContainerStyle: CSSProperties = {
    backgroundColor: resolvedMode === 'dark' ? '#18181b' : '#ffffff',
    borderRadius: '12px',
    border: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    overflow: 'hidden',
    height: '100%',
  }

  const resultHeaderStyle: CSSProperties = {
    padding: '16px 20px',
    borderBottom: `1px solid ${resolvedMode === 'dark' ? '#27272a' : '#e5e7eb'}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }

  const resultTitleStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: 600,
    color: resolvedMode === 'dark' ? '#f4f4f5' : '#111827',
  }

  const metaStyle: CSSProperties = {
    fontSize: '13px',
    color: resolvedMode === 'dark' ? '#71717a' : '#9ca3af',
  }

  const resultContentStyle: CSSProperties = {
    padding: '16px',
    height: 'calc(100% - 60px)',
    overflowY: 'auto',
  }

  const emptyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: resolvedMode === 'dark' ? '#71717a' : '#9ca3af',
    gap: '12px',
  }

  const loadingStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: resolvedMode === 'dark' ? '#a1a1aa' : '#6b7280',
  }

  const errorStyle: CSSProperties = {
    padding: '16px',
    backgroundColor: resolvedMode === 'dark' ? '#3b1d1d' : '#fef2f2',
    borderRadius: '8px',
    color: resolvedMode === 'dark' ? '#fca5a5' : '#dc2626',
    fontSize: '14px',
  }

  return (
    <div style={containerStyle}>
      <div style={sidebarStyle}>
        <h2 style={titleStyle}>Query Builder</h2>
        <QueryBuilder onQueryChange={setQuery} />
      </div>

      <div style={mainStyle}>
        <div style={resultContainerStyle}>
          <div style={resultHeaderStyle}>
            <span style={resultTitleStyle}>Results</span>
            {data && (
              <span style={metaStyle}>
                {data.rows.length} rows ({data.execution_time_ms}ms)
              </span>
            )}
          </div>

          <div style={resultContentStyle}>
            {!query && (
              <div style={emptyStyle}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span>Build a query to see results</span>
                <span style={{ fontSize: '14px' }}>
                  Select tables and columns from the sidebar
                </span>
              </div>
            )}

            {query && isLoading && (
              <div style={loadingStyle}>
                <span>Executing query...</span>
              </div>
            )}

            {error && (
              <div style={errorStyle}>
                Error: {error instanceof Error ? error.message : 'Query failed'}
              </div>
            )}

            {data && data.rows.length === 0 && (
              <div style={emptyStyle}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                </svg>
                <span>No results found</span>
                <span style={{ fontSize: '14px' }}>
                  Try adjusting your filters or selecting different columns
                </span>
              </div>
            )}

            {data && data.rows.length > 0 && (
              <ResultsTable result={data} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
