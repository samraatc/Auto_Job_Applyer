import { useEffect, useMemo, useState } from 'react'
import { apiJson, api } from '../../api/client'

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
        setSelected(new Set())
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
        const next = new Set(prev)
        for (const j of visible) next.delete(j['Job ID'] || j.job_id)
        return next
      }
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
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Manual Apply Queue
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="text-primary font-semibold">{remainingCount} pending</span>
              {' '}/ {jobs.length} total
            </p>
          </div>
          <button
            id="btn-open-first-10"
            onClick={openAll}
            disabled={visible.length === 0}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Open First 10 in Tabs
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Jobs the bot collected an external apply link for. Click a row to open the company's career page,
          then hit <b className="text-foreground">Done</b> after submitting — that also updates the Apply Log
          with a <b className="text-foreground">MANUAL</b> badge and a real timestamp.
          Use the checkboxes to delete (single or bulk). Sorted recent-first.
        </p>

        {/* Bulk action toolbar */}
        <div className={`flex gap-2 items-center flex-wrap px-3 py-2.5 rounded-lg border transition-colors mb-3 ${
          selected.size > 0
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-transparent bg-transparent'
        }`}>
          <button
            id="btn-bulk-delete"
            disabled={selected.size === 0 || bulkBusy}
            onClick={bulkDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm font-medium hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkBusy
              ? <><span className="w-3.5 h-3.5 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" /> Deleting…</>
              : `Delete selected (${selected.size})`}
          </button>
          <button
            id="btn-clear-selection"
            disabled={selected.size === 0 || bulkBusy}
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear Selection
          </button>
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} selected`
              : 'Tick rows in the table below to delete.'}
          </span>
        </div>

        {/* Search / filter bar */}
        <div className="flex gap-2 items-center flex-wrap">
          <input
            id="manual-apply-search"
            placeholder="Search title / company / location…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={e => setHideDone(e.target.checked)}
              className="rounded accent-primary"
            />
            Hide completed
          </label>
          <button
            id="btn-refresh-manual"
            onClick={refresh}
            className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Jobs{' '}
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground font-normal">
            {visible.length}
          </span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="pb-2 pr-3 w-9">
                    <input
                      type="checkbox"
                      id="select-all-visible"
                      checked={allVisibleSelected}
                      ref={el => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected }}
                      onChange={toggleAllVisible}
                      title="Select / deselect all visible"
                      className="rounded accent-primary"
                    />
                  </th>
                  <th className="pb-2 pr-3 w-16 font-medium">Done</th>
                  <th className="pb-2 pr-3 font-medium">Title</th>
                  <th className="pb-2 pr-3 font-medium">Company</th>
                  <th className="pb-2 pr-3 font-medium">Location</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">Found</th>
                  <th className="pb-2 pr-3 font-medium whitespace-nowrap">Added (exact)</th>
                  <th className="pb-2 pr-3 font-medium">External</th>
                  <th className="pb-2 font-medium">LinkedIn</th>
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
                  const openRow = () => url && window.open(url, '_blank', 'noopener,noreferrer')
                  return (
                    <tr
                      key={jid}
                      onClick={openRow}
                      className={`border-b border-border/50 transition-colors ${
                        isSelected ? 'bg-red-500/5' : ''
                      } ${url ? 'cursor-pointer hover:bg-secondary/40' : ''} ${
                        isDone ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 pr-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(jid)}
                          title="Select for bulk delete"
                          className="rounded accent-primary"
                        />
                      </td>
                      <td className="py-3 pr-3" onClick={e => e.stopPropagation()}>
                        <label className="cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isDone}
                            disabled={busyId === jid}
                            onChange={() => markDone(jid, !isDone)}
                            title="Mark as applied by hand (updates Apply Log)"
                            className="rounded accent-primary"
                          />
                        </label>
                      </td>
                      <td className={`py-3 pr-3 font-medium text-foreground ${isDone ? 'line-through' : ''}`}>
                        {j['Title'] || j.title}
                      </td>
                      <td className="py-3 pr-3 text-foreground">{j['Company'] || j.company}</td>
                      <td className="py-3 pr-3 text-muted-foreground">{j['Work Location'] || j.work_location || '—'}</td>
                      <td className="py-3 pr-3 text-muted-foreground whitespace-nowrap text-xs" title={foundAt || ''}>
                        {timeAgo(foundAt) || '—'}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground whitespace-nowrap text-xs">
                        {fmtAbsolute(foundAt) || '—'}
                      </td>
                      <td className="py-3 pr-3" onClick={e => e.stopPropagation()}>
                        {url
                          ? <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">open ↗</a>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3" onClick={e => e.stopPropagation()}>
                        {jobLink
                          ? <a href={jobLink} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">LinkedIn ↗</a>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                      Nothing here yet. The list fills as the bot finds jobs that don't support Easy Apply.
                    </td>
                  </tr>
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
