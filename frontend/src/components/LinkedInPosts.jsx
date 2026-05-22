import { useEffect, useState } from 'react'
import { apiJson, api } from '../api'

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

  // Keyword-search inputs. Default to a plain "hiring" sweep, since that's
  // the most common ask. Users can also paste multi-word queries on one
  // line (one per line in the textarea — we split on newline before POST).
  const [keywordQuery, setKeywordQuery] = useState('hiring')
  // When true, the post list ignores the user's search_terms filter and
  // returns every hiring post we've collected. Useful right after a broad
  // "hiring" keyword scan.
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

  // Re-fetch whenever the show-all toggle flips so the table updates live.
  useEffect(() => { refresh() /* eslint-disable-line */ }, [showAll])

  const startScan = async (dry = false) => {
    setMsg(dry ? 'Dry-run scan starting…' : 'Company-feed scan starting — opens a Chrome window…')
    await api('/api/feed-scan/start?dry_run=' + dry, { method: 'POST' })
    setTimeout(() => { refreshStatus(); refresh() }, 1500)
  }

  // Kick off a keyword scan. Splits the textarea on newlines so users can run
  // multiple distinct LinkedIn searches in one click.
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
    if (!status) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>
    const bg = status === 'applied' ? '#2e7d32' : status === 'failed' ? '#c62828' : '#6d4c41'
    return (
      <span style={{
        background: bg, color: 'white', padding: '3px 9px', borderRadius: 12,
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
      }}>{status}</span>
    )
  }

  // Visual hint when a row comes from a keyword scan — it gets a small
  // grey pill so the user knows the author column is meaningful.
  const sourcePill = (src) => {
    if (!src) return null
    const isKw = src.startsWith('linkedin_keyword')
    return (
      <span style={{
        background: isKw ? '#5e35b1' : '#37474f', color: 'white',
        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
        marginLeft: 6, letterSpacing: 0.3,
      }} title={src}>
        {isKw ? 'keyword' : 'company'}
      </span>
    )
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">LinkedIn hiring posts</div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Two scan modes: <b>Company feed</b> visits every configured company's
          posts page, while <b>Keyword search</b> scrapes LinkedIn's global
          post search (e.g. <code>hiring</code>, <code>we're hiring devops</code>)
          and captures the post author so you can reach out. Click any row to
          open the post.
        </p>
        {matchedTerms.length > 0 && (
          <div style={{ marginTop: 10, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Matching: </span>
            {matchedTerms.map(t => (
              <span key={t} style={{
                background: 'var(--accent, #1f6feb)', color: 'white', padding: '2px 8px',
                borderRadius: 10, fontSize: 12, marginRight: 6,
              }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={scanStatus === 'running'} onClick={() => startScan(false)}>
            {scanStatus === 'running' ? 'Scanning…' : 'Scan company feeds'}
          </button>
          <button className="btn" disabled={scanStatus === 'running'} onClick={() => startScan(true)}>Dry run</button>
          <button className="btn" onClick={refresh}>Reload</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 4 }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            Show all posts (ignore search_terms filter)
          </label>
          {mongoHealth && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>
              MongoDB:&nbsp;
              <b style={{ color: mongoHealth.ok ? '#66bb6a' : '#e57373' }}>
                {mongoHealth.ok ? 'connected' : (mongoHealth.enabled ? 'unreachable' : 'disabled')}
              </b>
            </span>
          )}
        </div>
        {msg && <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{msg}</div>}
      </div>

      {/* Dedicated card for the keyword-based scan. Kept visually distinct
          so users know it's a separate action from the company-feed scan. */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Search posts by keyword</div>
        <p style={{ color: 'var(--text-secondary)', marginTop: -4 }}>
          One keyword per line. Examples: <code>hiring</code>,&nbsp;
          <code>we're hiring devops engineer</code>,&nbsp;
          <code>looking for SRE bangalore</code>. The scraper visits LinkedIn's
          content search for each line, captures matching posts, and stores
          the author's profile link so you can DM them.
        </p>
        <textarea
          rows={3}
          value={keywordQuery}
          onChange={e => setKeywordQuery(e.target.value)}
          placeholder={'hiring\nhiring devops engineer\nlooking for SRE'}
          style={{
            width: '100%', padding: 10, marginTop: 6,
            background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 13, resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            disabled={scanStatus === 'running' || !keywordQuery.trim()}
            onClick={() => startKeywordScan(false)}>
            {scanStatus === 'running' ? 'Scanning…' : 'Scan by keyword'}
          </button>
          <button
            className="btn"
            disabled={scanStatus === 'running' || !keywordQuery.trim()}
            onClick={() => startKeywordScan(true)}>
            Dry run
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Posts ({posts.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: 8 }}>Author / Company</th>
                <th>Matched / Title</th>
                <th style={{ minWidth: 200 }}>Excerpt</th>
                <th style={{ whiteSpace: 'nowrap' }}>Confidence</th>
                <th>Applied?</th>
                <th>Contact</th>
                <th>Post</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => {
                const url = p['Post URL'] || p['Apply URL'] || ''
                const author = p['Author Name'] || ''
                const authorUrl = p['Author URL'] || ''
                const company = p['Company'] || ''
                return (
                  <tr key={i}
                      onClick={() => openPost(url)}
                      style={{
                        borderTop: '1px solid var(--border)',
                        cursor: url ? 'pointer' : 'default',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => { if (url) e.currentTarget.style.background = 'rgba(127,127,127,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: 8 }}>
                      <div style={{ fontWeight: 600 }}>
                        {author || company || '—'}
                        {sourcePill(p['Source'])}
                      </div>
                      {author && company && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{company}</div>
                      )}
                    </td>
                    <td>{p['Matched Role'] || p['Title']}</td>
                    <td style={{ maxWidth: 480, color: 'var(--text-secondary)' }}>{p['Post Excerpt']}</td>
                    <td>{Number(p['Confidence'] || 0).toFixed(2)}</td>
                    <td>{appliedBadge(p._applied_status)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {authorUrl
                        ? <a href={authorUrl} target="_blank" rel="noreferrer" title={`Open ${author}'s profile`}>
                            message ↗
                          </a>
                        : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {url ? <a href={url} target="_blank" rel="noreferrer">open ↗</a> : '—'}
                    </td>
                  </tr>
                )
              })}
              {posts.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 12, color: 'var(--text-secondary)' }}>
                  No posts yet — try a keyword scan above ("hiring" is a great starting point).
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default LinkedInPosts
