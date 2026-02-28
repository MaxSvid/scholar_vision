import { useState } from 'react'
import './SubPanel.css'

const SUBJECTS = ['Mathematics', 'Physics', 'Programming', 'Literature', 'History', 'Chemistry', 'Economics', 'Other']

const INIT_SESSIONS = [
  { id: 1, subject: 'Mathematics', hours: 2.5, date: '2026-02-27', notes: 'Calculus revision' },
  { id: 2, subject: 'Programming', hours: 3,   date: '2026-02-26', notes: 'Data structures assignment' },
]

export default function StudyTracker() {
  const [sessions, setSessions] = useState(INIT_SESSIONS)
  const [form, setForm] = useState({ subject: '', hours: '', date: today(), notes: '' })
  const [showForm, setShowForm] = useState(false)

  function today() {
    return new Date().toISOString().slice(0, 10)
  }

  const totalHours = sessions.reduce((s, x) => s + x.hours, 0)
  const avgHours   = sessions.length ? (totalHours / sessions.length).toFixed(1) : 0

  const addSession = () => {
    if (!form.subject || !form.hours) return
    setSessions(prev => [
      { ...form, id: Date.now(), hours: parseFloat(form.hours) },
      ...prev,
    ])
    setForm({ subject: '', hours: '', date: today(), notes: '' })
    setShowForm(false)
  }

  const removeSession = id => setSessions(prev => prev.filter(s => s.id !== id))

  // Weekly bar chart data (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const hrs = sessions.filter(s => s.date === key).reduce((a, s) => a + s.hours, 0)
    return { label: d.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), hrs }
  })
  const maxHrs = Math.max(...last7.map(d => d.hrs), 1)

  return (
    <div className="subpanel">
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
          <div className="sp-stat-val">{sessions.length}</div>
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
              <select className="retro-input" value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}>
                <option value="">-- SELECT --</option>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
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
