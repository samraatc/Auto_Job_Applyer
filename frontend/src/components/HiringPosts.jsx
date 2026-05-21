import { useEffect, useState } from 'react'
import { apiJson, api } from '../api'

function HiringPosts() {
  const [posts, setPosts] = useState([])
  const [roleFilter, setRoleFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [scanStatus, setScanStatus] = useState('not_running')
  const [msg, setMsg] = useState('')

  const refresh = () => {
    const params = new URLSearchParams()
    if (roleFilter) params.set('role', roleFilter)
    if (companyFilter) params.set('company', companyFilter)
    apiJson('/api/hiring-posts?' + params.toString()).then(d => setPosts(d.posts || []))
  }
  const refreshStatus = () => apiJson('/api/feed-scan/status').then(s => setScanStatus(s.status))

  useEffect(() => {
    refresh()
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [])

  const startScan = async (dry = false) => {
    setMsg(dry ? 'Dry-run scan starting…' : 'Scan starting — opens a Chrome window…')
    await api('/api/feed-scan/start?dry_run=' + dry, { method: 'POST' })
    setTimeout(refreshStatus, 1500)
  }
  const stopScan = async () => {
    await api('/api/feed-scan/stop', { method: 'POST' })
    refreshStatus()
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Hiring posts on company LinkedIn feeds</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          The feed scanner visits every company in your target list, scrolls their /posts page,
          and uses the LLM (or a regex fallback) to flag posts advertising open roles. Hits are
          listed below; click a post to open it on LinkedIn.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={scanStatus === 'running'} onClick={() => startScan(false)}>
            {scanStatus === 'running' ? 'Scanning…' : 'Start scan'}
          </button>
          <button className="btn" disabled={scanStatus === 'running'} onClick={() => startScan(true)}>Dry run</button>
          <button className="btn btn-danger" disabled={scanStatus !== 'running'} onClick={stopScan}>Stop</button>
        </div>
        {msg && <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{msg}</div>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Filter</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="role contains…" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                 style={{ flex: 1, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <input placeholder="company contains…" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                 style={{ flex: 1, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn btn-primary" onClick={refresh}>Apply</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Posts ({posts.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: 8 }}>Company</th><th>Matched role</th><th>Excerpt</th><th>Confidence</th><th>Applied?</th><th>Link</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p, i) => {
              const url = p['Post URL'] || p['Apply URL'] || ''
              const open = () => url && window.open(url, '_blank', 'noopener,noreferrer')
              const st = p._applied_status
              return (
                <tr key={i}
                    onClick={open}
                    style={{ borderTop: '1px solid var(--border)', cursor: url ? 'pointer' : 'default' }}
                    onMouseEnter={e => { if (url) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: 8 }}>{p['Company']}</td>
                  <td>{p['Matched Role'] || p['Title']}</td>
                  <td style={{ maxWidth: 480 }}>{p['Post Excerpt']}</td>
                  <td>{Number(p['Confidence'] || 0).toFixed(2)}</td>
                  <td>{st
                    ? <span style={{ background: st === 'applied' ? '#2e7d32' : '#c62828', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{st}</span>
                    : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}</td>
                  <td onClick={e => e.stopPropagation()}>{url ? <a href={url} target="_blank" rel="noreferrer">open ↗</a> : '—'}</td>
                </tr>
              )
            })}
            {posts.length === 0 && <tr><td colSpan={6} style={{ padding: 12, color: 'var(--text-secondary)' }}>No posts yet — run a scan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default HiringPosts
