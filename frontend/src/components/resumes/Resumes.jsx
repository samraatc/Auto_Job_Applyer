import { useEffect, useState, useRef } from 'react'
import { apiJson, apiUpload, api } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText, Upload, Star, Trash2, CheckCircle,
  Loader2, AlertCircle, Plus, X, Tag
} from 'lucide-react'

// ── Empty State ────────────────────────────────────────────────────
function EmptyResumes({ onUploadClick }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <FileText className="w-10 h-10 text-primary/60" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No resumes yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Upload your first resume to get started. The bot will use this when applying to jobs automatically.
      </p>
      <Button onClick={onUploadClick} className="gap-2">
        <Upload className="w-4 h-4" /> Upload your first resume
      </Button>
    </div>
  )
}

// ── Resume Card ────────────────────────────────────────────────────
function ResumeCard({ resume, isDefault, onSetDefault, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${resume.label}"?`)) return
    setDeleting(true)
    await onDelete(resume.id)
  }

  const handleSetDefault = async () => {
    setSettingDefault(true)
    await onSetDefault(resume.id)
    setSettingDefault(false)
  }

  return (
    <div className={`
      relative group flex flex-col gap-3 p-5 rounded-xl border transition-all duration-200
      ${isDefault
        ? 'border-primary/50 bg-primary/5 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
        : 'border-border bg-card hover:border-primary/30 hover:bg-card/80'}
    `}>
      {/* Default badge */}
      {isDefault && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          <Star className="w-3 h-3 fill-primary" /> Default
        </div>
      )}

      {/* Icon + Name */}
      <div className="flex items-start gap-3 pr-20">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDefault ? 'bg-primary/20' : 'bg-secondary'}`}>
          <FileText className={`w-5 h-5 ${isDefault ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{resume.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {resume.uploaded_at ? new Date(resume.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Uploaded recently'}
          </p>
        </div>
      </div>

      {/* Tags */}
      {resume.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resume.tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs">
              <Tag className="w-2.5 h-2.5" /> {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1">
        {!isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-8"
            disabled={settingDefault}
            onClick={handleSetDefault}
          >
            {settingDefault
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Star className="w-3 h-3" />}
            Set as default
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </div>
  )
}

// ── Upload Form ───────────────────────────────────────────────────
function UploadForm({ onSuccess, onCancel }) {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState('')
  const [makeDefault, setMakeDefault] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.match(/\.pdf$/i)) {
      toast.error('Only PDF files are supported.')
      return
    }
    setFile(f)
    if (!label) setLabel(f.name.replace(/\.pdf$/i, ''))
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file) { toast.error('Please choose a PDF first.'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label || file.name.replace(/\.pdf$/i, ''))
      fd.append('tags', tags)
      fd.append('make_default', makeDefault)
      await apiUpload('/api/resumes', fd)
      toast.success(`"${label || file.name}" uploaded successfully.`)
      onSuccess()
    } catch (err) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-primary/30 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Upload New Resume
        </CardTitle>
        <CardDescription>PDF files only. Max 10 MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {/* Drop Zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary bg-primary/10'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-border hover:border-primary/50 hover:bg-secondary/40'
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <p className="font-medium text-foreground text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive mt-1"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setLabel('') }}
                >
                  <X className="w-3 h-3 inline mr-1" />Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8 opacity-40" />
                <p className="text-sm font-medium">Drop PDF here or <span className="text-primary">browse</span></p>
              </div>
            )}
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Label</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tags <span className="text-muted-foreground font-normal">(comma-separated, optional)</span></label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. python, backend, startup"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">Tags help match this resume to specific search terms.</p>
          </div>

          {/* Default toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={`w-10 h-5 rounded-full transition-colors relative ${makeDefault ? 'bg-primary' : 'bg-secondary border border-border'}`}
              onClick={() => setMakeDefault(v => !v)}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${makeDefault ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium">Set as default resume</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={busy} className="flex-1 gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy ? 'Uploading…' : 'Upload Resume'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────
export default function Resumes() {
  const toast = useToast()
  const [data, setData] = useState({ resumes: [], default_id: null })
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const d = await apiJson('/api/resumes')
      setData(d)
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to load resumes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const handleSetDefault = async (id) => {
    try {
      await api(`/api/resumes/${id}/default`, { method: 'PATCH' })
      await refresh()
      toast.success('Default resume updated.')
    } catch (e) {
      toast.error('Failed to update default: ' + (e.message || ''))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api(`/api/resumes/${id}`, { method: 'DELETE' })
      await refresh()
      toast.success('Resume deleted.')
    } catch (e) {
      toast.error('Delete failed: ' + (e.message || ''))
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resumes</h1>
          <p className="text-muted-foreground mt-1">
            Manage your resume library. The default resume is used for all applications.
          </p>
        </div>
        {!showUpload && data.resumes.length > 0 && (
          <Button onClick={() => setShowUpload(true)} className="gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Resume
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload form */}
      {showUpload && (
        <UploadForm
          onSuccess={() => { setShowUpload(false); refresh() }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Loading resumes…</p>
          </div>
        </div>
      ) : data.resumes.length === 0 && !showUpload ? (
        <EmptyResumes onUploadClick={() => setShowUpload(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.resumes.map(r => (
            <ResumeCard
              key={r.id}
              resume={r}
              isDefault={data.default_id === r.id}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Info tip */}
      {!loading && data.resumes.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm">
          <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-blue-300">
            <strong className="text-blue-200">Tip:</strong> You can assign specific resumes to search terms in{' '}
            <a href="/app/search" className="underline hover:text-blue-100">Search Rules</a>.
          </p>
        </div>
      )}
    </div>
  )
}
