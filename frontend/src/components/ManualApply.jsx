import { useEffect, useMemo, useState } from 'react'
import { apiJson, api } from '../api'

// Manual Apply — jobs the bot only collected an *external* application link
// for (couldn't Easy-Apply). You finish each one by hand.
//
// Selection model:
//   - Leftmost checkbox per row + header "select all visible".
//   - "Delete selected (N)" button in the top toolbar.
//   - Single-row delete = select one + click the button (same path, no special case).

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
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function fmtAbsolute(iso) {
  if (!iso || iso === 'Pending') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  // Locale-aware short date + time, e.g. "21 May 2026, 13:47".
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function ManualApply() {
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState('')
  const [hideDone, setHideDone] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const refresh = () => {
    setLoading(true)
    apiJson('/api/manual-apply')
      .then(d => {
        setJobs(d.jobs || [])
        setSelected(new Set())  // selection doesn't survive a refetch
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return jobs.filter(j => {
      if (hideDone && j.manually_applied) return false
      if (!ql) return true
      const blob = (
        (j['Title']   || j.title   || '') + ' ' +
        (j['Company'] || j.company || '') + ' ' +
        (j['Work Location'] || j.work_location || '')
      ).toLowerCase()
      return blob.includes(ql)
    })
  }, [jobs, q, hideDone])

  const remainingCount = jobs.filter(j => !j.manually_applied).length

  const allVisibleSelected = visible.length > 0 && visible.every(j => selected.has(j['Job ID'] || j.job_id))
  const someVisibleSelected = visible.some(j => selected.has(j['Job ID'] || j.job_id))

  const toggleOne = (jid) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(jid)) next.delete(jid); else next.add(jid)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected(prev => {
      if (allVisibleSelected) {
        // Deselect every currently visible row
        const next = new Set(prev)
        for (const j of visible) next.delete(j['Job ID'] || j.job_id)
        return next
      }
      // Add every visible row
      const next = new Set(prev)
      for (const j of visible) next.add(j['Job ID'] || j.job_id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const markDone = async (jid, done) => {
    setBusyId(jid)
    try {
      await apiJson(`/api/manual-apply/${encodeURIComponent(jid)}/done`, {
        method: 'POST',
        body: JSON.stringify({ done }),
      })
      setJobs(prev => prev.map(j => {
        const id = j['Job ID'] || j.job_id
        if (id !== jid) return j
        return { ...j, manually_applied: done,
                 manually_applied_at: done ? new Date().toISOString() : '' }
      }))
    } finally {
      setBusyId(null)
    }
  }

  const bulkDelete = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!confirm(`Hide ${ids.length} job${ids.length === 1 ? '' : 's'} from Manual Apply?\n\nThe Apply Log entries stay intact — only this list filters them out.`)) return
    setBulkBusy(true)
    try {
      await apiJson('/api/manual-apply/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ job_ids: ids }),
      })
      // Local update so the UI feels instant
      const removed = new Set(ids)
      setJobs(prev => prev.filter(j => !removed.has(j['Job ID'] || j.job_id)))
      setSelected(new Set())
    } finally {
      setBulkBusy(false)
    }
  }

  const openAll = () => {
    visible.slice(0, 10).forEach(j => {
      const url = j['External Job link'] || j.external_link
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Manual apply queue ({remainingCount} pending, {jobs.length} total)</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Jobs the bot collected an external apply link for. Click a row to open
          the company's career page, then hit <b>Done</b> after submitting — that
          also updates the Apply Log with a <b>MANUAL</b> badge and a real
          timestamp. Use the checkboxes to delete (single or bulk). Sorted
          recent-first.
        </p>

        {/* Bulk action toolbar */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          padding: '8px 10px', marginBottom: 10,
          background: selected.size > 0 ? 'rgba(198, 40, 40, 0.06)' : 'transparent',
          border: selected.size > 0 ? '1px solid rgba(198, 40, 40, 0.25)' : '1px solid transparent',
          borderRadius: 8,
        }}>
          <button className="btn btn-danger"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={bulkDelete}>
            {bulkBusy ? 'Deleting…' : `Delete selected (${selected.size})`}
          </button>
          <button className="btn"
                  disabled={selected.size === 0 || bulkBusy}
                  onClick={clearSelection}>
            Clear selection
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {selected.size > 0
              ? `${selected.size} selected`
              : 'Tick rows in the table below to delete.'}
          </span>
        </div>

        {/* Filter toolbar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="search title / company / location…" value={q} onChange={e => setQ(e.target.value)}
                 style={{ flex: 1, minWidth: 240, padding: 8, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />
            Hide completed
          </label>
          <button className="btn" onClick={refresh}>Refresh</button>
          <button className="btn btn-primary" onClick={openAll} disabled={visible.length === 0}>
            Open first 10 in tabs
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Posts ({visible.length})</div>
        {loading
          ? <div style={{ color: 'var(--text-secondary)', padding: 12 }}>Loading…</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 8, width: 36 }}>
                      <input type="checkbox"
                             checked={allVisibleSelected}
                             ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                             onChange={toggleAllVisible}
                             title="Select / deselect all visible" />
                    </th>
                    <th style={{ width: 70 }}>Done</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Found</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Added (exact)</th>
                    <th>External link</th>
                    <th>LinkedIn job</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((j, i) => {
                    const jid = j['Job ID'] || j.job_id || `row-${i}`
                    const isDone = !!j.manually_applied
                    const isSelected = selected.has(jid)
                    const url = j['External Job link'] || j.external_link
                    const jobLink = j['Job Link'] || j.job_link
                    const foundAt = j.created_at || (j['Date Applied'] && j['Date Applied'] !== 'Pending'
                                                       ? j['Date Applied'] : '')
                    const open = () => url && window.open(url, '_blank', 'noopener,noreferrer')
                    return (
                      <tr key={jid}
                          onClick={open}
                          style={{
                            borderTop: '1px solid var(--border)',
                            cursor: url ? 'pointer' : 'default',
                            opacity: isDone ? 0.55 : 1,
                            background: isSelected ? 'rgba(198, 40, 40, 0.07)' : 'transparent',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected && url) e.currentTarget.style.background = 'rgba(127,127,127,0.06)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isSelected ? 'rgba(198, 40, 40, 0.07)' : 'transparent'
                          }}>
                        <td style={{ padding: 8 }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected}
                                 onChange={() => toggleOne(jid)}
                                 title="Select for bulk delete" />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <label style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={isDone} disabled={busyId === jid}
                                   onChange={() => markDone(jid, !isDone)}
                                   title="Mark as applied by hand (updates Apply Log)" />
                          </label>
                        </td>
                        <td style={{ textDecoration: isDone ? 'line-through' : 'none' }}>
                          {j['Title'] || j.title}
                        </td>
                        <td>{j['Company'] || j.company}</td>
                        <td>{j['Work Location'] || j.work_location || '—'}</td>
                        <td title={foundAt || ''} style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {timeAgo(foundAt) || '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtAbsolute(foundAt) || '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {url
                            ? <a href={url} target="_blank" rel="noreferrer">open ↗</a>
                            : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          {jobLink
                            ? <a href={jobLink} target="_blank" rel="noreferrer">LinkedIn</a>
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {visible.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 12, color: 'var(--text-secondary)' }}>
                      Nothing here yet. The list fills as the bot finds jobs that
                      don't support Easy Apply.
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

export default ManualApply
