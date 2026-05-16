import { useEffect, useState } from 'react'
import { apiJson, api } from '../api'

function Companies() {
  const [rows, setRows] = useState([])
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [discoverStatus, setDiscoverStatus] = useState('not_running')

  const refresh = () => apiJson('/api/companies').then(d => setRows(d.target_companies || []))
  const refreshStatus = () => apiJson('/api/companies/discover/status').then(s => setDiscoverStatus(s.status))

  useEffect(() => {
    refresh()
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [])

  const save = async (next) => {
    setBusy(true); setMsg('')
    try {
      await apiJson('/api/companies', { method: 'POST', body: JSON.stringify({ target_companies: next }) })
      setRows(next); setMsg('Saved.')
    } catch (e) { setMsg('Save failed: ' + e.message) } finally { setBusy(false) }
  }

  const add = (e) => {
    e.preventDefault()
    if (!newName || !newUrl) return
    const next = [...rows, { name: newName, linkedin_url: newUrl, tags: [] }]
    setNewName(''); setNewUrl('')
    save(next)
  }
  const remove = (i) => save(rows.filter((_, idx) => idx !== i))

  const triggerDiscover = async () => {
    setMsg('Discovery starting — opens a Chrome window…')
    await api('/api/companies/discover', { method: 'POST' })
    setTimeout(() => { refresh(); refreshStatus() }, 1500)
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Auto-discover companies for your search roles</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Runs a LinkedIn job search for each of your <code>search_terms</code> and collects the
          companies appearing in the results. Discovered companies are merged into the list below.
          Their /posts feeds are then scanned for hiring posts.
        </p>
        <button className="btn btn-primary" disabled={discoverStatus === 'running'} onClick={triggerDiscover}>
          {discoverStatus === 'running' ? 'Discovering…' : 'Run discovery'}
        </button>
        {msg && <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Target companies ({rows.length})</div>
        <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)}
                 style={{ flex: 1, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <input placeholder="https://www.linkedin.com/company/..." value={newUrl} onChange={e => setNewUrl(e.target.value)}
                 style={{ flex: 2, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn btn-primary" disabled={busy}>Add</button>
        </form>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: 8 }}>Name</th><th>URL</th><th>Tags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: 8 }}>{c.name}</td>
                <td><a href={c.linkedin_url} target="_blank" rel="noreferrer">{c.linkedin_url}</a></td>
                <td>{(c.tags || []).join(', ')}</td>
                <td><button className="btn btn-danger" onClick={() => remove(i)}>Remove</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: 'var(--text-secondary)' }}>No companies yet. Add one above or run discovery.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Companies
