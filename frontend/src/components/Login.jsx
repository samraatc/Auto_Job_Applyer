import { useState } from 'react'
import { apiJson } from '../api'

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      await apiJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      onLogin(username)
    } catch (e) {
      setErr('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <form onSubmit={submit} className="card" style={{ width: 360 }}>
        <h2 style={{ marginBottom: 8 }}>Admin Sign in</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
          First-time login uses the credentials from your <code>ADMIN_USER</code> /
          <code> ADMIN_PASS</code> env vars (default <code>admin</code> / <code>admin</code>
          if unset). Change them under Settings as soon as you're in.
        </p>
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} autoFocus
               style={{ width: '100%', padding: 10, marginBottom: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
               style={{ width: '100%', padding: 10, marginBottom: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
        {err && <div style={{ color: 'var(--danger, #e57373)', marginBottom: 12 }}>{err}</div>}
        <button className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default Login
