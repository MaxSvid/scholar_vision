import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import './SubPanel.css'
import './PredictionPanel.css'

const MODES = [
  {
    id:    'strict',
    label: 'CLEAR-CUT RULES',
    desc:  'Decision Tree — IF/THEN rule path explaining your predicted grade.',
  },
  {
    id:    'peer',
    label: 'PEER COMPARISON',
    desc:  'KNN — How you compare to the 5 most similar students in the cohort.',
  },
  {
    id:    'deep',
    label: 'DEEP CONTEXT',
    desc:  'Random Forest + SHAP — Exact contribution of each factor to your score.',
  },
]

const SLIDERS = [
  { key: 'studyHours',    label: 'DAILY STUDY HOURS',      min: 0,  max: 16,  step: 0.5, unit: 'h'   },
  { key: 'attentionSpan', label: 'AVG ATTENTION SPAN',     min: 5,  max: 120, step: 5,   unit: 'min' },
  { key: 'focusRatio',    label: 'PRODUCTIVE APP RATIO',   min: 0,  max: 100, step: 5,   unit: '%'   },
  { key: 'sleepHours',    label: 'HOURS OF SLEEP / NIGHT', min: 3,  max: 12,  step: 0.5, unit: 'h'   },
  { key: 'breakFreq',     label: 'BREAKS PER STUDY DAY',   min: 0,  max: 10,  step: 1,   unit: ''    },
]

const GRADE_COLOR = {
  'A+': 'var(--fg)', 'A': 'var(--fg)',
  'B':  '#d4af37',
  'C':  '#ffb000',
  'D':  '#cc7733', 'F': '#cc3333',
}

const DEFAULTS = {
  studyHours: 5, attentionSpan: 40, focusRatio: 70, sleepHours: 7, breakFreq: 2,
}

export default function PredictionPanel() {
  const { apiFetch } = useAuth()

  const [currentSimulatedData, setCurrentSimulatedData] = useState({ ...DEFAULTS })
  const [realBaselineData,  setRealBaselineData]  = useState(null)
  const [dataSources,       setDataSources]        = useState(null)
  const [baselineLoading,   setBaselineLoading]    = useState(true)

  const [mode,    setMode]    = useState('strict')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const debounceRef = useRef(null)

  const fetchBaseline = useCallback(() => {
    apiFetch('/api/profile/baseline')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        setRealBaselineData(data.baseline)
        setDataSources(data.sources)
        setCurrentSimulatedData(prev => ({
          studyHours:    data.baseline.studyHours    ?? prev.studyHours,
          attentionSpan: data.baseline.attentionSpan ?? prev.attentionSpan,
          focusRatio:    data.baseline.focusRatio    ?? prev.focusRatio,
          sleepHours:    data.baseline.sleepHours    ?? prev.sleepHours,
          breakFreq:     data.baseline.breakFreq     ?? prev.breakFreq,
        }))
      })
      .catch(() => {})
      .finally(() => setBaselineLoading(false))
  }, [apiFetch])

  useEffect(() => { fetchBaseline() }, [fetchBaseline])

  useEffect(() => {
    window.addEventListener('sv:data-imported', fetchBaseline)
    return () => window.removeEventListener('sv:data-imported', fetchBaseline)
  }, [fetchBaseline])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchPrediction, 400)
    return () => clearTimeout(debounceRef.current)
  }, [currentSimulatedData, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPrediction() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/predictions/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...currentSimulatedData, analysis_mode: mode }),
      })
      if (res.status === 503) throw new Error('ML models are warming up — please wait a moment.')
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `Server error (${res.status})`)
      }
      setResult(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const up = (key, val) =>
    setCurrentSimulatedData(p => ({ ...p, [key]: parseFloat(val) }))

  const resetToBaseline = () => {
    if (!realBaselineData) return
    setCurrentSimulatedData({
      studyHours:    realBaselineData.studyHours    ?? DEFAULTS.studyHours,
      attentionSpan: realBaselineData.attentionSpan ?? DEFAULTS.attentionSpan,
      focusRatio:    realBaselineData.focusRatio    ?? DEFAULTS.focusRatio,
      sleepHours:    realBaselineData.sleepHours    ?? DEFAULTS.sleepHours,
      breakFreq:     realBaselineData.breakFreq     ?? DEFAULTS.breakFreq,
    })
  }

  const gradeColor = result ? (GRADE_COLOR[result.predicted_grade] ?? '#ccaa33') : 'var(--fg)'
  const ringDash   = result ? `${result.predicted_score * 3.14} 314` : '0 314'

  const hasAnyBaseline = realBaselineData &&
    Object.values(realBaselineData).some(v => v != null)

  return (
    <div className="subpanel">
      <div className="panel-title">&gt; ACADEMIC PREDICTION ENGINE</div>

      {/* Mode selector */}
      <div className="pred-mode-row">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`retro-btn pred-mode-btn ${mode === m.id ? 'solid' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted-text pred-mode-desc">
        {MODES.find(m => m.id === mode)?.desc}
      </p>

      <div className="pred-layout">
        {/* ── Sliders ── */}
        <div className="retro-card pred-inputs">
          <div className="pred-inputs-header">
            <div className="sp-chart-title muted-text">INPUT PARAMETERS</div>
            {!baselineLoading && (
              <button
                className="retro-btn pred-reset-btn"
                onClick={resetToBaseline}
                title={hasAnyBaseline
                  ? 'Reset sliders to your real measured data'
                  : 'Reset sliders to default values'}
              >
                ↺ RESET TO BASELINE
              </button>
            )}
          </div>

          {SLIDERS.map(s => {
            const realVal   = realBaselineData?.[s.key]
            const shapEntry = result?.shap_values?.find(sv => sv.feature_key === s.key)
            const impact    = shapEntry?.impact_score
            return (
              <div key={s.key} className="pred-slider-row">
                <div className="pred-slider-header">
                  <span className="field-label">{s.label}</span>
                  <div className="pred-val-group">
                    {realVal != null && (
                      <span className="pred-baseline-val muted-text">
                        Real: {realVal}{s.unit}
                      </span>
                    )}
                    <span className="pred-val glow-text">
                      {currentSimulatedData[s.key]}{s.unit}
                    </span>
                  </div>
                </div>
                <input
                  type="range" className="pred-slider"
                  min={s.min} max={s.max} step={s.step}
                  value={currentSimulatedData[s.key]}
                  onChange={e => up(s.key, e.target.value)}
                />
                <div className="pred-slider-range muted-text">
                  <span>{s.min}{s.unit}</span>
                  {impact != null && (
                    <span className={impact >= 0 ? 'pred-impact-pos' : 'pred-impact-neg'}>
                      {impact >= 0 ? '+' : ''}{impact.toFixed(1)} pts
                    </span>
                  )}
                  <span>{s.max}{s.unit}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Result ── */}
        <div className="pred-result-col">
          <div className="retro-card pred-score-card">
            <div className="pred-score-label muted-text">PREDICTED OUTCOME SCORE</div>

            <div className="pred-score-ring">
              <svg viewBox="0 0 120 120" className="pred-ring-svg">
                <circle cx="60" cy="60" r="50" className="ring-track" />
                <circle
                  cx="60" cy="60" r="50"
                  className="ring-fill"
                  style={{ stroke: gradeColor }}
                  strokeDasharray={ringDash}
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="pred-ring-text">
                {loading ? (
                  <div className="pred-computing muted-text">…</div>
                ) : result ? (
                  <>
                    <div className="pred-pct glow-text">{result.predicted_score}</div>
                    <div className="muted-text" style={{ fontSize: '0.65rem' }}>SCORE</div>
                  </>
                ) : (
                  <div className="muted-text" style={{ fontSize: '0.65rem' }}>—</div>
                )}
              </div>
            </div>

            {result && !loading && (
              <>
                <div className="pred-grade" style={{ color: gradeColor }}>
                  {result.predicted_grade}
                </div>
                <div className="pred-mode-badge muted-text">
                  via {MODES.find(m => m.id === result.analysis_mode)?.label}
                </div>
              </>
            )}
          </div>

          <div className="retro-card pred-tips">
            <div className="sp-chart-title muted-text">
              {loading ? 'COMPUTING…' : 'ANALYSIS'}
            </div>

            {error && (
              <div className="pred-tip" style={{ color: 'var(--fg-dim)' }}>
                &gt; {error}
              </div>
            )}

            {!error && loading && (
              <div className="pred-tip muted-text pred-loading">
                Running {MODES.find(m => m.id === mode)?.label} model…
              </div>
            )}

            {!error && !loading && result && (
              <pre className="pred-advice">{result.text_advice}</pre>
            )}

            {!error && !loading && !result && (
              <div className="pred-tip muted-text">
                &gt; Adjust sliders to generate your prediction.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Data Sources Active ── */}
      <div className="retro-card pred-sources">
        <div className="sp-chart-title muted-text">DATA SOURCES ACTIVE</div>
        <div className="pred-source-list">

          <div className="pred-source-row">
            <span className="pred-source-on">✓</span>
            <span className="pred-source-name">COHORT DATABASE</span>
            <span className="muted-text pred-source-detail">
              feeds all 3 ML models · peer comparison · benchmarking
            </span>
            <span className="pred-source-badge muted-text">1 000 STUDENTS</span>
          </div>

          <div className="pred-source-row">
            <span className={dataSources?.health ? 'pred-source-on' : 'pred-source-off'}>
              {dataSources?.health ? '✓' : '○'}
            </span>
            <span className={`pred-source-name${dataSources?.health ? '' : ' pred-source-inactive'}`}>
              APPLE HEALTH METRICS
            </span>
            <span className="muted-text pred-source-detail">
              {dataSources?.health
                ? 'feeds sleep baseline · heart rate · activity data'
                : 'import Health JSON to unlock sleep baseline'}
            </span>
            {dataSources?.healthCount > 0 && (
              <span className="pred-source-badge muted-text">
                {dataSources.healthCount} METRICS
              </span>
            )}
          </div>

          <div className="pred-source-row">
            <span className={dataSources?.grades ? 'pred-source-on' : 'pred-source-off'}>
              {dataSources?.grades ? '✓' : '○'}
            </span>
            <span className={`pred-source-name${dataSources?.grades ? '' : ' pred-source-inactive'}`}>
              UPLOADED GRADE SHEETS
            </span>
            <span className="muted-text pred-source-detail">
              {dataSources?.grades
                ? 'grade history available for analysis'
                : 'upload academic files to unlock grade history'}
            </span>
            {dataSources?.gradeCount > 0 && (
              <span className="pred-source-badge muted-text">
                {dataSources.gradeCount} GRADES
              </span>
            )}
          </div>

          <div className="pred-source-row">
            <span className={dataSources?.appUsage ? 'pred-source-on' : 'pred-source-off'}>
              {dataSources?.appUsage ? '✓' : '○'}
            </span>
            <span className={`pred-source-name${dataSources?.appUsage ? '' : ' pred-source-inactive'}`}>
              APP USAGE LOGS
            </span>
            <span className="muted-text pred-source-detail">
              {dataSources?.appUsage
                ? 'feeds focus ratio · productive vs. distracting app split'
                : 'import app usage JSON to unlock focus baseline'}
            </span>
            {dataSources?.appUsageCount > 0 && (
              <span className="pred-source-badge muted-text">
                {dataSources.appUsageCount} IMPORT{dataSources.appUsageCount !== 1 ? 'S' : ''}
              </span>
            )}
          </div>

          <div className="pred-source-row">
            <span className={dataSources?.studySessions ? 'pred-source-on' : 'pred-source-off'}>
              {dataSources?.studySessions ? '✓' : '○'}
            </span>
            <span className={`pred-source-name${dataSources?.studySessions ? '' : ' pred-source-inactive'}`}>
              STUDY SESSION LOGS
            </span>
            <span className="muted-text pred-source-detail">
              {dataSources?.studySessions
                ? 'feeds study hours · attention span · break frequency'
                : 'import study sessions JSON to unlock study baselines'}
            </span>
            {dataSources?.studySessionCount > 0 && (
              <span className="pred-source-badge muted-text">
                {dataSources.studySessionCount} IMPORT{dataSources.studySessionCount !== 1 ? 'S' : ''}
              </span>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
