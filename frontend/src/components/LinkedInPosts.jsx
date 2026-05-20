import { useEffect, useState } from 'react'
import { apiJson, api } from '../api'

// "LinkedIn Posts" tab — hiring posts filtered to the current search_terms.
// Click anywhere on a row to open the post on LinkedIn in a new tab.
// The Applied column shows whether the bot has already applied to / failed on
// the underlying Job ID (extracted from the post's apply URL).
function LinkedInPosts() {
  const [posts, setPosts] = useState([])
  const [matchedTerms, setMatchedTerms] = useState([])
  const [scanStatus, setScanStatus] = useState('not_running')
  const [mongoHealth, setMongoHealth] = useState(null)
  const [msg, setMsg] = useState('')

  const refresh = () => {
    apiJson('/api/linkedin-posts').then(d => {
      setPosts(d.posts || [])
      setMatchedTerms(d.matched_terms || [])
    })
  }
  const refreshStatus = () => apiJson('/api/feed-scan/status').then(s => setScanStatus(s.status))
  const refreshHealth = () => apiJson('/api/mongo/health').then(setMongoHealth).catch(() => setMongoHealth(null))

  useEffect(() => {
    refresh()
    refreshStatus()
    refreshHealth()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [])

  const startScan = async (dry = false) => {
    setMsg(dry ? 'Dry-run scan starting…' : 'Scan starting — opens a Chrome window…')
    await api('/api/feed-scan/start?dry_run=' + dry, { method: 'POST' })
    setTimeout(() => { refreshStatus(); refresh() }, 1500)
  }

  const openPost = (url) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const appliedBadge = (status) => {
    if (!status) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
    const bg = status === 'applied' ? '#2e7d32' : status === 'failed' ? '#c62828' : '#6d4c41'
    return (
      <span style={{
        background: bg, color: 'white', padding: '3px 9px', borderRadius: 12,
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
      }}>{status}</span>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">LinkedIn hiring posts matching your search terms</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Filtered to posts whose matched role, title, or excerpt mentions one of your
          configured <code>search_terms</code>. Click any row to open the post on LinkedIn.
          The Applied column shows whether the bot has already applied to the job.
        </p>
        {matchedTerms.length > 0 && (
          <div style={{ marginTop: 10, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Matching: </span>
            {matchedTerms.map(t => (
              <span key={t} style={{
                background: 'var(--accent, #1f6feb)', color: 'white', padding: '2px 8px',
                borderRadius: 10, fontSize: 12, marginRight: 6,
              }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button className="btn btn-primary" disabled={scanStatus === 'running'} onClick={() => startScan(false)}>
            {scanStatus === 'running' ? 'Scanning…' : 'Refresh from LinkedIn'}
          </button>
          <button className="btn" disabled={scanStatus === 'running'} onClick={() => startScan(true)}>Dry run</button>
          <button className="btn" onClick={refresh}>Reload</button>
          {mongoHealth && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>
              MongoDB:&nbsp;
              <b style={{ color: mongoHealth.ok ? '#66bb6a' : '#e57373' }}>
                {mongoHealth.ok ? 'connected' : (mongoHealth.enabled ? 'unreachable' : 'disabled')}
              </b>
            </span>
          )}
        </div>
        {msg && <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{msg}</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Posts ({posts.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: 8 }}>Company</th>
              <th>Matched role / Title</th>
              <th style={{ minWidth: 200 }}>Excerpt</th>
              <th>Confidence</th>
              <th>Applied?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => {
              const url = p['Post URL'] || p['Apply URL'] || ''
              return (
                <tr key={i}
                    onClick={() => openPost(url)}
                    style={{
                      borderTop: '1px solid var(--border)',
                      cursor: url ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (url) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: 8 }}>{p['Company']}</td>
                  <td>{p['Matched Role'] || p['Title']}</td>
                  <td style={{ maxWidth: 480, color: 'var(--text-secondary)' }}>{p['Post Excerpt']}</td>
                  <td>{Number(p['Confidence'] || 0).toFixed(2)}</td>
                  <td>{appliedBadge(p._applied_status)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {url ? <a href={url} target="_blank" rel="noreferrer">open ↗</a> : '—'}
                  </td>
                </tr>
              )
            })}
            {posts.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 12, color: 'var(--text-secondary)' }}>
                No posts yet — run a scan, or check that your search_terms match what the scraper found.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LinkedInPosts
