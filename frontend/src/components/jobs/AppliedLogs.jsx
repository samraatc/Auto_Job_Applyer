import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  CheckCircle, RefreshCw, Search, Loader2,
  ExternalLink, Briefcase, Hand, TrendingUp
} from 'lucide-react'

// ── Time Helpers ─────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso || iso === 'Pending') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 0)   return 'just now'
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day}d ago`
  const w = Math.floor(day / 7)
  if (w < 5)   return `${w}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(day / 365)}y ago`
}

function fmtAbsolute(iso) {
  if (!iso || iso === 'Pending') return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Stat Card ────────────────────────────────────────────────────
function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${color}`}>
      <div className="w-9 h-9 rounded-lg bg-current/10 flex items-center justify-center shrink-0 opacity-80">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────
function EmptyApplied({ filterActive }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
        <CheckCircle className="w-8 h-8 text-emerald-400/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {filterActive ? 'No matching applications' : 'No applications yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {filterActive
          ? 'Try clearing your search or filters.'
          : 'Successful applications (Easy Apply + Manual Done) will appear here once you start the bot.'}
      </p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function AppliedLogs() {
  const toast = useToast()
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [onlyManual, setOnlyManual] = useState(false)

  const refresh = async () => {
    setLoading(true)
    try {
      const d = await apiJson('/api/applied-jobs/submitted')
      setJobs(d.jobs || [])
    } catch (e) {
      toast.error('Failed to load: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
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

  const counts = useMemo(() => {
    let easy = 0, manual = 0
    for (const j of jobs) { if (j.manually_applied) manual++; else easy++ }
    return { total: jobs.length, easy, manual }
  }, [jobs])

  const filterActive = q || onlyManual

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applied Logs</h1>
          <p className="text-muted-foreground mt-1">
            Confirmed submissions — Easy Apply successes + Manual Apply "Done" entries.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={refresh}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {!loading && counts.total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <MiniStat icon={TrendingUp} label="Total Applied" value={counts.total}  color="border-emerald-500/20 text-emerald-400 bg-emerald-500/5" />
          <MiniStat icon={Briefcase}  label="Auto Apply"   value={counts.easy}   color="border-primary/20   text-primary    bg-primary/5"   />
          <MiniStat icon={Hand}       label="Manual"       value={counts.manual} color="border-blue-500/20  text-blue-400   bg-blue-500/5"  />
        </div>
      )}

      {/* Filter bar */}
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
        <label className="flex items-center gap-2.5 cursor-pointer px-4 py-2.5 rounded-lg border border-border bg-secondary text-sm select-none hover:border-primary/40 transition-colors">
          <div
            className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${onlyManual ? 'bg-primary' : 'bg-muted border border-border'}`}
            onClick={() => setOnlyManual(v => !v)}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${onlyManual ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          Manual only
        </label>
      </div>

      {/* Results count */}
      {!loading && jobs.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-4">
          Showing {filtered.length} of {counts.total} applications
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyApplied filterActive={filterActive} />
      ) : (
        <div className="space-y-2">
          {filtered.map((j, i) => {
            const link      = j['Job Link'] || j.job_link || ''
            const isManual  = !!j.manually_applied
            const when      = j.manually_applied_at || j['Date Applied'] || j.date_applied || ''
            const title     = j['Title']   || j.title   || '—'
            const company   = j['Company'] || j.company || '—'
            const jobId     = j['Job ID']  || j.job_id  || ''

            return (
              <div
                key={i}
                onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                className={`group flex items-start gap-4 p-4 rounded-xl border border-emerald-500/15 bg-card transition-all ${
                  link ? 'cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5' : ''
                }`}
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isManual ? 'bg-blue-500/15' : 'bg-emerald-500/15'}`}>
                  {isManual
                    ? <Hand className="w-4 h-4 text-blue-400" />
                    : <Briefcase className="w-4 h-4 text-emerald-400" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {company} {jobId ? `· ${jobId}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {when && when !== 'Pending' && (
                        <span
                          title={fmtAbsolute(when)}
                          className="text-xs text-muted-foreground whitespace-nowrap"
                        >
                          {timeAgo(when) || fmtAbsolute(when)}
                        </span>
                      )}
                      {link && (
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <CheckCircle className="w-2.5 h-2.5" /> Applied
                    </span>
                    {isManual && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <Hand className="w-2.5 h-2.5" /> Manual
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
