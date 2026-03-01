import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './SubPanel.css'
import './HealthImport.css'

const METRIC_LABELS = {
  step_count:                    'Steps',
  heart_rate:                    'Heart Rate',
  resting_heart_rate:            'Resting HR',
  walking_heart_rate_average:    'Walking HR',
  heart_rate_variability_sdnn:   'HRV',
  blood_oxygen_saturation:       'Blood O₂',
  respiratory_rate:              'Resp. Rate',
  body_temperature:              'Body Temp',
  blood_pressure_systolic:       'BP Systolic',
  blood_pressure_diastolic:      'BP Diastolic',
  sleep_analysis:                'Sleep',
  active_energy_burned:          'Active Cal',
  basal_energy_burned:           'Basal Cal',
  distance_walking_running:      'Distance',
  flights_climbed:               'Flights',
  exercise_time:                 'Exercise',
  stand_time:                    'Stand Time',
  vo2_max:                       'VO₂ Max',
  body_mass:                     'Weight',
  body_mass_index:               'BMI',
  body_fat_percentage:           'Body Fat',
  mindful_session:               'Mindfulness',
  dietary_energy_consumed:       'Calories',
  dietary_water:                 'Water',
}

const METRIC_ICONS = {
  step_count: '◈', heart_rate: '◉', sleep_analysis: '◐',
  active_energy_burned: '◇', body_mass: '◎', mindful_session: '❂',
  default: '▦',
}

function label(type)  { return METRIC_LABELS[type] || type.replace(/_/g, ' ') }
function icon(type)   { return METRIC_ICONS[type]  || METRIC_ICONS.default }
function fmtTime(iso) { return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—' }

export default function HealthImport() {
  const { apiFetch } = useAuth()
  const [imports,   setImports]   = useState([])
  const [summary,   setSummary]   = useState([])
  const [dragging,  setDragging]  = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [expanded,  setExpanded]  = useState(null)
  const [detail,    setDetail]    = useState(null)
  const inputRef = useRef()

  useEffect(() => { fetchImports(); fetchSummary() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchImports() {
    try {
      const res  = await apiFetch('/api/health/imports')
      if (!res.ok) return
      const data = await res.json()
      setImports(data.imports || [])
    } catch { /* backend offline */ }
  }

  async function fetchSummary() {
    try {
      const res  = await apiFetch('/api/health/metrics/summary')
      if (!res.ok) return
      const data = await res.json()
      setSummary(data.summary || [])
    } catch { /* backend offline */ }
  }

  async function submitJson(jsonText) {
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/api/health/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    jsonText,
      })
      if (res.status === 413) throw new Error('Payload too large (max 10 MB)')
      if (res.status === 422) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || 'Invalid health JSON format')
      }
      if (!res.ok) throw new Error(`Server error (${res.status})`)
      await fetchImports()
      await fetchSummary()
      setPasteText('')
      setPasteMode(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async file => {
    if (!file.name.endsWith('.json')) {
      setError('Only .json files are accepted')
      return
    }
    const text = await file.text()
    submitJson(text)
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const removeImport = async id => {
    try {
      await apiFetch(`/api/health/imports/${id}`, { method: 'DELETE' })
    } catch { /* best-effort */ }
    setImports(prev => prev.filter(i => i.import_id !== id))
    if (expanded === id) { setExpanded(null); setDetail(null) }
    await fetchSummary()
  }

  const toggleDetail = async id => {
    if (expanded === id) { setExpanded(null); setDetail(null); return }
    setExpanded(id)
    setDetail(null)
    try {
      const res  = await apiFetch(`/api/health/imports/${id}`)
      const data = await res.json()
      setDetail(data)
    } catch { setDetail({ error: 'Could not load detail' }) }
  }

  const totalMetrics = imports.reduce((s, i) => s + (i.metric_count || 0), 0)

  return (
    <div className="subpanel">
      <div className="panel-title">♡ APPLE HEALTH IMPORT</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Import health metrics from Apple Health JSON exports.
        Drop a file, or paste raw JSON below.
      </p>

      {/* Mode toggle */}
      <div className="hi-mode-row">
        <button
          className={`retro-btn ${!pasteMode ? 'solid' : ''}`}
          onClick={() => setPasteMode(false)}
        >FILE</button>
        <button
          className={`retro-btn ${pasteMode ? 'solid' : ''}`}
          onClick={() => setPasteMode(true)}
        >PASTE JSON</button>
      </div>

      {/* Drop zone */}
      {!pasteMode && (
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
          <div className="fi-drop-icon">{loading ? '…' : dragging ? '▼' : '♡'}</div>
          <div className="fi-drop-text">
            {loading ? 'IMPORTING…' : dragging ? 'DROP FILE HERE' : 'DRAG & DROP .JSON FILE  //  CLICK TO BROWSE'}
          </div>
          <div className="fi-drop-sub muted-text">Apple Health export format</div>
        </div>
      )}

      {/* Paste zone */}
      {pasteMode && (
        <div className="hi-paste-wrap">
          <textarea
            className="retro-input hi-paste-area"
            placeholder={'{\n  "user_id": "...",\n  "metrics": [...]\n}'}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            spellCheck={false}
          />
          <button
            className="retro-btn solid"
            disabled={!pasteText.trim() || loading}
            onClick={() => submitJson(pasteText)}
          >
            {loading ? 'IMPORTING…' : 'IMPORT'}
          </button>
        </div>
      )}

      {error && <div className="fi-error muted-text">&gt; {error}</div>}

      {/* Aggregated summary */}
      {summary.length > 0 && (
        <div className="hi-summary-section">
          <div className="sp-chart-title muted-text">ALL-TIME SUMMARY</div>
          <div className="hi-summary-grid">
            {summary.map(row => (
              <div key={row.type} className="retro-card hi-summary-card">
                <div className="hi-summary-icon">{icon(row.type)}</div>
                <div className="hi-summary-count">{row.count}</div>
                <div className="hi-summary-label muted-text">{label(row.type)}</div>
                {row.avg_value != null && (
                  <div className="hi-summary-avg muted-text">
                    avg {parseFloat(row.avg_value).toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {imports.length > 0 && (
        <div className="sp-stat-row">
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">{imports.length}</div>
            <div className="sp-stat-lbl">IMPORTS</div>
          </div>
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">{totalMetrics.toLocaleString()}</div>
            <div className="sp-stat-lbl">METRICS</div>
          </div>
          <div className="retro-card sp-stat">
            <div className="sp-stat-val">{summary.length}</div>
            <div className="sp-stat-lbl">TYPES</div>
          </div>
        </div>
      )}

      {/* Import list */}
      <div className="hi-list">
        {imports.map(imp => (
          <div key={imp.import_id} className="retro-card hi-import-row">
            <div className="hi-import-main">
              <div className="hi-import-meta">
                <span className="hi-import-ts">{fmtTime(imp.sync_timestamp || imp.imported_at)}</span>
                <span className="muted-text hi-import-count">{imp.metric_count} metrics</span>
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
                {detail?.summary && (
                  <div className="hi-detail-summary">
                    {Object.entries(detail.summary).map(([type, count]) => (
                      <span key={type} className="hi-detail-chip muted-text">
                        {icon(type)} {label(type)}: {count}
                      </span>
                    ))}
                  </div>
                )}
                {detail?.metrics?.slice(0, 12).map((m, i) => (
                  <div key={i} className="hi-metric-row muted-text">
                    <span className="hi-metric-type">{label(m.type)}</span>
                    <span className="hi-metric-val">
                      {m.value_num != null ? `${m.value_num} ${m.unit || ''}` : m.value_cat}
                    </span>
                    <span className="hi-metric-time">{fmtTime(m.start_time)}</span>
                    {m.source_device && <span className="hi-metric-dev">{m.source_device}</span>}
                  </div>
                ))}
                {detail?.metrics?.length > 12 && (
                  <div className="muted-text" style={{ fontSize: '0.7rem', marginTop: '0.4rem' }}>
                    …and {detail.metrics.length - 12} more
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {imports.length === 0 && !loading && (
          <div className="sp-empty muted-text">&gt; No health data imported yet.</div>
        )}
      </div>
    </div>
  )
}
