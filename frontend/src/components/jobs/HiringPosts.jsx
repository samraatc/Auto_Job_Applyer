import { useEffect, useState, useCallback } from 'react'
import { apiJson, api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Rss, Play, Square, Loader2, RefreshCw,
  AlertCircle, ExternalLink, CheckCircle,
  Building2, Search
} from 'lucide-react'

function StatusBadge({ status }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>
  const applied = status === 'applied'
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
      applied
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
        : 'bg-red-500/15 text-red-400 border border-red-500/20'
    }`}>
      {applied ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
      {status}
    </span>
  )
}

function EmptyPosts() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Rss className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No hiring posts yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Run a scan to collect hiring posts from your target companies' LinkedIn feeds.
        The AI will flag posts that mention open roles.
      </p>
    </div>
  )
}

export default function HiringPosts() {
  const toast = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [scanStatus, setScanStatus] = useState('not_running')

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (roleFilter) params.set('role', roleFilter)
      if (companyFilter) params.set('company', companyFilter)
      const d = await apiJson('/api/hiring-posts?' + params.toString())
      setPosts(d.posts || [])
    } catch (e) {
      toast.error('Failed to load posts: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }, [roleFilter, companyFilter])

  const refreshStatus = () =>
    apiJson('/api/feed-scan/status')
      .then(s => setScanStatus(s.status))
      .catch(() => {})

  useEffect(() => {
    refresh()
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [])

  const startScan = async (dry = false) => {
    try {
      await api('/api/feed-scan/start?dry_run=' + dry, { method: 'POST' })
      toast.info(dry ? 'Dry-run started — no browser window will open.' : 'Scan started — a Chrome window will open briefly.')
      setTimeout(refreshStatus, 1500)
    } catch (e) {
      toast.error('Scan failed to start: ' + (e.message || ''))
    }
  }

  const stopScan = async () => {
    try {
      await api('/api/feed-scan/stop', { method: 'POST' })
      refreshStatus()
      toast.success('Scan stopped.')
    } catch (e) {
      toast.error('Stop failed: ' + (e.message || ''))
    }
  }

  const isRunning = scanStatus === 'running'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hiring Posts</h1>
          <p className="text-muted-foreground mt-1">
            LinkedIn posts from target companies that the AI flagged as hiring opportunities.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => { setLoading(true); refresh() }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Scanner Controls */}
      <Card className={`border transition-colors ${isRunning ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-primary/20 bg-primary/5'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Rss className={`w-4 h-4 ${isRunning ? 'text-emerald-400' : 'text-primary'}`} />
            Feed Scanner
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium border border-emerald-500/20 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Visits every company's /posts page, scrolls the feed, and uses the LLM to flag hiring posts. Click a post to open it on LinkedIn.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => startScan(false)} disabled={isRunning} className="gap-2">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Scanning…' : 'Start Scan'}
            </Button>
            <Button onClick={() => startScan(true)} disabled={isRunning} variant="outline" className="gap-2">
              <Play className="w-4 h-4" /> Dry Run
            </Button>
            {isRunning && (
              <Button onClick={stopScan} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" /> Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            placeholder="Filter by role…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="relative flex-1 min-w-40">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            placeholder="Filter by company…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Button onClick={refresh} variant="outline" className="gap-2 shrink-0">
          <Search className="w-4 h-4" /> Apply
        </Button>
      </div>

      {/* Posts */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Posts <span className="text-foreground">({posts.length})</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card><CardContent className="p-0"><EmptyPosts /></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p, i) => {
              const url = p['Post URL'] || p['Apply URL'] || ''
              const conf = Number(p['Confidence'] || 0)
              const confColor = conf >= 0.8 ? 'text-emerald-400' : conf >= 0.5 ? 'text-amber-400' : 'text-muted-foreground'
              return (
                <div
                  key={i}
                  className="group p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all cursor-pointer"
                  onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-semibold text-foreground text-sm">{p['Company']}</span>
                        {p['Matched Role'] || p['Title'] ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                            {p['Matched Role'] || p['Title']}
                          </span>
                        ) : null}
                        <StatusBadge status={p._applied_status} />
                        {conf > 0 && (
                          <span className={`text-xs font-medium ${confColor}`}>
                            {(conf * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                      {p['Post Excerpt'] && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{p['Post Excerpt']}</p>
                      )}
                    </div>
                    {url && (
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
