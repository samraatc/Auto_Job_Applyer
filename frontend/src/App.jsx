import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './components/dashboard/Dashboard'
import Overview from './components/dashboard/Overview'
import ConfigEditor from './components/settings/ConfigEditor'
import Terminal from './components/dashboard/Terminal'
import Login from './components/auth/Login'
import SearchRules from './components/settings/SearchRules'
import Resumes from './components/resumes/Resumes'
import Companies from './components/jobs/Companies'
import HiringPosts from './components/jobs/HiringPosts'
import LinkedInPosts from './components/linkedin/LinkedInPosts'
import ManualApply from './components/linkedin/ManualApply'
import ApplyLog from './components/jobs/ApplyLog'
import AppliedLogs from './components/jobs/AppliedLogs'
import Settings from './components/settings/Settings'
import LandingPage from './components/public/LandingPage'
import OnboardingWizard from './components/onboarding/OnboardingWizard'

// ── Public Route Wrapper ────────────────────────────────────────
function PublicRoute({ children }) {
  const { user, authChecked } = useAuth()
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <span>Loading...</span>
      </div>
    )
  }
  // Redirect logged-in users to the dashboard instead of the landing page/login
  if (user) return <Navigate to="/app" replace />
  return children
}

// ── Protected Route Wrapper ───────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, authChecked } = useAuth()
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-foreground">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <span>Loading...</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ── App Shell (Dashboard Layout) ──────────────────────────────────
function AppShell({ children }) {
  const { user, logout } = useAuth()
  const [botStatus, setBotStatus] = useState('stopped')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    return () => document.body.classList.remove('sidebar-open')
  }, [sidebarOpen])

  const checkStatus = () => {
    fetch('/api/bot/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBotStatus(d.status === 'running' ? 'running' : 'stopped'))
      .catch(() => {})
  }

  useEffect(() => {
    checkStatus()
    const id = setInterval(checkStatus, 5000)
    return () => clearInterval(id)
  }, [])

  const isRunning = botStatus === 'running'

  return (
    <div className="flex h-screen bg-background overflow-hidden w-full">
      <Sidebar
        isOpen={sidebarOpen}
        onLogout={logout}
        closeSidebar={() => setSidebarOpen(false)}
      />

      {/* Mobile scrim */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="main-content flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-foreground p-2 -ml-2 rounded-md hover:bg-secondary"
              onClick={() => setSidebarOpen(v => !v)}
            >
              ☰
            </button>
            <h2 className="font-semibold text-lg">Dashboard</h2>
          </div>

          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${isRunning ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground'}`}>
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              Bot {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────
function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          
          {/* Onboarding */}
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingWizard />
            </ProtectedRoute>
          } />

          {/* Dashboard Application Routes */}
          <Route path="/app" element={
            <ProtectedRoute>
              <AppShell>
                <Overview />
              </AppShell>
            </ProtectedRoute>
          } />

          {/* Fallback to old dashboard while migrating */}
          <Route path="/app/bot" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
          <Route path="/app/search" element={<ProtectedRoute><AppShell><SearchRules /></AppShell></ProtectedRoute>} />
          <Route path="/app/resumes" element={<ProtectedRoute><AppShell><Resumes /></AppShell></ProtectedRoute>} />
          <Route path="/app/companies" element={<ProtectedRoute><AppShell><Companies /></AppShell></ProtectedRoute>} />
          <Route path="/app/posts" element={<ProtectedRoute><AppShell><HiringPosts /></AppShell></ProtectedRoute>} />
          <Route path="/app/linkedin" element={<ProtectedRoute><AppShell><LinkedInPosts /></AppShell></ProtectedRoute>} />
          <Route path="/app/manual" element={<ProtectedRoute><AppShell><ManualApply /></AppShell></ProtectedRoute>} />
          <Route path="/app/applylog" element={<ProtectedRoute><AppShell><ApplyLog /></AppShell></ProtectedRoute>} />
          <Route path="/app/appliedlog" element={<ProtectedRoute><AppShell><AppliedLogs /></AppShell></ProtectedRoute>} />
          <Route path="/app/config" element={<ProtectedRoute><AppShell><ConfigEditor /></AppShell></ProtectedRoute>} />
          <Route path="/app/logs" element={<ProtectedRoute><AppShell><Terminal /></AppShell></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute><AppShell><Settings /></AppShell></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  )
}

export default App
