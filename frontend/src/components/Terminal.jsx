import { useState, useEffect, useRef } from 'react'

function Terminal({ botStatus }) {
  const [logs, setLogs] = useState([])
  const terminalEndRef = useRef(null)

  useEffect(() => {
    let eventSource;
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
        console.error("SSE Error:", err)
        eventSource.close()
      }
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [botStatus])

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
      <div className="card-title">Live Execution Logs</div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Real-time terminal output from the Python bot. 
        {botStatus === 'stopped' && " Bot is currently stopped."}
      </p>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="terminal-header">
          <span className="terminal-dot red"></span>
          <span className="terminal-dot yellow"></span>
          <span className="terminal-dot green"></span>
          <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.8rem' }}>runAiBot.py</span>
        </div>
        
        <div className="terminal-container" style={{ flex: 1, height: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ color: '#666' }}>Waiting for logs...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="terminal-line">{log}</div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  )
}

export default Terminal
