import { useState } from 'react'
import './SubPanel.css'

const CATEGORIES = {
  Productive: ['VS Code', 'Notion', 'Anki', 'Zotero', 'Word', 'Excel', 'Scholar Docs'],
  Neutral:    ['Spotify', 'YouTube (Study)', 'Slack', 'Email'],
  Distracting:['TikTok', 'Instagram', 'Twitter/X', 'Reddit', 'Netflix', 'Discord', 'Gaming'],
}

const PRESET_APPS = [...CATEGORIES.Productive, ...CATEGORIES.Neutral, ...CATEGORIES.Distracting, 'Other']

const INIT_LOGS = [
  { id: 1, app: 'VS Code',    hours: 3.5, category: 'Productive', date: '2026-02-27' },
  { id: 2, app: 'TikTok',     hours: 1.2, category: 'Distracting', date: '2026-02-27' },
  { id: 3, app: 'Anki',       hours: 0.8, category: 'Productive', date: '2026-02-26' },
  { id: 4, app: 'Netflix',    hours: 2.0, category: 'Distracting', date: '2026-02-26' },
]

function getCategory(app) {
  for (const [cat, apps] of Object.entries(CATEGORIES)) {
    if (apps.includes(app)) return cat
  }
  return 'Neutral'
}

export default function AppUsage() {
  const [logs, setLogs] = useState(INIT_LOGS)
  const [form, setForm] = useState({ app: '', hours: '', date: new Date().toISOString().slice(0,10) })
  const [showForm, setShowForm] = useState(false)

  const total        = logs.reduce((s, l) => s + l.hours, 0)
  const productive   = logs.filter(l => l.category === 'Productive').reduce((s, l) => s + l.hours, 0)
  const distracting  = logs.filter(l => l.category === 'Distracting').reduce((s, l) => s + l.hours, 0)
  const focusRatio   = total ? Math.round((productive / total) * 100) : 0

  // Per-app aggregation
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
                    background: catColor(a.category),
                    boxShadow: `0 0 6px ${catColor(a.category)}`,
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
