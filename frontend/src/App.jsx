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
import ApplyLog from './components/ApplyLog'
import Settings from './components/Settings'
import { apiJson, api } from './api'

const TAB_TITLES = {
  dashboard: 'Dashboard',
  search: 'Search Rules',
  resumes: 'Resumes',
  companies: 'Companies',
  posts: 'Hiring Posts',
  applylog: 'Apply Log',
  config: 'Raw Config',
  logs: 'Live Logs',
  settings: 'Settings',
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [botStatus, setBotStatus] = useState('stopped')
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

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
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={logout} username={user} />

      <main className="main-content">
        <header className="header">
          <h2>{TAB_TITLES[activeTab] || ''}</h2>
          <div className={`status-badge ${botStatus}`}>
            <span className={`terminal-dot ${botStatus === 'running' ? 'green' : 'red'}`}></span>
            Bot {botStatus === 'running' ? 'Running' : 'Stopped'}
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'dashboard' && <Dashboard botStatus={botStatus} checkStatus={checkStatus} setActiveTab={setActiveTab} />}
          {activeTab === 'search' && <SearchRules />}
          {activeTab === 'resumes' && <Resumes />}
          {activeTab === 'companies' && <Companies />}
          {activeTab === 'posts' && <HiringPosts />}
          {activeTab === 'applylog' && <ApplyLog />}
          {activeTab === 'config' && <ConfigEditor />}
          {activeTab === 'logs' && <Terminal botStatus={botStatus} />}
          {activeTab === 'settings' && <Settings username={user} />}
        </div>
      </main>
    </div>
  )
}

export default App
