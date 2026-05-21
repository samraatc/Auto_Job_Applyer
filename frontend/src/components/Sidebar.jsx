const TABS = [
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'search',      label: 'Search Rules' },
  { id: 'resumes',     label: 'Resumes' },
  { id: 'companies',   label: 'Companies' },
  { id: 'posts',       label: 'Hiring Posts' },
  { id: 'linkedin',    label: 'LinkedIn Posts' },
  { id: 'applylog',    label: 'Apply Log' },
  { id: 'config',      label: 'Raw Config' },
  { id: 'logs',        label: 'Live Logs' },
  { id: 'settings',    label: 'Settings' },
]

function Sidebar({ activeTab, setActiveTab, onLogout, username }) {
  return (
    <aside className="sidebar">
      <h1>
        <span style={{ color: 'var(--accent)' }}>AI</span> Applier
      </h1>

      <nav className="nav-menu">
        {TABS.map(t => (
          <div
            key={t.id}
            className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </div>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
        <div style={{ marginBottom: 8 }}>Signed in as <b>{username}</b></div>
        <button className="btn" onClick={onLogout} style={{ width: '100%' }}>Sign out</button>
      </div>
    </aside>
  )
}

export default Sidebar
