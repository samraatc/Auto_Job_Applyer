import { useState } from 'react'

function Dashboard({ botStatus, checkStatus, setActiveTab }) {
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try {
      await fetch('/api/bot/start', { method: 'POST' })
      checkStatus()
      setActiveTab('logs') // Jump to logs once started
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    try {
      await fetch('/api/bot/stop', { method: 'POST' })
      checkStatus()
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Bot Controls</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Ensure your configurations and resume are fully filled out before starting the bot. 
            The browser will launch and automate applications.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleStart}
              disabled={loading || botStatus === 'running'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Start Bot
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleStop}
              disabled={loading || botStatus === 'stopped'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
              Stop Bot
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">System Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
               <span style={{ color: 'var(--text-secondary)' }}>Status</span>
               <span style={{ fontWeight: '500', color: botStatus === 'running' ? 'var(--success)' : 'var(--text-secondary)' }}>
                 {botStatus === 'running' ? 'Active & Running' : 'Offline'}
               </span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
               <span style={{ color: 'var(--text-secondary)' }}>Config Connectivity</span>
               <span style={{ fontWeight: '500', color: 'var(--success)' }}>Connected</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
