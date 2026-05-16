import { useEffect, useState } from 'react'
import { apiJson, apiUpload, api } from '../api'

function Resumes() {
  const [data, setData] = useState({ resumes: [], default_id: null })
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState('')
  const [makeDefault, setMakeDefault] = useState(true)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = () => apiJson('/api/resumes').then(setData).catch(e => setErr(e.message))

  useEffect(() => { refresh() }, [])

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return setErr('Choose a PDF first')
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('label', label || file.name.replace(/\.pdf$/i, ''))
      fd.append('tags', tags)
      fd.append('make_default', makeDefault)
      await apiUpload('/api/resumes', fd)
      setLabel(''); setTags(''); setFile(null)
      refresh()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const setDef = async (id) => {
    await api(`/api/resumes/${id}/default`, { method: 'PATCH' })
    refresh()
  }
  const del = async (id) => {
    if (!confirm('Delete this resume?')) return
    await api(`/api/resumes/${id}`, { method: 'DELETE' })
    refresh()
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">Upload resume</div>
        <form onSubmit={upload} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files[0])} />
          <input placeholder="Label (e.g. Product Manager – India)" value={label} onChange={e => setLabel(e.target.value)}
                 style={{ padding: 10, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <input placeholder="Tags, comma-separated (matched to search_terms)" value={tags} onChange={e => setTags(e.target.value)}
                 style={{ padding: 10, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <label><input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} /> Set as default</label>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>
          {err && <div style={{ color: '#e57373' }}>{err}</div>}
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Registered resumes</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: 8 }}>Label</th><th>Tags</th><th>Uploaded</th><th>Default</th><th></th>
            </tr>
          </thead>
          <tbody>
            {data.resumes.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: 8 }}>{r.label}</td>
                <td>{(r.tags || []).join(', ')}</td>
                <td>{r.uploaded_at?.slice(0, 10)}</td>
                <td>{data.default_id === r.id ? '✓' : <button className="btn" onClick={() => setDef(r.id)}>Make default</button>}</td>
                <td><button className="btn btn-danger" onClick={() => del(r.id)}>Delete</button></td>
              </tr>
            ))}
            {data.resumes.length === 0 && <tr><td colSpan={5} style={{ padding: 12, color: 'var(--text-secondary)' }}>No resumes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Resumes
