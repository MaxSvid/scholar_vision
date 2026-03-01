import { useState, useRef, useEffect } from 'react'
import './SubPanel.css'
import './FileImport.css'
import './HealthImport.css'

function getSessionId() {
  let id = sessionStorage.getItem('sv_session_id')
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('sv_session_id', id) }
  return id
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}

export default function StudyTracker({ sessions, setSessions }) {
  const [form, setForm] = useState({ subject: '', hours: '', date: today(), notes: '' })
  const [showForm, setShowForm] = useState(false)

  // Import state
  const [imports,  setImports]  = useState([])
  const [summary,  setSummary]  = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [detail,   setDetail]   = useState(null)
  const inputRef  = useRef()
  const sessionId = getSessionId()

  useEffect(() => { fetchImports() }, [])

  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  async function fetchImports() {
    try {
      const res  = await fetch(`/api/activity/study-logs?session_id=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      setImports(data.imports || [])
      setSummary(data.summary  || null)
      setSessions(
        (data.manual_entries || []).map(e => ({
          id:      e.entry_id,
          subject: e.subject_tag || '',
          hours:   +(e.duration_mins / 60).toFixed(2),
          date:    String(e.logged_date),
          notes:   e.notes || '',
        }))
      )
    } catch { /* backend offline */ }
  }

  async function submitJson(text) {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/activity/study-logs?session_id=${sessionId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    text,
      })
      if (res.status === 413) throw new Error('Payload too large (max 5 MB)')
      if (res.status === 422) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Invalid study sessions JSON format')
      }
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      await fetchImports()
      window.dispatchEvent(new CustomEvent('sv:data-imported'))
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async file => {
    if (!file.name.endsWith('.json')) { setError('Only .json files are accepted'); return }
    const text = await file.text()
    await submitJson(text)
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const removeImport = async id => {
    if (expanded === id) { setExpanded(null); setDetail(null) }
    try { await fetch(`/api/activity/study-logs/${id}`, { method: 'DELETE' }) } catch { /* best-effort */ }
    await fetchImports()
  }

  const toggleDetail = async id => {
    if (expanded === id) { setExpanded(null); setDetail(null); return }
    setExpanded(id); setDetail(null)
    try {
      const res  = await fetch(`/api/activity/study-logs/${id}`)
      const data = await res.json()
      setDetail(data)
    } catch { setDetail({ error: 'Could not load detail' }) }
  }

  // Combined stats: imported (from backend summary) + manually entered
  const importedHours    = summary?.total_hours    ?? 0
  const importedSessions = summary?.total_sessions ?? 0
  const manualHours      = sessions.reduce((s, x) => s + x.hours, 0)
  const totalHours       = importedHours + manualHours
  const totalSessions    = importedSessions + sessions.length
  const avgHours         = totalSessions ? (totalHours / totalSessions).toFixed(1) : 0

  const usedSubjects = [...new Set([
    ...(summary?.subjects ?? []),
    ...sessions.map(s => s.subject).filter(Boolean),
  ])]

  const addSession = async () => {
    if (!form.subject || !form.hours) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/activity/study-logs/manual?session_id=${sessionId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: form.subject, hours: parseFloat(form.hours),
                               date: form.date, notes: form.notes }),
      })
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      await fetchImports()
      window.dispatchEvent(new CustomEvent('sv:data-imported'))
      setForm({ subject: '', hours: '', date: today(), notes: '' })
      setShowForm(false)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const removeSession = async id => {
    try {
      await fetch(`/api/activity/study-logs/manual/${id}?session_id=${sessionId}`, { method: 'DELETE' })
      await fetchImports()
      window.dispatchEvent(new CustomEvent('sv:data-imported'))
    } catch { /* best-effort */ }
  }

  // Weekly bar chart — imported hours (from backend) merged with manually entered hours
  const importedByDate = Object.fromEntries(
    (summary?.last_7_days ?? []).map(d => [d.date, d.hours])
  )
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key        = d.toISOString().slice(0, 10)
    const manualHrs  = sessions.filter(s => s.date === key).reduce((a, s) => a + s.hours, 0)
    const importedHrs = importedByDate[key] ?? 0
    return { label: d.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), hrs: manualHrs + importedHrs }
  })
  const maxHrs = Math.max(...last7.map(d => d.hrs), 1)

  return (
    <div className="subpanel">

      {/* ── JSON Import Section ─────────────────────────────────────── */}
      <div className="panel-title">&gt; STUDY SESSION IMPORT</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Import study sessions from a JSON file to seed the Prediction Engine.
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
        <div className="fi-drop-icon">{loading ? '…' : dragging ? '▼' : '◐'}</div>
        <div className="fi-drop-text">
          {loading ? 'IMPORTING…' : dragging ? 'DROP FILE HERE' : 'DRAG & DROP .JSON  //  CLICK TO BROWSE'}
        </div>
        <div className="fi-drop-sub muted-text">Study sessions JSON format</div>
      </div>

      {error && <div className="fi-error muted-text">&gt; {error}</div>}

      <div className="hi-list" style={{ marginBottom: '1.5rem' }}>
        {imports.map(imp => (
          <div key={imp.import_id} className="retro-card hi-import-row">
            <div className="hi-import-main">
              <div className="hi-import-meta">
                <span className="hi-import-ts">{fmtTime(imp.sync_timestamp || imp.imported_at)}</span>
                <span className="muted-text hi-import-count">{imp.session_count} sessions</span>
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
                {detail && !detail.error && (
                  <div className="hi-detail-summary">
                    <span className="hi-detail-chip muted-text">
                      {detail.entries?.length || 0} sessions
                    </span>
                    <span className="hi-detail-chip muted-text">
                      {detail.total_hours}h total
                    </span>
                    <span className="hi-detail-chip muted-text">
                      avg {detail.avg_breaks} breaks
                    </span>
                  </div>
                )}
                {detail?.entries?.map((e, i) => (
                  <div key={i} className="hi-metric-row muted-text">
                    <span className="hi-metric-type">{e.subject_tag || '—'}</span>
                    <span className="hi-metric-val">{e.duration_mins} min</span>
                    <span className="hi-metric-time">{fmtTime(e.started_at)}</span>
                    <span className="hi-metric-dev">{e.breaks_taken} breaks</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {imports.length === 0 && !loading && (
          <div className="sp-empty muted-text">&gt; No study session data imported yet.</div>
        )}
      </div>

      {/* ── Manual Entry Section ────────────────────────────────────── */}
      <div className="panel-title">&gt; STUDY LOG</div>

      {/* Summary row */}
      <div className="sp-stat-row">
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{totalHours.toFixed(1)}h</div>
          <div className="sp-stat-lbl">TOTAL LOGGED</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{avgHours}h</div>
          <div className="sp-stat-lbl">AVG / SESSION</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{totalSessions}</div>
          <div className="sp-stat-lbl">SESSIONS</div>
        </div>
      </div>

      {/* Weekly bar chart */}
      <div className="retro-card sp-chart-wrap">
        <div className="sp-chart-title muted-text">LAST 7 DAYS</div>
        <div className="sp-bar-chart">
          {last7.map(d => (
            <div key={d.label} className="sp-bar-col">
              <div className="sp-bar-track">
                <div
                  className="sp-bar-fill"
                  style={{ height: `${(d.hrs / maxHrs) * 100}%` }}
                  title={`${d.hrs}h`}
                />
              </div>
              <div className="sp-bar-label muted-text">{d.label}</div>
              <div className="sp-bar-val">{d.hrs > 0 ? `${d.hrs}h` : '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add session */}
      <div className="sp-action-row">
        <button className="retro-btn solid" onClick={() => setShowForm(v => !v)}>
          {showForm ? '— CANCEL' : '+ LOG SESSION'}
        </button>
      </div>

      {showForm && (
        <div className="retro-card sp-form">
          <div className="sp-form-row">
            <div className="sp-form-col">
              <label className="field-label">SUBJECT</label>
              <input
                className="retro-input"
                list="study-subject-suggestions"
                placeholder="e.g. Mathematics"
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              />
              <datalist id="study-subject-suggestions">
                {usedSubjects.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="sp-form-col">
              <label className="field-label">HOURS</label>
              <input className="retro-input" type="number" min="0.25" max="24" step="0.25"
                placeholder="2.5"
                value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
            </div>
            <div className="sp-form-col">
              <label className="field-label">DATE</label>
              <input className="retro-input" type="date"
                value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <label className="field-label">NOTES (optional)</label>
          <input className="retro-input" placeholder="What did you cover?"
            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          <button className="retro-btn solid" onClick={addSession}>SAVE SESSION</button>
        </div>
      )}

      {/* Session list */}
      <div className="sp-list">
        {sessions.map(s => (
          <div key={s.id} className="retro-card sp-session-row">
            <div className="sp-session-left">
              <span className="sp-session-subject">{s.subject}</span>
              <span className="sp-session-hours dim-text">{s.hours}h</span>
            </div>
            <div className="sp-session-mid muted-text">{s.date}{s.notes ? ` — ${s.notes}` : ''}</div>
            <button className="sp-delete muted-text" onClick={() => removeSession(s.id)}>✕</button>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="sp-empty muted-text">&gt; No sessions logged. Start tracking above.</div>
        )}
      </div>
    </div>
  )
}
