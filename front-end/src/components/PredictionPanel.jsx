import { useState } from 'react'
import './SubPanel.css'
import './PredictionPanel.css'

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function computePrediction(inputs) {
  const {
    studyHours, attentionSpan, focusRatio,
    currentGrade, sleepHours, breakFreq,
  } = inputs

  // Weighted scoring model (frontend mock of ML)
  let score = 0
  score += clamp((studyHours / 8) * 30, 0, 30)       // study hrs out of 30
  score += clamp((attentionSpan / 60) * 20, 0, 20)    // attention span out of 20
  score += clamp((focusRatio / 100) * 20, 0, 20)      // focus ratio out of 20
  score += clamp((currentGrade / 100) * 15, 0, 15)    // current grade out of 15
  score += clamp(((sleepHours - 4) / 4) * 10, 0, 10)  // sleep out of 10
  score += clamp((breakFreq / 4) * 5, 0, 5)           // break frequency out of 5

  const pct = Math.round(clamp(score, 0, 100))
  const grade =
    pct >= 90 ? 'A+' :
    pct >= 80 ? 'A'  :
    pct >= 70 ? 'B'  :
    pct >= 60 ? 'C'  :
    pct >= 50 ? 'D'  : 'F'

  const trend =
    pct >= 80 ? '↑ ON TRACK — EXCELLENT TRAJECTORY' :
    pct >= 65 ? '→ STABLE — ROOM TO IMPROVE'         :
                '↓ AT RISK — INTERVENTION REQUIRED'

  const tips = []
  if (studyHours < 4)    tips.push('Increase daily study hours (target: 4–6h/day).')
  if (attentionSpan < 30) tips.push('Work on sustained focus — try Pomodoro 45/15 splits.')
  if (focusRatio < 60)   tips.push('Reduce distracting app usage by at least 30%.')
  if (sleepHours < 7)    tips.push('Aim for 7–9 hours of sleep for optimal memory consolidation.')
  if (breakFreq < 2)     tips.push('Take regular breaks — fatigue degrades learning efficiency.')

  return { pct, grade, trend, tips }
}

export default function PredictionPanel({ user }) {
  const [inputs, setInputs] = useState({
    studyHours:   5,
    attentionSpan: 40,
    focusRatio:   70,
    currentGrade: 75,
    sleepHours:   7,
    breakFreq:    2,
  })
  const [result, setResult] = useState(null)
  const [ran, setRan] = useState(false)

  const up = (key, val) => setInputs(p => ({ ...p, [key]: parseFloat(val) }))

  const run = () => {
    setResult(computePrediction(inputs))
    setRan(true)
  }

  const sliders = [
    { key: 'studyHours',    label: 'DAILY STUDY HOURS',     min: 0, max: 16, step: 0.5, unit: 'h' },
    { key: 'attentionSpan', label: 'AVG ATTENTION SPAN',    min: 5, max: 120, step: 5,  unit: 'min' },
    { key: 'focusRatio',    label: 'PRODUCTIVE APP RATIO',  min: 0, max: 100, step: 5,  unit: '%' },
    { key: 'currentGrade',  label: 'CURRENT GRADE AVERAGE', min: 0, max: 100, step: 1,  unit: '%' },
    { key: 'sleepHours',    label: 'HOURS OF SLEEP / NIGHT',min: 3, max: 12,  step: 0.5, unit: 'h' },
    { key: 'breakFreq',     label: 'BREAKS PER STUDY DAY',  min: 0, max: 10,  step: 1,  unit: '' },
  ]

  return (
    <div className="subpanel">
      <div className="panel-title">&gt; ACADEMIC PREDICTION ENGINE</div>
      <p className="muted-text" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
        Adjust the sliders to reflect your current habits. The model will estimate your predicted academic outcome.
      </p>

      <div className="pred-layout">
        {/* Inputs */}
        <div className="retro-card pred-inputs">
          <div className="sp-chart-title muted-text">INPUT PARAMETERS</div>
          {sliders.map(s => (
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
                <span>{s.min}{s.unit}</span><span>{s.max}{s.unit}</span>
              </div>
            </div>
          ))}
          <button className="retro-btn solid" style={{ marginTop: '0.5rem' }} onClick={run}>
            &gt; RUN PREDICTION MODEL
          </button>
        </div>

        {/* Result */}
        {ran && result && (
          <div className="pred-result-col">
            <div className="retro-card pred-score-card">
              <div className="pred-score-label muted-text">PREDICTED OUTCOME SCORE</div>
              <div className="pred-score-ring">
                <svg viewBox="0 0 120 120" className="pred-ring-svg">
                  <circle cx="60" cy="60" r="50" className="ring-track" />
                  <circle
                    cx="60" cy="60" r="50"
                    className="ring-fill"
                    strokeDasharray={`${result.pct * 3.14} 314`}
                    strokeDashoffset="0"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="pred-ring-text">
                  <div className="pred-pct glow-text">{result.pct}</div>
                  <div className="muted-text" style={{ fontSize: '0.65rem' }}>SCORE</div>
                </div>
              </div>
              <div className="pred-grade glow-text">{result.grade}</div>
              <div className="pred-trend muted-text">{result.trend}</div>
            </div>

            {result.tips.length > 0 && (
              <div className="retro-card pred-tips">
                <div className="sp-chart-title muted-text">RECOMMENDATIONS</div>
                {result.tips.map((t, i) => (
                  <div key={i} className="pred-tip">
                    <span className="muted-text">[{String(i + 1).padStart(2, '0')}]</span> {t}
                  </div>
                ))}
              </div>
            )}

            {result.tips.length === 0 && (
              <div className="retro-card pred-tips">
                <div className="sp-chart-title muted-text">STATUS</div>
                <div className="pred-tip glow-text">&gt; OPTIMAL PARAMETERS DETECTED. MAINTAIN CURRENT TRAJECTORY.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
