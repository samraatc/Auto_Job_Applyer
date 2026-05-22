import { useEffect, useState, useCallback } from 'react'
import { apiJson } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Search, MapPin, Briefcase, Clock, Zap,
  Save, Loader2, AlertCircle, CheckCircle,
  ChevronDown, FileText, Info
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────
const JOB_TYPES   = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Volunteer', 'Internship', 'Other']
const EXPERIENCE  = ['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive']
const ON_SITE     = ['On-site', 'Remote', 'Hybrid']
const DATE_POSTED = ['', 'Past 24 hours', 'Past week', 'Past month', 'Any time']
const APPLY_MODES = [
  { value: 'both',     label: 'Both — Easy Apply and external' },
  { value: 'easy',     label: 'Easy Apply only' },
  { value: 'external', label: 'External sites only' },
]

const DEFAULT_RULES = {
  search_terms: [],
  search_location: '',
  job_type: [],
  experience_level: [],
  on_site: [],
  date_posted: '',
  apply_mode: 'easy',
  easy_apply_only: true,
  per_term_resume: {},
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function ChipGroup({ value, options, onChange }) {
  const toggle = (opt) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = value.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
              active
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-secondary text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function TextInput({ label, hint, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <input
        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-shadow"
        {...props}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none px-3 py-2.5 pr-8 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
        >
          {options.map(o => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? (o || '(any)')}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        className={`mt-0.5 w-10 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </label>
  )
}

// ────────────────────────────────────────────────────────────
// Empty state for search terms
// ────────────────────────────────────────────────────────────
function NoTermsPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center border-2 border-dashed border-border rounded-xl">
      <Search className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">No search terms added yet</p>
      <p className="text-xs text-muted-foreground/70">Type terms above to tell the bot what jobs to search for</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function SearchRules() {
  const toast = useToast()
  const [rules, setRules] = useState(null)
  const [resumes, setResumes] = useState([])
  const [termsInput, setTermsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([
      apiJson('/api/search-rules'),
      apiJson('/api/resumes').then(d => d.resumes || []).catch(() => []),
    ]).then(([r, rs]) => {
      setRules({ ...DEFAULT_RULES, ...r })
      setTermsInput((r.search_terms || []).join(', '))
      setResumes(rs)
    }).catch(e => {
      toast.error('Failed to load rules: ' + (e.message || ''))
      setRules({ ...DEFAULT_RULES })
    }).finally(() => setLoading(false))
  }, [])

  const update = useCallback((patch) => {
    setRules(prev => ({ ...prev, ...patch }))
    setDirty(true)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...rules,
        search_terms: termsInput.split(',').map(s => s.trim()).filter(Boolean),
      }
      await apiJson('/api/search-rules', { method: 'POST', body: JSON.stringify(payload) })
      setDirty(false)
      toast.success('Search rules saved!')
    } catch (e) {
      toast.error('Save failed: ' + (e.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const parsedTerms = termsInput.split(',').map(s => s.trim()).filter(Boolean)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading search rules…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Rules</h1>
          <p className="text-muted-foreground mt-1">
            Define what jobs the bot searches for on LinkedIn.
          </p>
        </div>

        {/* Sticky Save button */}
        <Button
          onClick={save}
          disabled={saving}
          className={`gap-2 shrink-0 transition-all ${dirty ? 'animate-pulse-once' : ''}`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Rules'}
        </Button>
      </div>

      {/* Warning if no search terms */}
      {parsedTerms.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>No search terms set — the bot won't know what jobs to search for. Add at least one term below.</span>
        </div>
      )}

      {/* Section 1: Keywords */}
      <SectionCard icon={Search} title="Search Keywords" description="Job titles, skills, or roles for LinkedIn job search.">
        <TextInput
          label="Search terms (comma-separated)"
          placeholder="e.g. Python Developer, Backend Engineer, Data Scientist"
          value={termsInput}
          onChange={e => { setTermsInput(e.target.value); setDirty(true) }}
          hint="Each term becomes a separate LinkedIn search. Be specific for better matches."
        />
        {parsedTerms.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {parsedTerms.map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                <Search className="w-2.5 h-2.5" /> {t}
              </span>
            ))}
          </div>
        ) : (
          <NoTermsPlaceholder />
        )}
      </SectionCard>

      {/* Section 2: Location */}
      <SectionCard icon={MapPin} title="Location" description="Where the bot should search for jobs.">
        <TextInput
          label="Search location"
          placeholder="e.g. India, Bengaluru, Remote"
          value={rules.search_location}
          onChange={e => update({ search_location: e.target.value })}
          hint="Leave blank to search worldwide."
        />
      </SectionCard>

      {/* Section 3: Filters */}
      <SectionCard icon={Briefcase} title="Job Filters" description="Narrow down the type of positions to target.">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Job type</label>
            <ChipGroup value={rules.job_type} options={JOB_TYPES} onChange={v => update({ job_type: v })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Experience level</label>
            <ChipGroup value={rules.experience_level} options={EXPERIENCE} onChange={v => update({ experience_level: v })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Work site</label>
            <ChipGroup value={rules.on_site} options={ON_SITE} onChange={v => update({ on_site: v })} />
          </div>
          <SelectInput
            label="Date posted"
            value={rules.date_posted}
            onChange={v => update({ date_posted: v })}
            options={DATE_POSTED.map(d => ({ value: d, label: d || '(any time)' }))}
          />
        </div>
      </SectionCard>

      {/* Section 4: Apply Mode */}
      <SectionCard icon={Zap} title="Apply Mode" description="Choose how the bot applies to jobs.">
        <div className="space-y-3">
          {APPLY_MODES.map(m => (
            <label key={m.value} className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-colors">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${rules.apply_mode === m.value ? 'border-primary' : 'border-border'}`}>
                {rules.apply_mode === m.value && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <input
                type="radio"
                name="apply_mode"
                className="hidden"
                checked={rules.apply_mode === m.value}
                onChange={() => update({ apply_mode: m.value })}
              />
              <span className="text-sm">{m.label}</span>
            </label>
          ))}
        </div>
        <div className="pt-2 border-t border-border">
          <Toggle
            label="LinkedIn easy-apply filter"
            description="Enable LinkedIn's own 'Easy Apply' filter when searching (recommended)."
            checked={rules.easy_apply_only}
            onChange={v => update({ easy_apply_only: v })}
          />
        </div>
      </SectionCard>

      {/* Section 5: Per-term resume override */}
      {parsedTerms.length > 0 && (
        <SectionCard icon={FileText} title="Per-term Resume" description="Optionally use a different resume for specific search terms.">
          {resumes.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-300 text-sm">
              <Info className="w-4 h-4 shrink-0" />
              <span>Upload resumes first in the <a href="/app/resumes" className="underline">Resumes</a> section to bind them to search terms.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {parsedTerms.map(term => (
                <div key={term} className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{term}</span>
                  <div className="relative">
                    <select
                      value={(rules.per_term_resume || {})[term] || ''}
                      onChange={e => {
                        const next = { ...(rules.per_term_resume || {}) }
                        if (e.target.value) next[term] = e.target.value
                        else delete next[term]
                        update({ per_term_resume: next })
                      }}
                      className="appearance-none pl-3 pr-7 py-1.5 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">(use default)</option>
                      {resumes.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Bottom save bar */}
      <div className={`sticky bottom-4 flex items-center justify-between gap-4 p-4 rounded-xl border backdrop-blur-md transition-all duration-300 ${
        dirty
          ? 'border-primary/30 bg-card/90 shadow-xl shadow-primary/10'
          : 'border-border/50 bg-card/50'
      }`}>
        <div className="flex items-center gap-2 text-sm">
          {dirty
            ? <><AlertCircle className="w-4 h-4 text-amber-400" /><span className="text-amber-400">Unsaved changes</span></>
            : <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-muted-foreground">All changes saved</span></>
          }
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Rules'}
        </Button>
      </div>
    </div>
  )
}
