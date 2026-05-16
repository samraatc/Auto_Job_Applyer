import { useEffect, useState } from 'react'
import { apiJson } from '../api'

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Temporary", "Volunteer", "Internship", "Other"]
const EXPERIENCE = ["Internship", "Entry level", "Associate", "Mid-Senior level", "Director", "Executive"]
const ON_SITE = ["On-site", "Remote", "Hybrid"]
const DATE_POSTED = ["", "Past 24 hours", "Past week", "Past month", "Any time"]
const APPLY_MODES = [
  { value: "both", label: "Both — Easy Apply and external" },
  { value: "easy", label: "Easy Apply only" },
  { value: "external", label: "External sites only" },
]

function MultiCheck({ value, options, onChange }) {
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <label key={o} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: value.includes(o) ? 'var(--accent)' : 'transparent', color: value.includes(o) ? 'white' : 'var(--text)' }}>
          <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} style={{ display: 'none' }} />
          {o}
        </label>
      ))}
    </div>
  )
}

function SearchRules() {
  const [rules, setRules] = useState(null)
  const [resumes, setResumes] = useState([])
  const [termsInput, setTermsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    apiJson('/api/search-rules').then(r => {
      setRules(r)
      setTermsInput((r.search_terms || []).join(', '))
    })
    apiJson('/api/resumes').then(d => setResumes(d.resumes || []))
  }, [])

  if (!rules) return <div className="card">Loading…</div>

  const update = (patch) => setRules({ ...rules, ...patch })

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const payload = {
        ...rules,
        search_terms: termsInput.split(',').map(s => s.trim()).filter(Boolean),
      }
      await apiJson('/api/search-rules', { method: 'POST', body: JSON.stringify(payload) })
      setMsg('Saved.')
    } catch (e) {
      setMsg('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="card-title">Search Rules</div>

      <label>Search terms (comma-separated)</label>
      <input value={termsInput} onChange={e => setTermsInput(e.target.value)}
             style={{ width: '100%', padding: 10, margin: '6px 0 14px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />

      <label>Search location</label>
      <input value={rules.search_location} onChange={e => update({ search_location: e.target.value })}
             style={{ width: '100%', padding: 10, margin: '6px 0 14px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />

      <label>Job type</label>
      <div style={{ marginBottom: 14 }}>
        <MultiCheck value={rules.job_type} options={JOB_TYPES} onChange={v => update({ job_type: v })} />
      </div>

      <label>Experience level</label>
      <div style={{ marginBottom: 14 }}>
        <MultiCheck value={rules.experience_level} options={EXPERIENCE} onChange={v => update({ experience_level: v })} />
      </div>

      <label>Work site</label>
      <div style={{ marginBottom: 14 }}>
        <MultiCheck value={rules.on_site} options={ON_SITE} onChange={v => update({ on_site: v })} />
      </div>

      <label>Date posted</label>
      <select value={rules.date_posted} onChange={e => update({ date_posted: e.target.value })}
              style={{ display: 'block', padding: 10, margin: '6px 0 14px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
        {DATE_POSTED.map(d => <option key={d} value={d}>{d || '(any)'}</option>)}
      </select>

      <label>Apply mode</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {APPLY_MODES.map(m => (
          <label key={m.value} style={{ cursor: 'pointer' }}>
            <input type="radio" name="apply_mode" checked={rules.apply_mode === m.value}
                   onChange={() => update({ apply_mode: m.value })} /> {m.label}
          </label>
        ))}
      </div>

      <label style={{ display: 'block', marginBottom: 14 }}>
        <input type="checkbox" checked={rules.easy_apply_only}
               onChange={e => update({ easy_apply_only: e.target.checked })} />
        {' '}Easy-apply filter at LinkedIn search level (in addition to apply mode)
      </label>

      <label>Per-term resume override (optional)</label>
      <div style={{ marginBottom: 14 }}>
        {termsInput.split(',').map(s => s.trim()).filter(Boolean).map(term => (
          <div key={term} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <span style={{ flex: 1 }}>{term}</span>
            <select value={(rules.per_term_resume || {})[term] || ''}
                    onChange={e => {
                      const next = { ...(rules.per_term_resume || {}) }
                      if (e.target.value) next[term] = e.target.value
                      else delete next[term]
                      update({ per_term_resume: next })
                    }}
                    style={{ flex: 1, padding: 6, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <option value="">(use default)</option>
              {resumes.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        ))}
        {resumes.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>Upload resumes in the Resumes tab to bind one to a search term.</div>}
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {msg && <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
    </div>
  )
}

export default SearchRules
