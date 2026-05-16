import { useState } from 'react'
import { apiJson } from '../api'

function Settings({ username }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setErr('')
    if (next.length < 8) return setErr('New password must be at least 8 characters.')
    if (next !== confirm) return setErr('Confirmation does not match.')
    setBusy(true)
    try {
      await apiJson('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      setCurrent(''); setNext(''); setConfirm('')
      setMsg('Password changed.')
    } catch (e) {
      setErr('Failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  const fieldStyle = { width: '100%', padding: 10, marginBottom: 10, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }

  return (
    <div>
      <div className="card">
        <div className="card-title">Account</div>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>Signed in as <b>{username}</b></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Change password</div>
        <form onSubmit={submit} style={{ maxWidth: 420 }}>
          <label>Current password</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} style={fieldStyle} />
          <label>New password</label>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} style={fieldStyle} />
          <label>Confirm new password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={fieldStyle} />
          {err && <div style={{ color: '#e57373', marginBottom: 8 }}>{err}</div>}
          {msg && <div style={{ color: 'var(--success, #66bb6a)', marginBottom: 8 }}>{msg}</div>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </div>
    </div>
  )
}

export default Settings
