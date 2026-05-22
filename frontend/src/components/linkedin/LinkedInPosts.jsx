import { useEffect, useState } from 'react'
import { apiJson, api } from '../../api/client'

// "LinkedIn Posts" tab.
//
// Two scan modes share the same backend "feed" slot (only one runs at a time):
//   1. Company-feed scan      — visits each configured company's posts page.
//   2. Keyword content search — visits LinkedIn /search/results/content/
//                               for a free-text query like "hiring" or
//                               "hiring devops engineer". Hits include the
//                               post author's name + profile URL so the user
//                               has a person to message.
//
// Click anywhere on a row to open the post on LinkedIn.
// The Applied column shows whether the bot has already applied to / failed
// on the underlying Job ID (extracted from the post's apply URL).
function LinkedInPosts() {
  const [posts, setPosts] = useState([])
  const [matchedTerms, setMatchedTerms] = useState([])
  const [scanStatus, setScanStatus] = useState('not_running')
  const [mongoHealth, setMongoHealth] = useState(null)
  const [msg, setMsg] = useState('')

  const [keywordQuery, setKeywordQuery] = useState('hiring')
  const [showAll, setShowAll] = useState(false)

  const refresh = () => {
    apiJson('/api/linkedin-posts?all=' + (showAll ? 'true' : 'false')).then(d => {
      setPosts(d.posts || [])
      setMatchedTerms(d.matched_terms || [])
    })
  }
  const refreshStatus = () => apiJson('/api/feed-scan/status').then(s => setScanStatus(s.status))
  const refreshHealth = () => apiJson('/api/mongo/health').then(setMongoHealth).catch(() => setMongoHealth(null))

  useEffect(() => {
    refresh()
    refreshStatus()
    refreshHealth()
    const id = setInterval(refreshStatus, 4000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { refresh() /* eslint-disable-line */ }, [showAll])

  const startScan = async (dry = false) => {
    setMsg(dry ? 'Dry-run scan starting…' : 'Company-feed scan starting — opens a Chrome window…')
    await api('/api/feed-scan/start?dry_run=' + dry, { method: 'POST' })
    setTimeout(() => { refreshStatus(); refresh() }, 1500)
  }

  const startKeywordScan = async (dry = false) => {
    const keywords = keywordQuery
      .split('\n')
      .map(k => k.trim())
      .filter(Boolean)
    if (keywords.length === 0) {
      setMsg('Type at least one keyword (e.g. "hiring").')
      return
    }
    setMsg(`Keyword scan starting for: ${keywords.join(', ')}`)
    try {
      await apiJson('/api/feed-scan/start-keyword', {
        method: 'POST',
        body: JSON.stringify({ keywords, dry_run: dry }),
      })
      setTimeout(() => { refreshStatus(); refresh() }, 1500)
    } catch (e) {
      setMsg('Keyword scan failed to start: ' + (e.message || 'unknown'))
    }
  }

  const openPost = (url) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const appliedBadge = (status) => {
    if (!status) return <span className="text-muted-foreground text-xs">—</span>
    const cls =
      status === 'applied'
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : status === 'failed'
        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls}`}>
        {status}
      </span>
    )
  }

  const sourcePill = (src) => {
    if (!src) return null
    const isKw = src.startsWith('linkedin_keyword')
    return (
      <span
        className={`inline-flex ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
          isKw ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-500/20 text-slate-400'
        }`}
        title={src}
      >
        {isKw ? 'keyword' : 'company'}
      </span>
    )
  }

  const isRunning = scanStatus === 'running'

  return (
    <div className="space-y-4">
      {/* Top control card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-base font-semibold text-foreground">LinkedIn Hiring Posts</h2>
          {mongoHealth && (
            <span className="text-xs text-muted-foreground">
              MongoDB:{' '}
              <span className={mongoHealth.ok ? 'text-emerald-400' : 'text-red-400'}>
                {mongoHealth.ok ? 'connected' : mongoHealth.enabled ? 'unreachable' : 'disabled'}
              </span>
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          <b className="text-foreground">Company feed</b> visits every configured company's posts page.{' '}
          <b className="text-foreground">Keyword search</b> scrapes LinkedIn's global post search (e.g.{' '}
          <code className="px-1 py-0.5 rounded bg-secondary text-xs">hiring</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-secondary text-xs">we're hiring devops</code>
          ) and captures the post author so you can reach out. Click any row to open the post.
        </p>

        {matchedTerms.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-muted-foreground self-center">Matching:</span>
            {matchedTerms.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary border border-primary/20">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-scan-company-feeds"
            disabled={isRunning}
            onClick={() => startScan(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Scanning…
              </>
            ) : 'Scan Company Feeds'}
          </button>
          <button
            id="btn-scan-dry-run"
            disabled={isRunning}
            onClick={() => startScan(true)}
            className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Dry Run
          </button>
          <button
            id="btn-reload-posts"
            onClick={refresh}
            className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Reload
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={e => setShowAll(e.target.checked)}
              className="rounded accent-primary"
            />
            Show all posts (ignore search_terms filter)
          </label>
        </div>

        {msg && (
          <p className="mt-3 text-sm text-muted-foreground">{msg}</p>
        )}
      </div>

      {/* Keyword scan card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">Search Posts by Keyword</h2>
        <p className="text-sm text-muted-foreground mb-4">
          One keyword per line. Examples:{' '}
          <code className="px-1 py-0.5 rounded bg-secondary text-xs">hiring</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-secondary text-xs">we're hiring devops engineer</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-secondary text-xs">looking for SRE bangalore</code>.
          The scraper visits LinkedIn's content search for each line, captures matching posts, and stores the author's
          profile link so you can DM them.
        </p>
        <textarea
          id="keyword-query-textarea"
          rows={3}
          value={keywordQuery}
          onChange={e => setKeywordQuery(e.target.value)}
          placeholder={'hiring\nhiring devops engineer\nlooking for SRE'}
          className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            id="btn-scan-keyword"
            disabled={isRunning || !keywordQuery.trim()}
            onClick={() => startKeywordScan(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Scanning…
              </>
            ) : 'Scan by Keyword'}
          </button>
          <button
            id="btn-keyword-dry-run"
            disabled={isRunning || !keywordQuery.trim()}
            onClick={() => startKeywordScan(true)}
            className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Dry Run
          </button>
        </div>
      </div>

      {/* Posts table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Posts{' '}
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground font-normal">
            {posts.length}
          </span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-2 pr-4 font-medium">Author / Company</th>
                <th className="pb-2 pr-4 font-medium">Matched / Title</th>
                <th className="pb-2 pr-4 font-medium min-w-[200px]">Excerpt</th>
                <th className="pb-2 pr-4 font-medium whitespace-nowrap">Confidence</th>
                <th className="pb-2 pr-4 font-medium">Applied?</th>
                <th className="pb-2 pr-4 font-medium">Contact</th>
                <th className="pb-2 font-medium">Post</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => {
                const url = p['Post URL'] || p['Apply URL'] || ''
                const author = p['Author Name'] || ''
                const authorUrl = p['Author URL'] || ''
                const company = p['Company'] || ''
                return (
                  <tr
                    key={i}
                    onClick={() => openPost(url)}
                    className={`border-b border-border/50 transition-colors ${url ? 'cursor-pointer hover:bg-secondary/40' : ''}`}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-foreground flex items-center">
                        {author || company || '—'}
                        {sourcePill(p['Source'])}
                      </div>
                      {author && company && (
                        <div className="text-xs text-muted-foreground mt-0.5">{company}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-foreground">{p['Matched Role'] || p['Title']}</td>
                    <td className="py-3 pr-4 text-muted-foreground max-w-[480px] truncate">{p['Post Excerpt']}</td>
                    <td className="py-3 pr-4 text-foreground">{Number(p['Confidence'] || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">{appliedBadge(p._applied_status)}</td>
                    <td className="py-3 pr-4" onClick={e => e.stopPropagation()}>
                      {authorUrl ? (
                        <a href={authorUrl} target="_blank" rel="noreferrer" title={`Open ${author}'s profile`}
                          className="text-primary hover:underline text-xs">
                          message ↗
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3" onClick={e => e.stopPropagation()}>
                      {url
                        ? <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">open ↗</a>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              })}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">
                    No posts yet — try a keyword scan above ("hiring" is a great starting point).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default LinkedInPosts
