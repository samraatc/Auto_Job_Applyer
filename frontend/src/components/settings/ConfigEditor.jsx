import { useState, useEffect } from 'react'

function ConfigEditor() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [activeCategory, setActiveCategory] = useState('personals')

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const handleChange = (category, key, value) => {
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setSaveErr('')
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      setSaveErr('Failed to save configuration.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground text-sm">
        <span className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        Loading configurations…
      </div>
    )
  }

  const categories = Object.keys(config)
  const currentFields = config[activeCategory] || {}

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bot Configuration</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Edit the bot's YAML configuration categories. Changes take effect on next run.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </span>
            )}
            {saveErr && (
              <span className="text-sm text-destructive">{saveErr}</span>
            )}
            <button
              id="btn-save-config"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap border-b border-border pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              id={`config-tab-${cat}`}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fields grid */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(currentFields).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </label>

              {typeof val === 'boolean' ? (
                <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/40 transition-colors">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={val}
                      onChange={e => handleChange(activeCategory, key, e.target.checked)}
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors ${val ? 'bg-primary' : 'bg-secondary border border-border'}`} />
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-foreground">{val ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : typeof val === 'string' && val.length > 50 ? (
                <textarea
                  className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
                  value={val}
                  onChange={e => handleChange(activeCategory, key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={typeof val === 'object' ? JSON.stringify(val) : val}
                  onChange={e => {
                    let v = e.target.value
                    if (typeof val === 'number') v = Number(v)
                    if (typeof val === 'object') {
                      try { v = JSON.parse(v) } catch { v = e.target.value }
                    }
                    handleChange(activeCategory, key, v)
                  }}
                />
              )}
            </div>
          ))}

          {Object.keys(currentFields).length === 0 && (
            <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
              No fields in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConfigEditor
