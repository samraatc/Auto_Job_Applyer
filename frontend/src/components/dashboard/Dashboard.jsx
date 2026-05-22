import { useState, useEffect } from 'react'
import { apiJson } from '../../api/client'

// ── Mini icon helper ──────────────────────────────────────────────────────────
function Ic({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, iconClass, label, value, change, changeDir }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {change != null && (
          <div className={`stat-change ${changeDir}`}>
            {changeDir === 'up' ? '▲' : '▼'} {change}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Activity item ─────────────────────────────────────────────────────────────
function ActivityItem({ company, role, status, time }) {
  const colorMap = {
    applied: 'badge-accent',
    rejected: 'badge-danger',
    viewed: 'badge-warning',
    interview: 'badge-success',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{role}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{company} · {time}</div>
      </div>
      <span className={`badge ${colorMap[status] || 'badge-muted'}`} style={{ marginLeft: 12, flexShrink: 0 }}>
        {status}
      </span>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
function Dashboard({ botStatus, checkStatus, setActiveTab }) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ applied: 0, viewed: 0, interviews: 0, resumes: 0 })
  const [recentActivity, setRecentActivity] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      // Try to load stats from backend; fall back gracefully
      const [applyData] = await Promise.allSettled([
        apiJson('/api/logs/summary'),
      ])
      if (applyData.status === 'fulfilled') {
        setStats(applyData.value)
      }
    } catch {
      // Stats unavailable — not critical
    } finally {
      setStatsLoading(false)
    }

    // Try to load recent activity
    try {
      const logs = await apiJson('/api/logs/recent?limit=5')
      setRecentActivity(logs)
    } catch {
      setRecentActivity([])
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      await fetch('/api/bot/start', { method: 'POST', credentials: 'include' })
      checkStatus()
      setActiveTab('logs')
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await fetch('/api/bot/stop', { method: 'POST', credentials: 'include' })
      checkStatus()
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const isRunning = botStatus === 'running'

  return (
    <div className="fade-in">
      {/* ── Stat Cards ───────────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard
          iconClass="accent"
          icon={<Ic d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />}
          label="Total Applied"
          value={statsLoading ? '—' : (stats.applied ?? 0)}
        />
        <StatCard
          iconClass="info"
          icon={<Ic d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0" />}
          label="Profile Views"
          value={statsLoading ? '—' : (stats.viewed ?? 0)}
        />
        <StatCard
          iconClass="success"
          icon={<Ic d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />}
          label="Interviews"
          value={statsLoading ? '—' : (stats.interviews ?? 0)}
        />
        <StatCard
          iconClass="warning"
          icon={<Ic d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />}
          label="Active Resumes"
          value={statsLoading ? '—' : (stats.resumes ?? 0)}
        />
      </div>

      {/* ── Main Controls ────────────────────────────────────────── */}
      <div className="grid-2">
        {/* Bot control card */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Accent glow if running */}
          {isRunning && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, #6366f1, #10b981)',
              borderRadius: '14px 14px 0 0',
            }} />
          )}
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ic d="M13 10V3L4 14h7v7l9-11h-7z" />
              Bot Controls
            </span>
            <span className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
              <span className={`dot ${isRunning ? 'dot-success' : 'dot-muted'}`}
                style={isRunning ? { animation: 'none' } : {}} />
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
            Ensure your resume and search rules are configured before starting. The bot will automatically apply to matching LinkedIn jobs.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              onClick={handleStart}
              disabled={loading || isRunning}
            >
              <Ic d="M5 3l14 9-14 9V3z" size={16} />
              Start Bot
            </button>
            <button
              className="btn btn-danger"
              onClick={handleStop}
              disabled={loading || !isRunning}
            >
              <Ic d="M6 6h12v12H6z" size={16} />
              Stop Bot
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setActiveTab('logs')}
            >
              <Ic d="M3 12h18M3 6h18M3 18h18" size={16} />
              View Logs
            </button>
          </div>
        </div>

        {/* System Status card */}
        <div className="card">
          <div className="card-title">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ic d="M22 12h-4l-3 9L9 3l-3 9H2" />
              System Status
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Bot Engine',    ok: true },
              { label: 'LinkedIn Auth', ok: true },
              { label: 'Database',      ok: true },
              { label: 'Task Queue',    ok: isRunning },
            ].map(({ label, ok }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.7rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
                <span className={`badge ${ok ? 'badge-success' : 'badge-muted'}`}>
                  {ok ? '✓ Online' : '○ Idle'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Search Rules',  tab: 'search',    icon: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm10 4-5.2-5.2' },
            { label: 'Upload Resume', tab: 'resumes',   icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' },
            { label: 'Applied Logs',  tab: 'appliedlog',icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
            { label: 'Settings',      tab: 'settings',  icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' },
          ].map(({ label, tab, icon }) => (
            <button key={tab} className="btn btn-secondary" onClick={() => setActiveTab(tab)}>
              <Ic d={icon} size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────────── */}
      {recentActivity.length > 0 && (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">
            Recent Activity
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('appliedlog')}>View all →</button>
          </div>
          {recentActivity.map((item, i) => (
            <ActivityItem key={i} {...item} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard
