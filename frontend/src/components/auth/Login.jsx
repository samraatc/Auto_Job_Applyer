import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

// ── Icon helpers ─────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const BotIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <line x1="12" y1="7" x2="12" y2="11" />
    <line x1="7" y1="16" x2="7" y2="16" strokeWidth="3" />
    <line x1="12" y1="16" x2="12" y2="16" strokeWidth="3" />
    <line x1="17" y1="16" x2="17" y2="16" strokeWidth="3" />
  </svg>
)

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')   // 'login' | 'register'

  // Login fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Register extra fields
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const resetForm = () => {
    setUsername(''); setPassword(''); setEmail(''); setConfirmPassword('')
    setErr(''); setSuccess(''); setShowPassword(false)
  }

  const switchMode = (m) => { resetForm(); setMode(m) }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      await login(username, password)
    } catch (ex) {
      setErr(ex.message === 'unauthenticated' ? 'Invalid username or password.' : (ex.message || 'Login failed.'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setErr('Passwords do not match.')
    setLoading(true)
    try {
      await register(username, email, password)
    } catch (ex) {
      setErr(ex.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <style>{`
        .auth-root {
          position: fixed; inset: 0;
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          background:
            radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.25) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.2)  0%, transparent 55%),
            #080b14;
          overflow: hidden;
        }
        /* animated gradient blobs */
        .auth-root::before, .auth-root::after {
          content: ''; position: absolute;
          border-radius: 50%; filter: blur(90px);
          pointer-events: none; opacity: 0.5;
          animation: blobDrift 18s ease-in-out infinite alternate;
        }
        .auth-root::before {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #6366f1, transparent 70%);
          top: -150px; left: -150px;
        }
        .auth-root::after {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #8b5cf6, transparent 70%);
          bottom: -120px; right: -120px;
          animation-delay: -9s;
        }
        @keyframes blobDrift {
          0%   { transform: translate(0,0)      scale(1); }
          100% { transform: translate(60px,40px) scale(1.2); }
        }
        .auth-card {
          position: relative; z-index: 2;
          width: 100%; max-width: 420px;
          background: rgba(20,24,40,0.85);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 22px;
          padding: 2.25rem 2rem 2rem;
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
          backdrop-filter: blur(24px);
          animation: cardIn 0.45s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes cardIn {
          from { opacity:0; transform: translateY(20px) scale(0.97); }
          to   { opacity:1; transform: translateY(0)    scale(1);    }
        }
        .auth-logo {
          width: 52px; height: 52px; border-radius: 16px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.25rem;
          box-shadow: 0 0 32px rgba(99,102,241,0.45);
        }
        .auth-heading {
          text-align: center; margin-bottom: 0.4rem;
          font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; color: #e8eaf6;
        }
        .auth-subhead {
          text-align: center; font-size: 0.83rem; color: #8892b0;
          line-height: 1.5; margin-bottom: 1.75rem;
        }
        /* Mode switcher pills */
        .auth-tabs {
          display: flex; background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px; padding: 4px;
          margin-bottom: 1.5rem; gap: 4px;
        }
        .auth-tab {
          flex: 1; padding: 7px; border-radius: 9px;
          border: none; cursor: pointer;
          font-size: 0.83rem; font-weight: 600;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
          color: #8892b0; background: transparent;
        }
        .auth-tab.active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; box-shadow: 0 2px 10px rgba(99,102,241,0.4);
        }
        /* Fields */
        .auth-label {
          display: block; font-size: 0.75rem; font-weight: 700;
          color: #8892b0; text-transform: uppercase;
          letter-spacing: 0.5px; margin-bottom: 0.4rem;
        }
        .auth-field-wrap { position: relative; margin-bottom: 1rem; }
        .auth-input {
          width: 100%; padding: 0.65rem 0.9rem; font-size: 0.9rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; color: #e8eaf6;
          font-family: 'Inter', sans-serif;
          outline: none; transition: all 0.18s;
        }
        .auth-input:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); }
        .auth-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.2); background: rgba(255,255,255,0.06); }
        .auth-input::placeholder { color: #546180; }
        .auth-input.has-icon { padding-right: 2.75rem; }
        .auth-icon-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #546180; cursor: pointer;
          padding: 4px; display: flex; align-items: center; transition: color 0.15s;
        }
        .auth-icon-btn:hover { color: #8892b0; }
        .auth-error {
          display: flex; align-items: center; gap: 7px;
          padding: 10px 14px; border-radius: 10px; font-size: 0.83rem;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25);
          color: #f87171; margin-bottom: 1rem; line-height: 1.4;
        }
        .auth-submit {
          width: 100%; padding: 0.75rem; font-size: 0.9rem; font-weight: 700;
          font-family: 'Inter', sans-serif; letter-spacing: 0.2px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border: none; border-radius: 12px; cursor: pointer;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4);
          transition: all 0.2s; margin-top: 0.5rem;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .auth-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); box-shadow: 0 6px 28px rgba(99,102,241,0.5); }
        .auth-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .auth-footer { text-align: center; margin-top: 1.25rem; font-size: 0.8rem; color: #546180; }
        .auth-footer a { color: #818cf8; cursor: pointer; font-weight: 600; text-decoration: none; }
        .auth-footer a:hover { color: #a5b4fc; }
        .spin { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: aSpin 0.7s linear infinite; }
        @keyframes aSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-card">
        <div className="auth-logo"><BotIcon /></div>
        <h1 className="auth-heading">AI Job Applier</h1>
        <p className="auth-subhead">
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your free account'}
        </p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
          <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Register</button>
        </div>

        {err && (
          <div className="auth-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {err}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} autoComplete="on">
            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="login-user">Username</label>
              <input
                id="login-user" className="auth-input" type="text"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="your_username" autoFocus autoComplete="username"
                required
              />
            </div>

            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="login-pass">Password</label>
              <input
                id="login-pass"
                className={`auth-input${showPassword ? '' : ''} has-icon`}
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                required
              />
              <button type="button" className="auth-icon-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            <button className="auth-submit" type="submit" disabled={loading || !username || !password}>
              {loading ? <><div className="spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} autoComplete="on">
            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="reg-user">Username</label>
              <input
                id="reg-user" className="auth-input" type="text"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="your_username" autoFocus autoComplete="username"
                required minLength={3}
              />
            </div>

            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email" className="auth-input" type="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email"
                required
              />
            </div>

            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="reg-pass">Password</label>
              <input
                id="reg-pass" className="auth-input has-icon"
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min 8 characters" autoComplete="new-password"
                required minLength={8}
              />
              <button type="button" className="auth-icon-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>

            <div className="auth-field-wrap">
              <label className="auth-label" htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm" className="auth-input"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password" autoComplete="new-password"
                required
              />
            </div>

            <button className="auth-submit" type="submit" disabled={loading || !username || !email || !password || !confirmPassword}>
              {loading ? <><div className="spin" /> Creating account…</> : 'Create Account'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          {mode === 'login'
            ? <>Don't have an account? <a onClick={() => switchMode('register')}>Register</a></>
            : <>Already have an account? <a onClick={() => switchMode('login')}>Sign in</a></>
          }
        </p>
      </div>
    </div>
  )
}
