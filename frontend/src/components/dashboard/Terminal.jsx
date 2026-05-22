import { useState, useEffect, useRef } from 'react'

// Terminal / Logs page
// Streams real-time SSE logs from the Python bot process.
// When the bot is stopped, shows a placeholder state.

function Terminal() {
  const [logs, setLogs] = useState([])
  const [botStatus, setBotStatus] = useState('stopped')
  const [cleared, setCleared] = useState(false)
  const terminalEndRef = useRef(null)

  // Poll bot status independently so the page works standalone
  useEffect(() => {
    const checkStatus = () => {
      fetch('/api/bot/status', { credentials: 'include' })
        .then(r => r.json())
        .then(d => setBotStatus(d.status === 'running' ? 'running' : 'stopped'))
        .catch(() => {})
    }
    checkStatus()
    const id = setInterval(checkStatus, 4000)
    return () => clearInterval(id)
  }, [])

  // SSE log stream
  useEffect(() => {
    let eventSource
    if (botStatus === 'running') {
      eventSource = new EventSource('/api/bot/logs')
      eventSource.onmessage = (event) => {
        if (event.data === '[PROCESS_TERMINATED]') {
          eventSource.close()
          return
        }
        setLogs(prev => [...prev, event.data])
      }
      eventSource.onerror = (err) => {
        console.error('SSE Error:', err)
        eventSource.close()
      }
    }
    return () => { if (eventSource) eventSource.close() }
  }, [botStatus])

  // Auto-scroll to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const clearLogs = () => {
    setLogs([])
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  const isRunning = botStatus === 'running'

  // Colour-code log lines
  const lineClass = (line) => {
    const l = line.toLowerCase()
    if (l.includes('error') || l.includes('exception') || l.includes('failed'))
      return 'text-red-400'
    if (l.includes('warn'))
      return 'text-amber-400'
    if (l.includes('success') || l.includes('applied') || l.includes('done'))
      return 'text-emerald-400'
    if (l.startsWith('[') || l.includes('info'))
      return 'text-sky-400'
    return 'text-gray-300'
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Live Execution Logs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time terminal output from the Python bot.{' '}
            {!isRunning && <span className="text-amber-400">Bot is currently stopped.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            isRunning
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
            {isRunning ? 'Live' : 'Offline'}
          </span>

          <button
            id="btn-clear-logs"
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {cleared ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cleared
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
                Clear
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal window */}
      <div className="flex-1 rounded-xl border border-border bg-[#0d1117] overflow-hidden flex flex-col min-h-[400px]">
        {/* macOS-style titlebar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-[#161b22] flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors" />
          <span className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors" />
          <span className="ml-4 text-xs text-gray-500 font-mono">runAiBot.py — {isRunning ? 'running' : 'stopped'}</span>
          {isRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              streaming
            </span>
          )}
        </div>

        {/* Log output */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-gray-600">
              {isRunning ? (
                <>
                  <span className="w-6 h-6 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                  <span>Waiting for log output…</span>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
                  </svg>
                  <span>Start the bot from the dashboard to see live logs here.</span>
                </>
              )}
            </div>
          ) : (
            <>
              {logs.map((log, i) => (
                <div key={i} className={`whitespace-pre-wrap break-all ${lineClass(log)}`}>
                  <span className="text-gray-600 select-none mr-2">{String(i + 1).padStart(4, ' ')} │</span>
                  {log}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Line count footer */}
      {logs.length > 0 && (
        <div className="text-xs text-muted-foreground text-right pr-1">
          {logs.length} line{logs.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default Terminal
