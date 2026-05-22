import { useEffect, useState } from 'react'
import { apiJson, api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Building2, Plus, Trash2, Globe, Loader2,
  Zap, AlertCircle, RefreshCw, ExternalLink
} from 'lucide-react'

function EmptyCompanies() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <Building2 className="w-8 h-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No companies yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Add target companies manually or run auto-discovery to pull them from your LinkedIn search results.
      </p>
    </div>
  )
}

export default function Companies() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [discoverStatus, setDiscoverStatus] = useState('not_running')
  const [discovering, setDiscovering] = useState(false)

  const refresh = async () => {
    try {
      const d = await apiJson('/api/companies')
      setRows(d.target_companies || [])
    } catch (e) {
      toast.error('Failed to load companies: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const refreshStatus = () =>
    apiJson('/api/companies/discover/status')
      .then(s => setDiscoverStatus(s.status))
      .catch(() => {})

  useEffect(() => {
    refresh()
    refreshStatus()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
  }, [])

  const save = async (next) => {
    setBusy(true)
    try {
      await apiJson('/api/companies', { method: 'POST', body: JSON.stringify({ target_companies: next }) })
      setRows(next)
      toast.success('Companies saved.')
    } catch (e) {
      toast.error('Save failed: ' + (e.message || ''))
    } finally {
      setBusy(false)
    }
  }

  const add = (e) => {
    e.preventDefault()
    if (!newName.trim() || !newUrl.trim()) {
      toast.warning('Please fill in both company name and LinkedIn URL.')
      return
    }
    const next = [...rows, { name: newName.trim(), linkedin_url: newUrl.trim(), tags: [] }]
    setNewName(''); setNewUrl('')
    save(next)
  }

  const remove = (i) => {
    if (!confirm(`Remove "${rows[i].name}"?`)) return
    save(rows.filter((_, idx) => idx !== i))
  }

  const triggerDiscover = async () => {
    setDiscovering(true)
    try {
      await api('/api/companies/discover', { method: 'POST' })
      toast.info('Discovery started — a Chrome window will open briefly.')
      setTimeout(() => { refresh(); refreshStatus() }, 1500)
    } catch (e) {
      toast.error('Discovery failed: ' + (e.message || ''))
    } finally {
      setDiscovering(false)
    }
  }

  const isRunning = discoverStatus === 'running'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground mt-1">
            Target companies whose LinkedIn /posts feeds will be scanned for hiring posts.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => { setLoading(true); refresh() }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Auto-discovery */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Auto-Discovery
          </CardTitle>
          <CardDescription>
            Runs a LinkedIn job search for each of your search terms and automatically adds the companies that appear in the results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={triggerDiscover}
              disabled={isRunning || discovering}
              className="gap-2"
            >
              {isRunning || discovering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Discovering…</>
                : <><Zap className="w-4 h-4" /> Run Discovery</>
              }
            </Button>
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Discovery is running in the background
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add company form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Add Company Manually
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex gap-3 flex-wrap">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Company name"
              className="flex-1 min-w-36 px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://www.linkedin.com/company/…"
              className="flex-[2] min-w-52 px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <Button type="submit" disabled={busy} className="gap-2 shrink-0">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Company list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Target Companies <span className="text-foreground">({rows.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-0"><EmptyCompanies /></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {rows.map((c, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5 truncate"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">{c.linkedin_url}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
                {(c.tags || []).length > 0 && (
                  <div className="hidden sm:flex gap-1.5 flex-wrap">
                    {c.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">{t}</span>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
