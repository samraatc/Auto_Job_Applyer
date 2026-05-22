import { useEffect, useState } from 'react'
import { apiJson } from '../api'

function ApplyLog() {
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearMsg, setClearMsg] = useState('')

  const refresh = () => {
    apiJson('/api/applied-jobs?status=' + status).then(d => setJobs(d.jobs || []))
  }

  useEffect(() => { refresh() }, [status])

  const filtered = q
    ? jobs.filter(j => JSON.stringify(j).toLowerCase().includes(q.toLowerCase()))
    : jobs

  const clearAll = async () => {
    if (jobs.length === 0) {
      setClearMsg('Nothing to clear.')
      return
    }
    // Two-stage confirm so this can't be a single misclick.
    const first = confirm(
      `Clear the ENTIRE apply log?\n\n` +
      `• Backs up both CSVs to .bak.<timestamp>.csv (you can restore from disk).\n` +
      `• Drops the Mongo applied_jobs collection.\n` +
      `• Resets the Manual Apply done/dismissed state.\n\n` +
      `Click OK to continue.`
    )
    if (!first) return
    const second = prompt('Type CLEAR to confirm.')
    if (second !== 'CLEAR') {
      setClearMsg('Cancelled.')
      return
    }
    setClearing(true)
    setClearMsg('')
    try {
      const res = await apiJson('/api/applied-jobs/clear', { method: 'POST' })
      const c = res.csv_rows || {}
      const total = (c.applied || 0) + (c.failed || 0)
      setClearMsg(
        `Cleared ${total} CSV rows (${c.applied || 0} applied, ${c.failed || 0} failed) ` +
        `+ ${res.mongo_deleted || 0} Mongo docs. ` +
        (res.backups?.length ? `Backups: ${res.backups.map(p => p.split(/[\\/]/).pop()).join(', ')}` : 'No backups kept.')
      )
      setJobs([])
    } catch (e) {
      setClearMsg('Clear failed: ' + (e.message || 'unknown'))
    } finally {
      setClearing(false)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Apply log ({filtered.length})</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="all">All</option>
            <option value="applied">Applied</option>
            <option value="failed">Failed</option>
          </select>
          <input placeholder="search title / company / id…" value={q} onChange={e => setQ(e.target.value)}
                 style={{ flex: 1, minWidth: 200, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn btn-primary" onClick={refresh}>Refresh</button>
          <button className="btn btn-danger"
                  onClick={clearAll}
                  disabled={clearing || jobs.length === 0}
                  title="Backs up CSVs first, then wipes everything"
                  style={{ marginLeft: 'auto' }}>
            {clearing ? 'Clearing…' : `Clear all (${jobs.length})`}
          </button>
        </div>
        {clearMsg && (
          <div style={{
            marginBottom: 12, padding: 10, borderRadius: 8, fontSize: 13,
            background: clearMsg.startsWith('Clear failed') ? 'rgba(198, 40, 40, 0.1)' : 'rgba(46, 125, 50, 0.1)',
            color: 'var(--text)',
            border: '1px solid ' + (clearMsg.startsWith('Clear failed') ? 'rgba(198, 40, 40, 0.3)' : 'rgba(46, 125, 50, 0.3)'),
          }}>{clearMsg}</div>
        )}

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
                const rawStatus = j._status || j.status || 'applied'
                const rawDate = j['Date Applied'] || j.date_applied || ''
                const isManual = !!j.manually_applied
                const externalLink = j['External Job link'] || j.external_link || ''
                // Rule: a row is APPLIED only when there is real proof of submission.
                //   - failed                            → red FAILED
                //   - real Date Applied (any timestamp) → green APPLIED  ← Easy-Apply submit succeeded
                //   - manually_applied flag             → green APPLIED + blue MANUAL
                //   - applied + Date Applied=="Pending" → yellow PENDING ← bot only collected
                //                                                          the link, or Easy-Apply
                //                                                          modal opened but Submit
                //                                                          was never clicked.
                // The previous External-link check was too narrow — Easy-Apply rows
                // where Submit silently failed also end up with date="Pending" but
                // External Job link="Easy Applied", and those are not actually
                // submitted either. So gate purely on date + manual flag now.
                const hasRealDate = rawDate && String(rawDate).trim().toLowerCase() !== 'pending'
                const pending = rawStatus === 'applied' && !isManual && !hasRealDate
                const status = rawStatus === 'failed' ? 'failed' : pending ? 'pending' : 'applied'
                const bg = status === 'failed' ? '#c62828'
                         : status === 'pending' ? '#b08900'
                         : '#2e7d32'
                const dateApplied = j.manually_applied_at || rawDate || ''
                const open = () => link && window.open(link, '_blank', 'noopener,noreferrer')
                const pillBase = {
                  color: 'white', padding: '3px 9px', borderRadius: 12,
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                }
                return (
                  <tr key={i}
                      onClick={open}
                      style={{ borderTop: '1px solid var(--border)', cursor: link ? 'pointer' : 'default' }}
                      onMouseEnter={e => { if (link) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <span style={{ ...pillBase, background: bg }}
                            title={status === 'pending' ? 'External link captured — not submitted yet. Mark Done in Manual Apply.' : ''}>
                        {status}
                      </span>
                      {isManual && (
                        <span style={{ ...pillBase, background: '#1565c0', marginLeft: 6 }}
                              title={`Marked done by hand at ${j.manually_applied_at || 'unknown time'}`}>
                          manual
                        </span>
                      )}
                    </td>
                    <td>{j['Job ID'] || j.job_id}</td>
                    <td>{j['Title'] || j.title}</td>
                    <td>{j['Company'] || j.company}</td>
                    <td>{dateApplied}</td>
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
