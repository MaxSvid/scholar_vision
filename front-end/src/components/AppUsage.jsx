import { useState, useRef, useEffect } from 'react'
import './SubPanel.css'
import './FileImport.css'
import './HealthImport.css'

const CATEGORIES = {
  Productive: ['VS Code', 'Notion', 'Anki', 'Zotero', 'Word', 'Excel', 'Scholar Docs'],
  Neutral:    ['Spotify', 'YouTube (Study)', 'Slack', 'Email'],
  Distracting:['TikTok', 'Instagram', 'Twitter/X', 'Reddit', 'Netflix', 'Discord', 'Gaming'],
}

const PRESET_APPS = [...CATEGORIES.Productive, ...CATEGORIES.Neutral, ...CATEGORIES.Distracting, 'Other']

function getCategory(app) {
  for (const [cat, apps] of Object.entries(CATEGORIES)) {
    if (apps.includes(app)) return cat
  }
  return 'Neutral'
}

function getSessionId() {
  let id = sessionStorage.getItem('sv_session_id')
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('sv_session_id', id) }
  return id
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

export default function AppUsage({ logs, setLogs }) {
  const [form, setForm] = useState({ app: '', hours: '', date: new Date().toISOString().slice(0,10) })
  const [showForm, setShowForm] = useState(false)

  // Import state
  const [imports,  setImports]  = useState([])
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [detail,   setDetail]   = useState(null)
  const inputRef  = useRef()
  const sessionId = getSessionId()

  useEffect(() => { fetchImports() }, [])

  async function fetchImports() {
    try {
      const res  = await fetch(`/api/activity/app-usage?session_id=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      setImports(data.imports || [])
    } catch { /* backend offline */ }
  }

  async function submitJson(text) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/activity/app-usage?session_id=${sessionId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    text,
      })
      if (res.status === 413) throw new Error('Payload too large (max 5 MB)')
      if (res.status === 422) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Invalid app usage JSON format')
      }
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      await fetchImports()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async file => {
    if (!file.name.endsWith('.json')) { setError('Only .json files are accepted'); return }
    const text = await file.text()
    submitJson(text)
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const removeImport = async id => {
    try { await fetch(`/api/activity/app-usage/${id}`, { method: 'DELETE' }) } catch { /* best-effort */ }
    setImports(prev => prev.filter(i => i.import_id !== id))
    if (expanded === id) { setExpanded(null); setDetail(null) }
  }

  const toggleDetail = async id => {
    if (expanded === id) { setExpanded(null); setDetail(null); return }
    setExpanded(id); setDetail(null)
    try {
      const res  = await fetch(`/api/activity/app-usage/${id}`)
      const data = await res.json()
      setDetail(data)
    } catch { setDetail({ error: 'Could not load detail' }) }
  }

  // Existing manual stats
  const total        = logs.reduce((s, l) => s + l.hours, 0)
  const productive   = logs.filter(l => l.category === 'Productive').reduce((s, l) => s + l.hours, 0)
  const distracting  = logs.filter(l => l.category === 'Distracting').reduce((s, l) => s + l.hours, 0)
  const focusRatio   = total ? Math.round((productive / total) * 100) : 0

  const byApp = Object.values(
    logs.reduce((acc, l) => {
      if (!acc[l.app]) acc[l.app] = { app: l.app, hours: 0, category: l.category }
      acc[l.app].hours += l.hours
      return acc
    }, {})
  ).sort((a, b) => b.hours - a.hours)

  const maxApp = byApp[0]?.hours || 1

  const addLog = () => {
    if (!form.app || !form.hours) return
    const category = getCategory(form.app)
    setLogs(prev => [{ ...form, id: Date.now(), hours: parseFloat(form.hours), category }, ...prev])
    setForm({ app: '', hours: '', date: new Date().toISOString().slice(0, 10) })
    setShowForm(false)
  }

  const catColor = cat =>
    cat === 'Productive' ? 'var(--fg)' :
    cat === 'Distracting' ? 'var(--fg-dim)' : 'var(--fg-muted)'

  return (
    <div className="subpanel">

      {/* ── JSON Import Section ─────────────────────────────────────── */}
      <div className="panel-title">&gt; APP USAGE IMPORT</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Import app usage data from a JSON file to seed the Prediction Engine.
      </p>

      <div
        className={`fi-dropzone ${dragging ? 'dragging' : ''} ${loading ? 'fi-uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current.click()}
      >
        <input
          ref={inputRef} type="file" accept=".json"
          style={{ display: 'none' }}
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <div className="fi-drop-icon">{loading ? '…' : dragging ? '▼' : '◈'}</div>
        <div className="fi-drop-text">
          {loading ? 'IMPORTING…' : dragging ? 'DROP FILE HERE' : 'DRAG & DROP .JSON  //  CLICK TO BROWSE'}
        </div>
        <div className="fi-drop-sub muted-text">App usage JSON format</div>
      </div>

      {error && <div className="fi-error muted-text">&gt; {error}</div>}

      <div className="hi-list" style={{ marginBottom: '1.5rem' }}>
        {imports.map(imp => (
          <div key={imp.import_id} className="retro-card hi-import-row">
            <div className="hi-import-main">
              <div className="hi-import-meta">
                <span className="hi-import-ts">{fmtTime(imp.sync_timestamp || imp.imported_at)}</span>
                <span className="muted-text hi-import-count">{imp.log_count} logs</span>
                {imp.client_version && (
                  <span className="muted-text hi-import-ver">v{imp.client_version}</span>
                )}
              </div>
              <div className="hi-import-actions">
                <button className="retro-btn hi-detail-btn" onClick={() => toggleDetail(imp.import_id)}>
                  {expanded === imp.import_id ? 'HIDE' : 'DETAIL'}
                </button>
                <button className="sp-delete muted-text" onClick={() => removeImport(imp.import_id)}>✕</button>
              </div>
            </div>

            {expanded === imp.import_id && (
              <div className="hi-detail">
                {!detail && <div className="muted-text" style={{ fontSize: '0.78rem' }}>Loading…</div>}
                {detail?.error && <div className="muted-text">{detail.error}</div>}
                {detail?.entries && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                    <thead>
                      <tr className="muted-text" style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.2rem 0.4rem' }}>APP</th>
                        <th style={{ textAlign: 'left', padding: '0.2rem 0.4rem' }}>CATEGORY</th>
                        <th style={{ textAlign: 'right', padding: '0.2rem 0.4rem' }}>MINS</th>
                        <th style={{ textAlign: 'right', padding: '0.2rem 0.4rem' }}>DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((e, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.2rem 0.4rem', color: 'var(--fg)' }}>{e.app_name}</td>
                          <td style={{ padding: '0.2rem 0.4rem', color: catColor(e.category) }}>{e.category}</td>
                          <td style={{ padding: '0.2rem 0.4rem', textAlign: 'right' }}>{e.duration_mins}</td>
                          <td style={{ padding: '0.2rem 0.4rem', textAlign: 'right' }}>{e.logged_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
        {imports.length === 0 && !loading && (
          <div className="sp-empty muted-text">&gt; No app usage data imported yet.</div>
        )}
      </div>

      {/* ── Manual Entry Section ────────────────────────────────────── */}
      <div className="panel-title">&gt; APP USAGE MONITOR</div>

      {/* Summary */}
      <div className="sp-stat-row">
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{total.toFixed(1)}h</div>
          <div className="sp-stat-lbl">TOTAL SCREEN</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{productive.toFixed(1)}h</div>
          <div className="sp-stat-lbl">PRODUCTIVE</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{distracting.toFixed(1)}h</div>
          <div className="sp-stat-lbl">DISTRACTING</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val" style={{ color: focusRatio > 60 ? 'var(--fg)' : 'var(--fg-dim)' }}>
            {focusRatio}%
          </div>
          <div className="sp-stat-lbl">FOCUS RATIO</div>
        </div>
      </div>

      {/* Horizontal bar chart per app */}
      <div className="retro-card sp-chart-wrap">
        <div className="sp-chart-title muted-text">APP BREAKDOWN</div>
        <div className="sp-hbar-list">
          {byApp.map(a => (
            <div key={a.app} className="sp-hbar-row">
              <div className="sp-hbar-name">{a.app}</div>
              <div className="sp-hbar-track">
                <div
                  className="sp-hbar-fill"
                  style={{
                    width: `${(a.hours / maxApp) * 100}%`,
                    background: a.category === 'Distracting' ? 'transparent' : catColor(a.category),
                    boxShadow: a.category === 'Distracting' ? 'inset 0 0 0 1px var(--border-hi)' : undefined,
                  }}
                />
              </div>
              <div className="sp-hbar-val muted-text">{a.hours.toFixed(1)}h</div>
              <div className="sp-hbar-cat muted-text" style={{ color: catColor(a.category) }}>
                {a.category.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add log */}
      <div className="sp-action-row">
        <button className="retro-btn solid" onClick={() => setShowForm(v => !v)}>
          {showForm ? '— CANCEL' : '+ LOG APP'}
        </button>
      </div>

      {showForm && (
        <div className="retro-card sp-form">
          <div className="sp-form-row">
            <div className="sp-form-col">
              <label className="field-label">APP / SERVICE</label>
              <select className="retro-input" value={form.app}
                onChange={e => setForm(p => ({ ...p, app: e.target.value }))}>
                <option value="">-- SELECT --</option>
                {PRESET_APPS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="sp-form-col">
              <label className="field-label">HOURS TODAY</label>
              <input className="retro-input" type="number" min="0.1" max="24" step="0.1"
                placeholder="1.5" value={form.hours}
                onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
            </div>
            <div className="sp-form-col">
              <label className="field-label">DATE</label>
              <input className="retro-input" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <button className="retro-btn solid" onClick={addLog}>SAVE LOG</button>
        </div>
      )}

      {/* Log list */}
      <div className="sp-list">
        {logs.map(l => (
          <div key={l.id} className="retro-card sp-session-row">
            <div className="sp-session-left">
              <span className="sp-session-subject">{l.app}</span>
              <span className="sp-session-hours dim-text">{l.hours}h</span>
            </div>
            <span className="muted-text" style={{ fontSize: '0.72rem', color: catColor(l.category) }}>
              {l.category.toUpperCase()}
            </span>
            <span className="muted-text" style={{ fontSize: '0.72rem' }}>{l.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
