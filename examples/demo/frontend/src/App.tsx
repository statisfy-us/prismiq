import { AnalyticsProvider, ThemeProvider } from '@prismiq/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { PinnedPage } from './pages/PinnedPage'
import { ExplorePage } from './pages/ExplorePage'
import { SchemaPage } from './pages/SchemaPage'

// Demo uses a fixed tenant for simplicity
// In production, this would come from your auth system
const DEMO_TENANT_ID = 'demo-tenant'
const DEMO_USER_ID = 'demo-user'

export function App() {
  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider
        config={{ endpoint: '/api' }}
        tenantId={DEMO_TENANT_ID}
        userId={DEMO_USER_ID}
      >
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="pinned" element={<PinnedPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="schema" element={<SchemaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AnalyticsProvider>
    </ThemeProvider>
  )
}
