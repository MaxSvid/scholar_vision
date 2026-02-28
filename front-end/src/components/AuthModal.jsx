import { useState, useEffect } from 'react'
import './AuthModal.css'

const FIELDS_OF_STUDY = [
  'Computer Science', 'Medicine', 'Engineering', 'Law', 'Mathematics',
  'Physics', 'Biology', 'Chemistry', 'Economics', 'Psychology',
  'Architecture', 'Philosophy', 'History', 'Linguistics', 'Business',
  'Art & Design', 'Education', 'Other',
]

const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+', 'Postgraduate', 'PhD']

/* ─── Step indicators ─── */
const STEPS = ['IDENTITY', 'ACADEMICS', 'GOALS']

export default function AuthModal({ mode, onClose, onLogin }) {
  const [view, setView] = useState(mode) // 'login' | 'register'
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  // login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPwd,   setLoginPwd]   = useState('')

  // register fields
  const [reg, setReg] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPwd: '',
    age: '', fieldOfStudy: '', yearOfStudy: '', university: '',
    studyGoal: '', weeklyHours: '', targetGPA: '',
  })

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const updateReg = (key, val) => {
    setReg(prev => ({ ...prev, [key]: val }))
    setError('')
  }

  /* ─── Validation per step ─── */
  const validateStep = () => {
    if (step === 0) {
      if (!reg.firstName || !reg.lastName) return 'First and last name are required.'
      if (!reg.email || !reg.email.includes('@')) return 'Valid email is required.'
      if (reg.password.length < 8) return 'Password must be at least 8 characters.'
      if (reg.password !== reg.confirmPwd) return 'Passwords do not match.'
      if (!reg.age || reg.age < 13 || reg.age > 99) return 'Please enter a valid age.'
    }
    if (step === 1) {
      if (!reg.fieldOfStudy) return 'Please select your field of study.'
      if (!reg.yearOfStudy) return 'Please select your year of study.'
    }
    if (step === 2) {
      if (!reg.weeklyHours || reg.weeklyHours < 0) return 'Enter your target weekly study hours.'
    }
    return ''
  }

  const nextStep = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  const handleRegisterSubmit = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    // Persist to localStorage (frontend-only)
    localStorage.setItem('sv-user', JSON.stringify({ ...reg, password: undefined }))
    localStorage.setItem('sv-auth', '1')
    onLogin({ ...reg })
    onClose()
  }

  const handleLoginSubmit = e => {
    e.preventDefault()
    if (!loginEmail || !loginPwd) { setError('Both fields are required.'); return }
    // Frontend-only mock auth
    const stored = localStorage.getItem('sv-user')
    if (!stored) { setError('No account found. Please register first.'); return }
    localStorage.setItem('sv-auth', '1')
    onLogin(JSON.parse(stored))
    onClose()
  }

  /* ─── RENDER ─── */
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box retro-border">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span className="muted-text">[SV] //</span>{' '}
            {view === 'login' ? 'RESTORE SESSION' : `REGISTER — STEP ${step + 1}/${STEPS.length}`}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab toggle */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${view === 'login' ? 'active' : ''}`}
            onClick={() => { setView('login'); setError('') }}
          >LOGIN</button>
          <button
            className={`modal-tab ${view === 'register' ? 'active' : ''}`}
            onClick={() => { setView('register'); setStep(0); setError('') }}
          >REGISTER</button>
        </div>

        {/* ══ LOGIN FORM ══ */}
        {view === 'login' && (
          <form className="modal-form" onSubmit={handleLoginSubmit}>
            <label className="field-label">EMAIL</label>
            <input
              className="retro-input"
              type="email"
              placeholder="user@university.edu"
              value={loginEmail}
              onChange={e => { setLoginEmail(e.target.value); setError('') }}
            />
            <label className="field-label">PASSWORD</label>
            <input
              className="retro-input"
              type="password"
              placeholder="••••••••"
              value={loginPwd}
              onChange={e => { setLoginPwd(e.target.value); setError('') }}
            />
            {error && <p className="modal-error">&gt; ERROR: {error}</p>}
            <button type="submit" className="retro-btn solid modal-submit">
              &gt; AUTHENTICATE
            </button>
            <p className="modal-switch muted-text">
              No account?{' '}
              <button type="button" className="link-btn" onClick={() => { setView('register'); setStep(0); setError('') }}>
                Register here
              </button>
            </p>
          </form>
        )}

        {/* ══ REGISTER MULTI-STEP ══ */}
        {view === 'register' && (
          <div className="modal-form">
            {/* Step progress */}
            <div className="step-bar">
              {STEPS.map((s, i) => (
                <div key={s} className={`step-item ${i <= step ? 'done' : ''} ${i === step ? 'current' : ''}`}>
                  <div className="step-dot">{i < step ? '✓' : i + 1}</div>
                  <div className="step-label">{s}</div>
                </div>
              ))}
            </div>

            {/* ── Step 0: Identity ── */}
            {step === 0 && (
              <>
                <div className="field-row">
                  <div className="field-col">
                    <label className="field-label">FIRST NAME</label>
                    <input className="retro-input" placeholder="Ada" value={reg.firstName}
                      onChange={e => updateReg('firstName', e.target.value)} />
                  </div>
                  <div className="field-col">
                    <label className="field-label">LAST NAME</label>
                    <input className="retro-input" placeholder="Lovelace" value={reg.lastName}
                      onChange={e => updateReg('lastName', e.target.value)} />
                  </div>
                </div>
                <label className="field-label">AGE</label>
                <input className="retro-input" type="number" min="13" max="99"
                  placeholder="19" value={reg.age}
                  onChange={e => updateReg('age', e.target.value)} />
                <label className="field-label">EMAIL</label>
                <input className="retro-input" type="email" placeholder="user@uni.edu"
                  value={reg.email} onChange={e => updateReg('email', e.target.value)} />
                <label className="field-label">PASSWORD</label>
                <input className="retro-input" type="password" placeholder="min. 8 characters"
                  value={reg.password} onChange={e => updateReg('password', e.target.value)} />
                <label className="field-label">CONFIRM PASSWORD</label>
                <input className="retro-input" type="password" placeholder="repeat password"
                  value={reg.confirmPwd} onChange={e => updateReg('confirmPwd', e.target.value)} />
              </>
            )}

            {/* ── Step 1: Academics ── */}
            {step === 1 && (
              <>
                <label className="field-label">UNIVERSITY / INSTITUTION</label>
                <input className="retro-input" placeholder="MIT, Oxford, etc. (optional)"
                  value={reg.university} onChange={e => updateReg('university', e.target.value)} />
                <label className="field-label">FIELD OF STUDY</label>
                <select className="retro-input" value={reg.fieldOfStudy}
                  onChange={e => updateReg('fieldOfStudy', e.target.value)}>
                  <option value="">-- SELECT --</option>
                  {FIELDS_OF_STUDY.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="field-label">YEAR OF STUDY</label>
                <select className="retro-input" value={reg.yearOfStudy}
                  onChange={e => updateReg('yearOfStudy', e.target.value)}>
                  <option value="">-- SELECT --</option>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}

            {/* ── Step 2: Goals ── */}
            {step === 2 && (
              <>
                <label className="field-label">WHAT IS YOUR MAIN ACADEMIC GOAL?</label>
                <textarea className="retro-input" rows={3}
                  placeholder="e.g. Graduate with honours, secure research position..."
                  value={reg.studyGoal} onChange={e => updateReg('studyGoal', e.target.value)} />
                <label className="field-label">TARGET WEEKLY STUDY HOURS</label>
                <input className="retro-input" type="number" min="0" max="168"
                  placeholder="e.g. 40" value={reg.weeklyHours}
                  onChange={e => updateReg('weeklyHours', e.target.value)} />
                <label className="field-label">TARGET GPA / GRADE (optional)</label>
                <input className="retro-input" placeholder="e.g. 3.9 / First Class"
                  value={reg.targetGPA} onChange={e => updateReg('targetGPA', e.target.value)} />
              </>
            )}

            {error && <p className="modal-error">&gt; ERROR: {error}</p>}

            <div className="modal-nav-row">
              {step > 0 && (
                <button className="retro-btn" onClick={() => { setStep(s => s - 1); setError('') }}>
                  &lt; BACK
                </button>
              )}
              {step < STEPS.length - 1
                ? <button className="retro-btn solid" onClick={nextStep}>NEXT &gt;</button>
                : <button className="retro-btn solid" onClick={handleRegisterSubmit}>
                    &gt; INITIALISE PROFILE
                  </button>
              }
            </div>

            <p className="modal-switch muted-text">
              Already have an account?{' '}
              <button type="button" className="link-btn"
                onClick={() => { setView('login'); setError('') }}>
                Login here
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
