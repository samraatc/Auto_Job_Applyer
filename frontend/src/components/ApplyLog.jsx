import { useEffect, useState } from 'react'
import { apiJson } from '../api'

function ApplyLog() {
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  const refresh = () => {
    apiJson('/api/applied-jobs?status=' + status).then(d => setJobs(d.jobs || []))
  }

  useEffect(() => { refresh() }, [status])

  const filtered = q
    ? jobs.filter(j => JSON.stringify(j).toLowerCase().includes(q.toLowerCase()))
    : jobs

  return (
    <div>
      <div className="card">
        <div className="card-title">Apply log ({filtered.length})</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="all">All</option>
            <option value="applied">Applied</option>
            <option value="failed">Failed</option>
          </select>
          <input placeholder="search title / company / id…" value={q} onChange={e => setQ(e.target.value)}
                 style={{ flex: 1, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn btn-primary" onClick={refresh}>Refresh</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: 8 }}>Status</th>
                <th>Job ID</th>
                <th>Title</th>
                <th>Company</th>
                <th>Date applied</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j, i) => {
                const link = j['Job Link'] || j.job_link || ''
                const status = j._status || j.status || 'applied'
                const bg = status === 'failed' ? '#c62828' : status === 'applied' ? '#2e7d32' : '#6d4c41'
                const open = () => link && window.open(link, '_blank', 'noopener,noreferrer')
                return (
                  <tr key={i}
                      onClick={open}
                      style={{ borderTop: '1px solid var(--border)', cursor: link ? 'pointer' : 'default' }}
                      onMouseEnter={e => { if (link) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: 8 }}>
                      <span style={{
                        background: bg, color: 'white', padding: '3px 9px', borderRadius: 12,
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>{status}</span>
                    </td>
                    <td>{j['Job ID'] || j.job_id}</td>
                    <td>{j['Title'] || j.title}</td>
                    <td>{j['Company'] || j.company}</td>
                    <td>{j['Date Applied'] || j.date_applied}</td>
                    <td onClick={e => e.stopPropagation()}>{link ? <a href={link} target="_blank" rel="noreferrer">open ↗</a> : '—'}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 12, color: 'var(--text-secondary)' }}>No rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ApplyLog
