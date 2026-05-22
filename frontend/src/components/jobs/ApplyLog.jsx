import { useEffect, useState, useCallback } from 'react'
import { apiJson } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ClipboardList, RefreshCw, Search, Filter,
  Loader2, AlertCircle, CheckCircle, Clock,
  ExternalLink, Trash2, ChevronDown, Activity
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────
function resolveStatus(j) {
  const rawStatus = j._status || j.status || 'applied'
  const rawDate   = j['Date Applied'] || j.date_applied || ''
  const isManual  = !!j.manually_applied
  const hasRealDate = rawDate && String(rawDate).trim().toLowerCase() !== 'pending'
  if (rawStatus === 'failed') return 'failed'
  if (!isManual && !hasRealDate) return 'pending'
  return 'applied'
}

const STATUS_CONFIG = {
  applied: { label: 'Applied',  icon: CheckCircle, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  pending: { label: 'Pending',  icon: Clock,        cls: 'bg-amber-500/15  text-amber-400  border-amber-500/20'  },
  failed:  { label: 'Failed',   icon: AlertCircle,  cls: 'bg-red-500/15    text-red-400    border-red-500/20'    },
}

function StatusPill({ status, isManual }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.applied
  const Icon = cfg.icon
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${cfg.cls}`}>
        <Icon className="w-2.5 h-2.5" /> {cfg.label}
      </span>
      {isManual && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border bg-blue-500/15 text-blue-400 border-blue-500/20">
          Manual
        </span>
      )}
    </div>
  )
}

function EmptyLog({ filterActive }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Activity className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {filterActive ? 'No matching entries' : 'No log entries yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {filterActive
          ? 'Try changing your search or status filter.'
          : 'Start the bot to begin applying — all attempts will appear here.'}
      </p>
    </div>
  )
}

export default function ApplyLog() {
  const toast  = useToast()
  const [jobs, setJobs] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const d = await apiJson('/api/applied-jobs?status=' + statusFilter)
      setJobs(d.jobs || [])
    } catch (e) {
      toast.error('Failed to load log: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { refresh() }, [refresh])

  const filtered = q
    ? jobs.filter(j => JSON.stringify(j).toLowerCase().includes(q.toLowerCase()))
    : jobs

  // Stats
  const counts = jobs.reduce((acc, j) => {
    const s = resolveStatus(j)
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, { applied: 0, pending: 0, failed: 0 })

  const clearAll = async () => {
    if (jobs.length === 0) { toast.info('Nothing to clear.'); return }
    const first = confirm(
      `Clear the ENTIRE apply log?\n\n` +
      `• Backs up both CSVs to .bak.<timestamp>.csv\n` +
      `• Drops the MongoDB applied_jobs collection\n` +
      `• Resets Manual Apply state\n\nClick OK to continue.`
    )
    if (!first) return
    const second = prompt('Type CLEAR to confirm permanently.')
    if (second !== 'CLEAR') { toast.info('Cancelled — nothing was cleared.'); return }

    setClearing(true)
    try {
      const res = await apiJson('/api/applied-jobs/clear', { method: 'POST' })
      const c = res.csv_rows || {}
      const total = (c.applied || 0) + (c.failed || 0)
      toast.success(`Cleared ${total} rows + ${res.mongo_deleted || 0} Mongo docs. ${res.backups?.length ? 'Backups saved.' : ''}`)
      setJobs([])
    } catch (e) {
      toast.error('Clear failed: ' + (e.message || ''))
    } finally {
      setClearing(false)
    }
  }

  const filterActive = q || statusFilter !== 'all'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Apply Log</h1>
          <p className="text-muted-foreground mt-1">
            All application attempts — applied, pending (link captured), and failed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={refresh}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            disabled={clearing || jobs.length === 0}
            onClick={clearAll}
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {clearing ? 'Clearing…' : `Clear All (${jobs.length})`}
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && jobs.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'applied', label: 'Applied',  color: 'emerald' },
            { key: 'pending', label: 'Pending',  color: 'amber' },
            { key: 'failed',  label: 'Failed',   color: 'red' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                statusFilter === key
                  ? `bg-${color}-500/15 border-${color}-500/30 text-${color}-400`
                  : 'bg-card border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              {label} <span className="ml-1.5 font-bold">{counts[key] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search title, company, job ID…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-9 pr-8 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="applied">Applied</option>
            <option value="failed">Failed</option>
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyLog filterActive={filterActive} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {jobs.length} entries
          </p>
          {filtered.map((j, i) => {
            const status     = resolveStatus(j)
            const link       = j['Job Link'] || j.job_link || ''
            const isManual   = !!j.manually_applied
            const rawDate    = j.manually_applied_at || j['Date Applied'] || j.date_applied || ''
            const dateStr    = rawDate && rawDate !== 'Pending' ? new Date(rawDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : rawDate || '—'
            const title      = j['Title'] || j.title || '—'
            const company    = j['Company'] || j.company || '—'
            const jobId      = j['Job ID'] || j.job_id || ''

            return (
              <div
                key={i}
                onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                className={`group flex items-start gap-4 p-4 rounded-xl border bg-card transition-all ${
                  link ? 'cursor-pointer hover:border-primary/30 hover:bg-card/80' : ''
                } ${
                  status === 'failed'  ? 'border-red-500/20' :
                  status === 'pending' ? 'border-amber-500/20' :
                  'border-border'
                }`}
              >
                {/* Status column */}
                <div className="shrink-0 pt-0.5">
                  <StatusPill status={status} isManual={isManual} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{company} {jobId ? `· ${jobId}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{dateStr}</span>
                      {link && (
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  {status === 'pending' && (
                    <p className="text-xs text-amber-400/80 mt-1.5">
                      External link captured — not yet submitted. Mark Done in Manual Apply.
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
