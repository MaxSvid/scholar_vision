import { useState, useEffect, useRef } from 'react'
import './SubPanel.css'

const INIT_SESSIONS = [
  { id: 1, duration: 45, breaks: 2, quality: 'High',   date: '2026-02-27' },
  { id: 2, duration: 25, breaks: 1, quality: 'Medium', date: '2026-02-26' },
  { id: 3, duration: 60, breaks: 3, quality: 'High',   date: '2026-02-25' },
]

const QUALITY_OPTS = ['High', 'Medium', 'Low']

export default function AttentionSpan() {
  const [sessions, setSessions] = useState(INIT_SESSIONS)
  const [form, setForm] = useState({ duration: '', breaks: '', quality: 'High', date: new Date().toISOString().slice(0,10) })
  const [showForm, setShowForm] = useState(false)

  // Pomodoro-style live timer
  const [timerActive, setTimerActive] = useState(false)
  const [timerSecs, setTimerSecs]     = useState(0)
  const [timerMode, setTimerMode]     = useState('focus') // 'focus' | 'break'
  const intervalRef = useRef(null)

  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [timerActive])

  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const stopTimer = () => {
    setTimerActive(false)
    if (timerSecs > 60) {
      const mins = Math.round(timerSecs / 60)
      setSessions(prev => [{
        id: Date.now(), duration: mins, breaks: 0,
        quality: mins > 30 ? 'High' : 'Medium',
        date: new Date().toISOString().slice(0,10),
      }, ...prev])
    }
    setTimerSecs(0)
  }

  const avg = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + x.duration, 0) / sessions.length)
    : 0

  const highQ = sessions.filter(s => s.quality === 'High').length
  const best  = sessions.length ? Math.max(...sessions.map(s => s.duration)) : 0

  const addSession = () => {
    if (!form.duration) return
    setSessions(prev => [{ ...form, id: Date.now(), duration: parseInt(form.duration), breaks: parseInt(form.breaks || 0) }, ...prev])
    setForm({ duration: '', breaks: '', quality: 'High', date: new Date().toISOString().slice(0,10) })
    setShowForm(false)
  }

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
          <button className="retro-btn solid" onClick={addSession}>SAVE SESSION</button>
        </div>
      )}

      {/* Session list */}
      <div className="sp-list">
        {sessions.map(s => (
          <div key={s.id} className="retro-card sp-session-row">
            <div className="sp-session-left">
              <span className="sp-session-subject">{s.duration}min focus</span>
              <span className="sp-session-hours dim-text">{s.breaks} breaks</span>
            </div>
            <span className="muted-text" style={{ fontSize: '0.72rem',
              color: s.quality === 'High' ? 'var(--fg)' : s.quality === 'Medium' ? 'var(--fg-dim)' : 'var(--fg-muted)' }}>
              {s.quality.toUpperCase()}
            </span>
            <span className="muted-text" style={{ fontSize: '0.72rem' }}>{s.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
