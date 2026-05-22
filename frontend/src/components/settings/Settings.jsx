import { useState, useEffect, useCallback } from 'react'
import { apiJson, apiPut } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

// ── Icon helper ───────────────────────────────────────────────────
function Ic({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────
function Toggle({ id, checked, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-secondary border border-border'
      }`}
    >
      <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform my-0.5 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ── Section header ────────────────────────────────────────────────
function SectionHeader({ icon, title, description }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          <Ic d={icon} size={16} />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground ml-[42px] leading-relaxed">{description}</p>
      )}
    </div>
  )
}

// ── Field helpers ─────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SaveBar({ loading, saved, error, onSave }) {
  return (
    <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
      <button
        onClick={onSave}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? <><span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Saving…</>
          : <><Ic d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8" size={14} /> Save Changes</>}
      </button>
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-emerald-400">
          <Ic d="M20 6 9 17l-5-5" size={14} /> Saved!
        </span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  )
}

// ── TABS ──────────────────────────────────────────────────────────
const SETTING_TABS = [
  { id: 'account',    label: 'Account',    icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'linkedin',   label: 'LinkedIn',   icon: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z' },
  { id: 'ai',         label: 'AI & LLM',   icon: 'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM3 14v1a9 9 0 0 0 18 0v-1' },
  { id: 'apikeys',    label: 'API Keys',   icon: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4' },
  { id: 'automation', label: 'Automation', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'security',   label: 'Security',   icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
]

// ══════════════════════════════════════════════════════════════════
// Sub-sections
// ══════════════════════════════════════════════════════════════════

// ── Account ───────────────────────────────────────────────────────
function AccountSection({ user }) {
  const { refreshUser } = useAuth()
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '' })
  const [pass, setPass] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [passErr, setPassErr] = useState('')
  const [passSaved, setPassSaved] = useState(false)
  const [passSaving, setPassSaving] = useState(false)

  const saveProfile = async () => {
    setErr(''); setSaving(true); setSaved(false)
    try {
      await apiPut('/api/auth/profile', form)
      setSaved(true)
      await refreshUser()
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const savePassword = async () => {
    setPassErr(''); setPassSaving(true); setPassSaved(false)
    if (pass.next.length < 8) return (setPassErr('Password must be at least 8 characters.'), setPassSaving(false))
    if (pass.next !== pass.confirm) return (setPassErr('Passwords do not match.'), setPassSaving(false))
    try {
      await apiJson('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: pass.current, new_password: pass.next }) })
      setPass({ current: '', next: '', confirm: '' })
      setPassSaved(true)
      setTimeout(() => setPassSaved(false), 3000)
    } catch (e) { setPassErr(e.message) } finally { setPassSaving(false) }
  }

  const initials = (user?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div>
      <SectionHeader icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" title="Profile" description="Update your account display name and email address." />

      {/* Avatar row */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-background border border-border">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-xl font-extrabold text-white flex-shrink-0 shadow-lg shadow-primary/25">
          {initials}
        </div>
        <div>
          <div className="font-semibold text-sm text-foreground">{user?.username}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{user?.email || 'No email set'}</div>
          <span className="mt-1.5 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/20">Admin</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Username">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="username" />
        </Field>
        <Field label="Email Address">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
        </Field>
      </div>
      <SaveBar loading={saving} saved={saved} error={err} onSave={saveProfile} />

      <hr className="my-6 border-border" />

      <SectionHeader icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" title="Change Password" description="Choose a strong password of at least 8 characters." />
      <div className="max-w-md">
        <Field label="Current Password">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="password" value={pass.current} onChange={e => setPass(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label="New Password">
            <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="password" value={pass.next} onChange={e => setPass(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
          </Field>
          <Field label="Confirm New Password">
            <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="password" value={pass.confirm} onChange={e => setPass(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
          </Field>
        </div>
        <SaveBar loading={passSaving} saved={passSaved} error={passErr} onSave={savePassword} />
      </div>
    </div>
  )
}

// ── LinkedIn ──────────────────────────────────────────────────────
function LinkedInSection() {
  const [form, setForm] = useState({ linkedin_email: '', linkedin_password: '', linkedin_phone: '', follow_companies: true, connect_with_hr: false })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    apiJson('/api/settings/linkedin').then(d => setForm(f => ({ ...f, ...d }))).catch(() => {})
  }, [])

  const save = async () => {
    setErr(''); setSaving(true); setSaved(false)
    try {
      await apiPut('/api/settings/linkedin', form)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <SectionHeader icon="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" title="LinkedIn Credentials" description="Your credentials are stored encrypted and only used for automation." />

      <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-5 text-xs text-amber-400">
        <Ic d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" size={16} />
        Credentials are AES-256 encrypted at rest. Never shared externally.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="LinkedIn Email">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="email" value={form.linkedin_email} onChange={e => set('linkedin_email', e.target.value)} placeholder="you@email.com" autoComplete="off" />
        </Field>
        <Field label="LinkedIn Password">
          <div className="relative">
            <input className="w-full px-3 py-2 pr-10 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type={showPass ? 'text' : 'password'} value={form.linkedin_password} onChange={e => set('linkedin_password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
              <Ic d={showPass ? 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24 M1 1l22 22' : 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0'} size={15} />
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 max-w-xs">
        <Field label="Phone (for 2FA, optional)">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="tel" value={form.linkedin_phone} onChange={e => set('linkedin_phone', e.target.value)} placeholder="+1 (555) 000-0000" />
        </Field>
      </div>

      <hr className="my-6 border-border" />
      <SectionHeader icon="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" title="Behaviour" description="Control how the bot interacts with LinkedIn." />

      <div className="space-y-3">
        {[
          { id: 'follow_companies', label: 'Follow Companies', desc: 'Automatically follow companies you apply to' },
          { id: 'connect_with_hr',  label: 'Connect with HR',  desc: 'Send connection requests to recruiters after applying' },
        ].map(({ id, label, desc }) => (
          <div key={id} className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-background border border-border">
            <div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
            <Toggle id={id} checked={!!form[id]} onChange={v => set(id, v)} />
          </div>
        ))}
      </div>

      <SaveBar loading={saving} saved={saved} error={err} onSave={save} />
    </div>
  )
}

// ── AI & LLM ──────────────────────────────────────────────────────
function AISection() {
  const [form, setForm] = useState({
    llm_model: 'gemini-1.5-flash', llm_api_key: '', ollama_url: 'http://localhost:11434',
    resume_summarizer: true, cover_letter: false, job_match_score: true, min_match_score: 70,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiJson('/api/settings/ai').then(d => setForm(f => ({ ...f, ...d }))).catch(() => {})
  }, [])

  const save = async () => {
    setErr(''); setSaving(true); setSaved(false)
    try {
      await apiPut('/api/settings/ai', form)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const MODEL_GROUPS = [
    { label: 'Google Gemini', options: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'] },
    { label: 'OpenAI', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { label: 'Anthropic', options: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
    { label: 'Local / Ollama', options: ['ollama/llama3', 'ollama/mistral', 'ollama/phi3'] },
  ]

  return (
    <div>
      <SectionHeader icon="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM3 14v1a9 9 0 0 0 18 0v-1" title="LLM Provider" description="Choose the AI model used to evaluate jobs and generate cover letters." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="AI Model">
          <select className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.llm_model} onChange={e => set('llm_model', e.target.value)}>
            {MODEL_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map(o => <option key={o} value={o}>{o}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="API Key" hint="Leave blank to use environment variable.">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="password" value={form.llm_api_key} onChange={e => set('llm_api_key', e.target.value)} placeholder="sk-… or AIza…" autoComplete="new-password" />
        </Field>
      </div>

      {(form.llm_model || '').startsWith('ollama') && (
        <div className="mt-4 max-w-sm">
          <Field label="Ollama Server URL" hint="Your local Ollama instance endpoint.">
            <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.ollama_url} onChange={e => set('ollama_url', e.target.value)} placeholder="http://localhost:11434" />
          </Field>
        </div>
      )}

      <hr className="my-6 border-border" />
      <SectionHeader icon="M13 10V3L4 14h7v7l9-11h-7z" title="AI Features" description="Enable or disable individual AI-powered capabilities." />

      <div className="space-y-3">
        {[
          { id: 'resume_summarizer', label: 'Resume Summariser',    desc: 'AI tailors your resume summary to each job description' },
          { id: 'cover_letter',      label: 'Cover Letter Generation', desc: 'Auto-generate personalised cover letters' },
          { id: 'job_match_score',   label: 'Job Match Scoring',     desc: 'Skip jobs below a minimum match score' },
        ].map(({ id, label, desc }) => (
          <div key={id} className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-background border border-border">
            <div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
            <Toggle id={id} checked={!!form[id]} onChange={v => set(id, v)} />
          </div>
        ))}
      </div>

      {form.job_match_score && (
        <div className="mt-4">
          <Field label={`Minimum Match Score: ${form.min_match_score}%`} hint="Jobs scoring below this threshold will be skipped.">
            <input type="range" min={0} max={100} step={5} value={form.min_match_score}
              onChange={e => set('min_match_score', Number(e.target.value))}
              className="w-full max-w-sm accent-primary" />
            <div className="flex justify-between max-w-sm text-xs text-muted-foreground mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </Field>
        </div>
      )}

      <SaveBar loading={saving} saved={saved} error={err} onSave={save} />
    </div>
  )
}

// ── API Keys ──────────────────────────────────────────────────────
function ApiKeysSection() {
  const [keys, setKeys] = useState({ openai_key: '', anthropic_key: '', gemini_key: '', adzuna_app_id: '', adzuna_app_key: '', jsearch_key: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiJson('/api/settings/apikeys').then(d => setKeys(k => ({ ...k, ...d }))).catch(() => {})
  }, [])

  const save = async () => {
    setErr(''); setSaving(true); setSaved(false)
    try {
      await apiPut('/api/settings/apikeys', keys)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setKeys(ks => ({ ...ks, [k]: v }))

  const KeyField = ({ label, keyName, placeholder, hint }) => (
    <Field label={label} hint={hint}>
      <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="password" value={keys[keyName] || ''} onChange={e => set(keyName, e.target.value)} placeholder={placeholder} autoComplete="new-password" />
    </Field>
  )

  return (
    <div>
      <SectionHeader icon="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" title="LLM API Keys" description="Keys stored encrypted. Set here or via environment variables." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KeyField label="OpenAI API Key"    keyName="openai_key"    placeholder="sk-…"     hint="For GPT-4o / GPT-3.5" />
        <KeyField label="Anthropic API Key" keyName="anthropic_key" placeholder="sk-ant-…" hint="For Claude models" />
        <KeyField label="Google Gemini Key" keyName="gemini_key"    placeholder="AIza…"    hint="For Gemini 1.5 / 2.0" />
      </div>

      <hr className="my-6 border-border" />
      <SectionHeader icon="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" title="Job Board API Keys" description="Used to discover and scrape job listings." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KeyField label="Adzuna App ID"  keyName="adzuna_app_id"  placeholder="App ID"  hint="From adzuna.com/api" />
        <KeyField label="Adzuna App Key" keyName="adzuna_app_key" placeholder="App Key" hint="From adzuna.com/api" />
        <KeyField label="JSearch API Key (RapidAPI)" keyName="jsearch_key" placeholder="RapidAPI key…" hint="Required for JSearch job board access." />
      </div>

      <SaveBar loading={saving} saved={saved} error={err} onSave={save} />
    </div>
  )
}

// ── Automation ────────────────────────────────────────────────────
function AutomationSection() {
  const [form, setForm] = useState({
    apply_limit_daily: 50, apply_delay_min: 3, apply_delay_max: 8,
    run_headless: true, auto_retry_failed: true, blacklist_companies: '',
    easy_apply_only: true, skip_promoted: false, salary_min: 0,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    apiJson('/api/settings/automation').then(d => setForm(f => ({ ...f, ...d }))).catch(() => {})
  }, [])

  const save = async () => {
    setErr(''); setSaving(true); setSaved(false)
    try {
      await apiPut('/api/settings/automation', form)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <SectionHeader icon="M13 10V3L4 14h7v7l9-11h-7z" title="Bot Behaviour" description="Control how aggressively and how fast the bot applies." />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Daily Application Limit" hint="Max applications the bot will submit per day.">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="number" min={1} max={500} value={form.apply_limit_daily} onChange={e => set('apply_limit_daily', Number(e.target.value))} />
        </Field>
        <Field label="Min Salary Filter ($)" hint="Skip jobs below this annual salary. 0 = no filter.">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="number" min={0} value={form.salary_min} onChange={e => set('salary_min', Number(e.target.value))} />
        </Field>
        <Field label="Min Delay Between Apps (sec)" hint="Lower = faster but riskier.">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="number" min={1} max={60} value={form.apply_delay_min} onChange={e => set('apply_delay_min', Number(e.target.value))} />
        </Field>
        <Field label="Max Delay Between Apps (sec)">
          <input className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" type="number" min={1} max={120} value={form.apply_delay_max} onChange={e => set('apply_delay_max', Number(e.target.value))} />
        </Field>
      </div>

      <hr className="my-6 border-border" />
      <SectionHeader icon="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" title="Filters & Options" />

      <div className="space-y-3">
        {[
          { id: 'run_headless',      label: 'Run Headless',       desc: 'Run Chrome in background without a visible window' },
          { id: 'easy_apply_only',   label: 'Easy Apply Only',    desc: 'Only apply to LinkedIn Easy Apply jobs' },
          { id: 'auto_retry_failed', label: 'Auto-Retry Failed',  desc: 'Automatically retry failed applications once' },
          { id: 'skip_promoted',     label: 'Skip Promoted Jobs', desc: 'Skip jobs marked as "Promoted" listings' },
        ].map(({ id, label, desc }) => (
          <div key={id} className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-background border border-border">
            <div>
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
            </div>
            <Toggle id={id} checked={!!form[id]} onChange={v => set(id, v)} />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Field label="Company Blacklist" hint="One company name per line. Bot will skip these employers.">
          <textarea
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm font-mono resize-y min-h-[110px] focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            rows={5}
            value={form.blacklist_companies}
            onChange={e => set('blacklist_companies', e.target.value)}
            placeholder={"Amazon\nMeta\nExample Corp"}
          />
        </Field>
      </div>

      <SaveBar loading={saving} saved={saved} error={err} onSave={save} />
    </div>
  )
}

// ── Security ──────────────────────────────────────────────────────
function SecuritySection() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiJson('/api/auth/sessions')
      setSessions(data)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  const revokeAll = async () => {
    if (!confirm('Sign out of all other sessions?')) return
    try {
      await apiJson('/api/auth/sessions/revoke-all', { method: 'POST' })
      await loadSessions()
    } catch {}
  }

  return (
    <div>
      <SectionHeader icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" title="Active Sessions" description="Devices and browsers currently signed in to your account." />

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-10 rounded-xl bg-background border border-border text-center text-muted-foreground text-sm">
          No active sessions found.
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {sessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-background border border-border">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {s.device || 'Unknown Device'}
                  {s.current && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.ip} · {s.last_active}</div>
              </div>
              {!s.current && (
                <button
                  onClick={async () => {
                    await apiJson(`/api/auth/sessions/${s.id}/revoke`, { method: 'POST' }).catch(() => {})
                    await loadSessions()
                  }}
                  className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sessions.filter(s => !s.current).length > 0 && (
        <button
          id="btn-revoke-all-sessions"
          onClick={revokeAll}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-sm font-semibold hover:bg-destructive/20 transition-colors"
        >
          <Ic d="M18.36 6.64a9 9 0 1 1-12.73 0 M6 6l12 12" size={15} />
          Sign Out All Other Sessions
        </button>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// Main Settings component
// ══════════════════════════════════════════════════════════════════
function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('account')

  const PANELS = {
    account:    <AccountSection user={user} />,
    linkedin:   <LinkedInSection />,
    ai:         <AISection />,
    apikeys:    <ApiKeysSection />,
    automation: <AutomationSection />,
    security:   <SecuritySection />,
  }

  return (
    <div className="animate-in fade-in duration-200">
      {/* Tab bar */}
      <div className="flex gap-1 mb-5 overflow-x-auto no-scrollbar border-b border-border pb-0">
        {SETTING_TABS.map(t => (
          <button
            key={t.id}
            id={`settings-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Ic d={t.icon} size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="rounded-xl border border-border bg-card p-6 ">
        {PANELS[activeTab]}
      </div>
    </div>
  )
}

export default Settings
