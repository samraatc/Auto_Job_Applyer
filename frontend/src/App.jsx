import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ConfigEditor from './components/ConfigEditor'
import Terminal from './components/Terminal'
import Login from './components/Login'
import SearchRules from './components/SearchRules'
import Resumes from './components/Resumes'
import Companies from './components/Companies'
import HiringPosts from './components/HiringPosts'
import LinkedInPosts from './components/LinkedInPosts'
import ManualApply from './components/ManualApply'
import ApplyLog from './components/ApplyLog'
import AppliedLogs from './components/AppliedLogs'
import Settings from './components/Settings'
import { apiJson, api } from './api'

const TAB_TITLES = {
  dashboard: 'Dashboard',
  search: 'Search Rules',
  resumes: 'Resumes',
  companies: 'Companies',
  posts: 'Hiring Posts',
  linkedin: 'LinkedIn Posts',
  manual: 'Manual Apply',
  applylog: 'Apply Logs',
  appliedlog: 'Applied Logs',
  config: 'Raw Config',
  logs: 'Live Logs',
  settings: 'Settings',
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [botStatus, setBotStatus] = useState('stopped')
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  // Mobile sidebar drawer state. Toggled by the burger button in the header,
  // closed automatically when the user picks a tab or clicks the scrim.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Sync drawer state to the body so CSS can slide the sidebar in/out.
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    return () => document.body.classList.remove('sidebar-open')
  }, [sidebarOpen])

  // Close drawer on tab change — mobile users expect navigation to dismiss it.
  const navigate = (id) => {
    setActiveTab(id)
    if (sidebarOpen) setSidebarOpen(false)
  }

  const checkStatus = () => {
    fetch('/api/bot/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setBotStatus(data.status === 'running' ? 'running' : 'stopped'))
      .catch(() => {})
  }

  const checkAuth = () => {
    apiJson('/api/auth/me')
      .then(d => setUser(d.username))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true))
  }

  useEffect(() => {
    checkAuth()
    const onUnauth = () => setUser(null)
    window.addEventListener('aja:unauthenticated', onUnauth)
    return () => window.removeEventListener('aja:unauthenticated', onUnauth)
  }, [])

  useEffect(() => {
    if (!user) return
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [user])

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  if (!authChecked) return <div style={{ padding: 24 }}>Loading…</div>
  if (!user) return <Login onLogin={u => { setUser(u); checkStatus() }} />

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={navigate} onLogout={logout} username={user} />

      {/* Scrim — visible only when the mobile drawer is open. Tapping it
          dismisses the sidebar without picking a tab. */}
      <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />

      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="sidebar-toggle"
              aria-label="Toggle navigation"
              onClick={() => setSidebarOpen(v => !v)}>
              ☰
            </button>
            <h2>{TAB_TITLES[activeTab] || ''}</h2>
          </div>
          <div className={`status-badge ${botStatus}`}>
            <span className={`terminal-dot ${botStatus === 'running' ? 'green' : 'red'}`}></span>
            Bot {botStatus === 'running' ? 'Running' : 'Stopped'}
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'dashboard' && <Dashboard botStatus={botStatus} checkStatus={checkStatus} setActiveTab={navigate} />}
          {activeTab === 'search' && <SearchRules />}
          {activeTab === 'resumes' && <Resumes />}
          {activeTab === 'companies' && <Companies />}
          {activeTab === 'posts' && <HiringPosts />}
          {activeTab === 'linkedin' && <LinkedInPosts />}
          {activeTab === 'manual' && <ManualApply />}
          {activeTab === 'applylog' && <ApplyLog />}
          {activeTab === 'appliedlog' && <AppliedLogs />}
          {activeTab === 'config' && <ConfigEditor />}
          {activeTab === 'logs' && <Terminal botStatus={botStatus} />}
          {activeTab === 'settings' && <Settings username={user} />}
        </div>
      </main>
    </div>
  )
}

export default App
