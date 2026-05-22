import { useState, useEffect, useRef } from 'react'

// Nested TABS — a tab with `children` becomes a collapsible group.
// "Logs data" wraps Manual Apply / Apply Logs / Applied Logs so they're
// reachable from one place and the sidebar stays compact when collapsed.
const TABS = [
  { id: 'dashboard',   label: 'Dashboard' },
  { id: 'search',      label: 'Search Rules' },
  { id: 'resumes',     label: 'Resumes' },
  { id: 'companies',   label: 'Companies' },
  { id: 'posts',       label: 'Hiring Posts' },
  { id: 'linkedin',    label: 'LinkedIn Posts' },
  { id: 'logsdata',    label: 'Logs data', children: [
      { id: 'manual',     label: 'Manual Apply' },
      { id: 'applylog',   label: 'Apply Logs' },
      { id: 'appliedlog', label: 'Applied Logs' },
  ]},
  { id: 'config',      label: 'Raw Config' },
  { id: 'logs',        label: 'Live Logs' },
  { id: 'settings',    label: 'Settings' },
]

// Caret SVG — rotates 90° when group is open.
function Caret({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
         style={{
           transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
           transition: 'transform 220ms ease',
           marginLeft: 8, flexShrink: 0,
         }}>
      <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Sidebar({ activeTab, setActiveTab, onLogout, username }) {
  // Which collapsible groups are currently open. Keyed by group id.
  const [openGroups, setOpenGroups] = useState({})

  // Auto-open any group that contains the active tab so users never end up
  // with the highlighted child hidden behind a collapsed parent.
  useEffect(() => {
    for (const t of TABS) {
      if (!t.children) continue
      if (t.children.some(c => c.id === activeTab) && !openGroups[t.id]) {
        setOpenGroups(prev => ({ ...prev, [t.id]: true }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const toggleGroup = (id) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <aside className="sidebar">
      <h1>
        <span style={{ color: 'var(--accent)' }}>AI</span> Applier
      </h1>

      <nav className="nav-menu">
        {TABS.map(t => {
          if (t.children) {
            const isOpen = !!openGroups[t.id]
            const hasActiveChild = t.children.some(c => c.id === activeTab)
            return (
              <NavGroup
                key={t.id}
                tab={t}
                open={isOpen}
                hasActiveChild={hasActiveChild}
                activeTab={activeTab}
                onToggle={() => toggleGroup(t.id)}
                onSelect={setActiveTab}
              />
            )
          }
          return (
            <div
              key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </div>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
        <div style={{ marginBottom: 8 }}>Signed in as <b>{username}</b></div>
        <button className="btn" onClick={onLogout} style={{ width: '100%' }}>Sign out</button>
      </div>
    </aside>
  )
}

// NavGroup — collapsible parent with sliding children.
// We measure the children's natural height with a ref so the CSS
// max-height transition lands precisely (rather than guessing a magic
// number that breaks when labels grow).
function NavGroup({ tab, open, hasActiveChild, activeTab, onToggle, onSelect }) {
  const innerRef = useRef(null)
  const [innerHeight, setInnerHeight] = useState(0)

  useEffect(() => {
    if (innerRef.current) {
      setInnerHeight(innerRef.current.scrollHeight)
    }
  }, [tab.children, open])

  return (
    <div className="nav-group">
      <div
        className={`nav-item nav-group-header ${hasActiveChild && !open ? 'active' : ''}`}
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        role="button"
        aria-expanded={open}
      >
        <span>{tab.label}</span>
        <Caret open={open} />
      </div>

      <div
        className="nav-group-body"
        style={{
          maxHeight: open ? innerHeight : 0,
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 260ms ease, opacity 200ms ease',
        }}
        aria-hidden={!open}
      >
        <div ref={innerRef}
             style={{
               paddingTop: 6, paddingBottom: 2,
               display: 'flex', flexDirection: 'column', gap: '0.4rem',
             }}>
          {tab.children.map(c => (
            <div
              key={c.id}
              className={`nav-item nav-sub-item ${activeTab === c.id ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
              style={{
                marginLeft: 14,
                paddingLeft: 14,
                borderLeft: '2px solid var(--border)',
                fontSize: 13,
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Sidebar
