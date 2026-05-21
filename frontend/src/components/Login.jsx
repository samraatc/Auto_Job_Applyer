import { useState } from 'react'
import { apiJson } from '../api'

// Neumorphism login. All styling is inline / scoped via a tiny <style> block
// so it doesn't need any matching changes in the global stylesheet.
//
// Design notes:
//   - One soft background colour (--neu-bg) — no hard borders.
//   - Inputs are *inset* (pressed-in) with paired light/dark shadows.
//   - Card and button are *outset* (raised) with the same shadow pair flipped.
//   - On press, the button flips inset to mimic a physical click.
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
    <div className="neu-root">
      <style>{`
        .neu-root {
          --neu-bg: #e6ecf3;
          --neu-text: #2b3441;
          --neu-text-soft: #6b7787;
          --neu-accent: #4a6cf7;
          --neu-error: #d33a3a;
          --neu-shadow-dark: #b8c2cf;
          --neu-shadow-light: #ffffff;

          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--neu-bg);
          color: var(--neu-text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          padding: 24px;
        }
        @media (prefers-color-scheme: dark) {
          .neu-root {
            --neu-bg: #232936;
            --neu-text: #e6ecf3;
            --neu-text-soft: #93a0b3;
            --neu-shadow-dark: #181c25;
            --neu-shadow-light: #2e3647;
          }
        }
        .neu-card {
          width: 100%;
          max-width: 380px;
          padding: 36px 32px 32px;
          border-radius: 22px;
          background: var(--neu-bg);
          box-shadow:
            12px 12px 24px var(--neu-shadow-dark),
           -12px -12px 24px var(--neu-shadow-light);
        }
        .neu-title {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.2px;
          margin: 0 0 6px;
        }
        .neu-sub {
          font-size: 13px;
          color: var(--neu-text-soft);
          line-height: 1.55;
          margin: 0 0 26px;
        }
        .neu-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--neu-text-soft);
          margin: 14px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .neu-input {
          width: 100%;
          padding: 13px 16px;
          font-size: 14px;
          color: var(--neu-text);
          background: var(--neu-bg);
          border: none;
          outline: none;
          border-radius: 14px;
          box-shadow:
            inset 5px 5px 10px var(--neu-shadow-dark),
            inset -5px -5px 10px var(--neu-shadow-light);
          transition: box-shadow 0.18s;
        }
        .neu-input:focus {
          box-shadow:
            inset 6px 6px 12px var(--neu-shadow-dark),
            inset -6px -6px 12px var(--neu-shadow-light),
            0 0 0 2px rgba(74, 108, 247, 0.15);
        }
        .neu-error {
          margin-top: 14px;
          padding: 10px 14px;
          color: var(--neu-error);
          font-size: 13px;
          border-radius: 12px;
          background: var(--neu-bg);
          box-shadow:
            inset 3px 3px 6px var(--neu-shadow-dark),
            inset -3px -3px 6px var(--neu-shadow-light);
        }
        .neu-btn {
          width: 100%;
          margin-top: 22px;
          padding: 14px 18px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.4px;
          color: var(--neu-accent);
          background: var(--neu-bg);
          border: none;
          border-radius: 14px;
          cursor: pointer;
          box-shadow:
            6px 6px 12px var(--neu-shadow-dark),
           -6px -6px 12px var(--neu-shadow-light);
          transition: box-shadow 0.15s, transform 0.05s;
        }
        .neu-btn:hover { color: #1f4ce4; }
        .neu-btn:active {
          box-shadow:
            inset 4px 4px 8px var(--neu-shadow-dark),
            inset -4px -4px 8px var(--neu-shadow-light);
          transform: translateY(1px);
        }
        .neu-btn:disabled {
          color: var(--neu-text-soft);
          cursor: not-allowed;
          box-shadow:
            inset 3px 3px 6px var(--neu-shadow-dark),
            inset -3px -3px 6px var(--neu-shadow-light);
        }
        .neu-badge {
          width: 56px; height: 56px;
          border-radius: 18px;
          margin: 0 auto 20px;
          display: flex; align-items: center; justify-content: center;
          background: var(--neu-bg);
          color: var(--neu-accent);
          font-weight: 800; font-size: 22px; letter-spacing: -1px;
          box-shadow:
            6px 6px 12px var(--neu-shadow-dark),
           -6px -6px 12px var(--neu-shadow-light);
        }
      `}</style>

      <form onSubmit={submit} className="neu-card" autoComplete="on">
        <div className="neu-badge">AI</div>
        <h2 className="neu-title">Admin sign in</h2>
        <p className="neu-sub">
          First-time login uses the credentials from your <code>ADMIN_USER</code> /
          <code> ADMIN_PASS</code> env vars. Change them under Settings after signing in.
        </p>

        <label className="neu-label" htmlFor="neu-username">Username</label>
        <input
          id="neu-username"
          className="neu-input"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
        />

        <label className="neu-label" htmlFor="neu-password">Password</label>
        <input
          id="neu-password"
          className="neu-input"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {err && <div className="neu-error">{err}</div>}

        <button className="neu-btn" disabled={loading || !username || !password}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default Login
