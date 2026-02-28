import { useState, useEffect, useRef } from 'react'
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

export default function PredictionPanel() {
  const [inputs, setInputs] = useState({
    studyHours:    5,
    attentionSpan: 40,
    focusRatio:    70,
    sleepHours:    7,
    breakFreq:     2,
  })
  const [mode,    setMode]    = useState('strict')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const debounceRef = useRef(null)

  // Auto-fetch with 400ms debounce whenever inputs or mode change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(fetchPrediction, 400)
    return () => clearTimeout(debounceRef.current)
  }, [inputs, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPrediction() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/predictions/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...inputs, analysis_mode: mode }),
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

  const up = (key, val) => setInputs(p => ({ ...p, [key]: parseFloat(val) }))

  const gradeColor = result ? (GRADE_COLOR[result.predicted_grade] ?? '#ccaa33') : 'var(--fg)'
  const ringDash   = result ? `${result.predicted_score * 3.14} 314` : '0 314'

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
          <div className="sp-chart-title muted-text">INPUT PARAMETERS</div>
          {SLIDERS.map(s => (
            <div key={s.key} className="pred-slider-row">
              <div className="pred-slider-header">
                <span className="field-label">{s.label}</span>
                <span className="pred-val glow-text">{inputs[s.key]}{s.unit}</span>
              </div>
              <input
                type="range" className="pred-slider"
                min={s.min} max={s.max} step={s.step}
                value={inputs[s.key]}
                onChange={e => up(s.key, e.target.value)}
              />
              <div className="pred-slider-range muted-text">
                <span>{s.min}{s.unit}</span>
                <span>{s.max}{s.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Result ── */}
        <div className="pred-result-col">
          {/* Score ring */}
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

          {/* Advice block */}
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
    </div>
  )
}
