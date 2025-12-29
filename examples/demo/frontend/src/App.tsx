import { AnalyticsProvider, ThemeProvider } from '@prismiq/react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ExplorePage } from './pages/ExplorePage'
import { SchemaPage } from './pages/SchemaPage'

export function App() {
  return (
    <ThemeProvider defaultMode="system">
      <AnalyticsProvider config={{ endpoint: '/api' }}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="schema" element={<SchemaPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AnalyticsProvider>
    </ThemeProvider>
  )
}
