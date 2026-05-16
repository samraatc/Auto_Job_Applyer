import { useState, useEffect } from 'react'

function ConfigEditor() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      alert("Configuration saved securely!")
    } catch (err) {
      console.error(err)
      alert("Failed to save.")
    }
    setSaving(false)
  }

  if (loading) return <div className="loading" style={{ height: '400px' }}>Loading configurations...</div>

  const categories = Object.keys(config)
  const currentFields = config[activeCategory] || {}

  return (
    <div className="card">
      <div className="card-title">
        Bot Configuration
        <button className="btn btn-success" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      
      <div className="tabs">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`tab-button ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="config-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {Object.entries(currentFields).map(([key, val]) => (
          <div className="form-group" key={key}>
            <label className="form-label">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
            {typeof val === 'boolean' ? (
              <label className="form-checkbox" style={{ padding: '0.625rem 0' }}>
                <input 
                  type="checkbox" 
                  checked={val} 
                  onChange={(e) => handleChange(activeCategory, key, e.target.checked)} 
                />
                <span style={{ color: 'var(--text-primary)' }}>{val ? 'Enabled' : 'Disabled'}</span>
              </label>
            ) : typeof val === 'string' && val.length > 50 ? (
               <textarea 
                  className="form-input" 
                  value={val} 
                  onChange={(e) => handleChange(activeCategory, key, e.target.value)} 
                />
            ) : (
              <input 
                type="text" 
                className="form-input" 
                value={typeof val === 'object' ? JSON.stringify(val) : val} 
                onChange={(e) => {
                  let v = e.target.value;
                  if (typeof val === 'number') v = Number(v);
                  if (typeof val === 'object') {
                      try { v = JSON.parse(v) } catch { v = e.target.value }
                  }
                  handleChange(activeCategory, key, v)
                }} 
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ConfigEditor
