import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api'

// Applied Logs — successful submissions only.
//
//   - Easy Apply rows that actually submitted (real Date Applied timestamp)
//   - Manual Apply rows the user marked Done (manually_applied=true)
//
// PENDING and FAILED rows do NOT appear here. Use the Apply Logs tab for those.

function timeAgo(iso) {
  if (!iso || iso === 'Pending') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 0)        return 'just now'
  if (seconds < 60)       return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)       return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)         return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7)           return `${days} day${days === 1 ? '' : 's'} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5)          return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12)        return `${months} month${months === 1 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`
}

function fmtAbsolute(iso) {
  if (!iso || iso === 'Pending') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function AppliedLogs() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [onlyManual, setOnlyManual] = useState(false)

  const refresh = () => {
    setLoading(true)
    apiJson('/api/applied-jobs/submitted')
      .then(d => setJobs(d.jobs || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return jobs.filter(j => {
      if (onlyManual && !j.manually_applied) return false
      if (!ql) return true
      const blob = (
        (j['Title']   || j.title   || '') + ' ' +
        (j['Company'] || j.company || '') + ' ' +
        (j['Job ID']  || j.job_id  || '')
      ).toLowerCase()
      return blob.includes(ql)
    })
  }, [jobs, q, onlyManual])

  // Breakdown for the header pill counts
  const counts = useMemo(() => {
    let easy = 0, manual = 0
    for (const j of jobs) {
      if (j.manually_applied) manual++
      else easy++
    }
    return { total: jobs.length, easy, manual }
  }, [jobs])

  const pillBase = {
    color: 'white', padding: '3px 9px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Applied logs ({filtered.length} of {counts.total})</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Jobs that were actually submitted — Easy Apply successes plus anything
          you marked <b>Done</b> in Manual Apply. Pending (external link only)
          and failed attempts live under <b>Apply Logs</b>.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...pillBase, background: '#2e7d32' }}>auto {counts.easy}</span>
          <span style={{ ...pillBase, background: '#1565c0' }}>manual {counts.manual}</span>
          <input placeholder="search title / company / id…" value={q} onChange={e => setQ(e.target.value)}
                 style={{ flex: 1, minWidth: 220, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, marginLeft: 8 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={onlyManual} onChange={e => setOnlyManual(e.target.checked)} />
            Manual only
          </label>
          <button className="btn btn-primary" onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Applications</div>
        {loading
          ? <div style={{ color: 'var(--text-secondary)', padding: 12 }}>Loading…</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 8 }}>Status</th>
                    <th>Job ID</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Applied (relative)</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Applied (exact)</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((j, i) => {
                    const link = j['Job Link'] || j.job_link || ''
                    const isManual = !!j.manually_applied
                    const when = j.manually_applied_at || j['Date Applied'] || j.date_applied || ''
                    const open = () => link && window.open(link, '_blank', 'noopener,noreferrer')
                    return (
                      <tr key={i}
                          onClick={open}
                          style={{ borderTop: '1px solid var(--border)', cursor: link ? 'pointer' : 'default' }}
                          onMouseEnter={e => { if (link) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                          <span style={{ ...pillBase, background: '#2e7d32' }}>applied</span>
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
                        <td title={when} style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {timeAgo(when) || '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtAbsolute(when) || '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {link ? <a href={link} target="_blank" rel="noreferrer">open ↗</a> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 12, color: 'var(--text-secondary)' }}>
                      No successful submissions yet. Easy Apply submits and Manual Apply "Done" rows show up here.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

export default AppliedLogs
