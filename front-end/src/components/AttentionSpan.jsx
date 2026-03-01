import { useState, useEffect, useRef } from 'react'
import './SubPanel.css'

const QUALITY_OPTS = ['High', 'Medium', 'Low']

function getSessionId() {
  let id = sessionStorage.getItem('sv_session_id')
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('sv_session_id', id) }
  return id
}

export default function AttentionSpan() {
  const [sessions,  setSessions]  = useState([])
  const [summary,   setSummary]   = useState(null)
  const [form,      setForm]      = useState({ duration: '', breaks: '', quality: 'High', date: new Date().toISOString().slice(0, 10) })
  const [showForm,  setShowForm]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  // Pomodoro-style live timer
  const [timerActive, setTimerActive] = useState(false)
  const [timerSecs,   setTimerSecs]   = useState(0)
  const [timerMode,   setTimerMode]   = useState('focus') // 'focus' | 'break'
  const intervalRef = useRef(null)
  const sessionId   = getSessionId()

  useEffect(() => { fetchSessions() }, [])

  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerActive])

  async function fetchSessions() {
    try {
      const res  = await fetch(`/api/activity/attention?session_id=${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      setSessions(data.entries || [])
      setSummary(data.summary  || null)
    } catch { /* backend offline */ }
  }

  async function saveEntry(data) {
    const res = await fetch(`/api/activity/attention?session_id=${sessionId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`Server error (${res.status})`)
    await fetchSessions()
    window.dispatchEvent(new CustomEvent('sv:data-imported'))
  }

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const stopTimer = async () => {
    setTimerActive(false)
    const secs = timerSecs
    setTimerSecs(0)
    if (secs > 60) {
      const mins = Math.round(secs / 60)
      try {
        await saveEntry({
          duration: mins,
          breaks:   0,
          quality:  mins > 30 ? 'High' : 'Medium',
          date:     new Date().toISOString().slice(0, 10),
          source:   'timer',
        })
      } catch (e) { setError(e.message) }
    }
  }

  const addSession = async () => {
    if (!form.duration) return
    setLoading(true); setError(null)
    try {
      await saveEntry({
        duration: parseInt(form.duration),
        breaks:   parseInt(form.breaks || 0),
        quality:  form.quality,
        date:     form.date,
        source:   'manual',
      })
      setForm({ duration: '', breaks: '', quality: 'High', date: new Date().toISOString().slice(0, 10) })
      setShowForm(false)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  const removeSession = async id => {
    try {
      await fetch(`/api/activity/attention/${id}?session_id=${sessionId}`, { method: 'DELETE' })
      await fetchSessions()
      window.dispatchEvent(new CustomEvent('sv:data-imported'))
    } catch { /* best-effort */ }
  }

  const avg   = summary?.avg_span_mins      ?? 0
  const best  = summary?.best_mins          ?? 0
  const highQ = summary?.high_quality_count ?? 0

  const qualColor = q =>
    q === 'High'   ? 'var(--fg)' :
    q === 'Medium' ? 'var(--fg-dim)' : 'var(--fg-muted)'

  return (
    <div className="subpanel">
      <div className="panel-title">&gt; ATTENTION SPAN TRACKER</div>

      {/* LIVE TIMER */}
      <div className="retro-card att-timer-card">
        <div className="att-timer-label muted-text">FOCUS TIMER</div>
        <div className="att-timer-display glow-text">{fmtTime(timerSecs)}</div>
        <div className="att-timer-mode muted-text">{timerMode.toUpperCase()} SESSION</div>
        <div className="att-timer-btns">
          {!timerActive
            ? <button className="retro-btn solid" onClick={() => setTimerActive(true)}>&gt; START</button>
            : <>
                <button className="retro-btn" onClick={() => setTimerActive(false)}>PAUSE</button>
                <button className="retro-btn" onClick={() => {
                  setTimerMode(m => m === 'focus' ? 'break' : 'focus')
                  setTimerActive(false); setTimerSecs(0)
                }}>SWITCH MODE</button>
                <button className="retro-btn solid" onClick={stopTimer}>STOP & LOG</button>
              </>
          }
        </div>
      </div>

      {/* Stats */}
      <div className="sp-stat-row">
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{avg}m</div>
          <div className="sp-stat-lbl">AVG SPAN</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{best}m</div>
          <div className="sp-stat-lbl">BEST SESSION</div>
        </div>
        <div className="retro-card sp-stat">
          <div className="sp-stat-val">{highQ}</div>
          <div className="sp-stat-lbl">HIGH QUALITY</div>
        </div>
      </div>

      {error && <div className="fi-error muted-text">&gt; {error}</div>}

      {/* Manual log */}
      <div className="sp-action-row">
        <button className="retro-btn solid" onClick={() => setShowForm(v => !v)}>
          {showForm ? '— CANCEL' : '+ LOG MANUALLY'}
        </button>
      </div>

      {showForm && (
        <div className="retro-card sp-form">
          <div className="sp-form-row">
            <div className="sp-form-col">
              <label className="field-label">FOCUS DURATION (min)</label>
              <input className="retro-input" type="number" min="1" max="300" placeholder="45"
                value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} />
            </div>
            <div className="sp-form-col">
              <label className="field-label">BREAK COUNT</label>
              <input className="retro-input" type="number" min="0" max="20" placeholder="2"
                value={form.breaks} onChange={e => setForm(p => ({ ...p, breaks: e.target.value }))} />
            </div>
            <div className="sp-form-col">
              <label className="field-label">QUALITY</label>
              <select className="retro-input" value={form.quality}
                onChange={e => setForm(p => ({ ...p, quality: e.target.value }))}>
                {QUALITY_OPTS.map(q => <option key={q}>{q}</option>)}
              </select>
            </div>
            <div className="sp-form-col">
              <label className="field-label">DATE</label>
              <input className="retro-input" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <button className="retro-btn solid" onClick={addSession} disabled={loading}>
            {loading ? 'SAVING…' : 'SAVE SESSION'}
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="sp-list">
        {sessions.map(s => (
          <div key={s.entry_id} className="retro-card sp-session-row">
            <div className="sp-session-left">
              <span className="sp-session-subject">{s.duration_mins}min focus</span>
              <span className="sp-session-hours dim-text">{s.breaks_taken} breaks</span>
            </div>
            <span className="muted-text" style={{ fontSize: '0.72rem', color: qualColor(s.quality) }}>
              {s.quality.toUpperCase()}
            </span>
            <span className="muted-text" style={{ fontSize: '0.72rem' }}>{s.logged_date}</span>
            {s.source === 'timer' && (
              <span className="muted-text" style={{ fontSize: '0.65rem', opacity: 0.6 }}>TIMER</span>
            )}
            <button className="sp-delete muted-text" onClick={() => removeSession(s.entry_id)}>✕</button>
          </div>
        ))}
        {sessions.length === 0 && !loading && (
          <div className="sp-empty muted-text">&gt; No focus sessions logged yet.</div>
        )}
      </div>
    </div>
  )
}
