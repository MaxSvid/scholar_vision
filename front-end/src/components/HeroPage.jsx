import { useState } from 'react'
import ThemeSwitcher from './ThemeSwitcher'
import AuthModal from './AuthModal'
import HeroGraph3D from './HeroGraph3D'
import './HeroPage.css'

export default function HeroPage({ onLogin }) {
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  const openAuth = (mode) => { setAuthMode(mode); setShowAuth(true) }

  return (
    <div className="hero-root">
      {/* NAV */}
      <nav className="hero-nav">
        <div className="hero-nav-logo">SV</div>
        <div className="hero-nav-right">
          <ThemeSwitcher />
          <button className="retro-btn" onClick={() => openAuth('login')}>Login</button>
          <button className="retro-btn solid" onClick={() => openAuth('register')}>Register</button>
        </div>
      </nav>

      {/* SPLIT HERO */}
      <section className="hero-split">
        {/* ── Left: copy ── */}
        <div className="hero-copy">
          <div className="hero-eyebrow muted-text">[ ACADEMIC PERFORMANCE PREDICTOR ]</div>

          <h1 className="hero-title">Scholar<br />Vision</h1>

          <p className="hero-sub">
            Monitor your study patterns, attention span, and app usage to predict
            your academic trajectory — and course-correct before exams do.
          </p>

          {/* Legend */}
          <div className="hero-legend">
            <span><span className="hl-dot" style={{ background: '#c8ff00' }} />Outcome</span>
            <span><span className="hl-dot" style={{ background: '#d4af37' }} />Category</span>
            <span><span className="hl-dot" style={{ background: '#44cc66' }} />Productive</span>
            <span><span className="hl-dot" style={{ background: '#cc3333' }} />Distracting</span>
            <span><span className="hl-dot" style={{ background: '#7f7fff' }} />Academic</span>
          </div>

          <div className="hero-cta-row">
            <button className="retro-btn solid hero-cta" onClick={() => openAuth('register')}>
              &gt; Get Started
            </button>
            <button className="retro-btn hero-cta" onClick={() => openAuth('login')}>
              Sign In
            </button>
          </div>
        </div>

        {/* ── Right: 3D graph ── */}
        <div className="hero-graph-pane">
          <HeroGraph3D />
        </div>
      </section>

      {/* FEATURES */}
      <section className="hero-features-section">
        <div className="hero-features">
          {[
            { icon: '◈', title: 'Study Tracker',   desc: 'Log and monitor daily study hours across all subjects.' },
            { icon: '◉', title: 'Attention Span',  desc: 'Measure focus sessions and distraction patterns in real time.' },
            { icon: '◐', title: 'App Analytics',   desc: 'Identify which apps are eating into your study time.' },
            { icon: '◇', title: 'ML Predictions',  desc: 'AI model forecasts your grade trajectory from behavioural data.' },
            { icon: '▦', title: 'File Import',     desc: 'Upload grade sheets, feedback reports, and academic records.' },
            { icon: '◎', title: 'Performance Map', desc: 'Visual timeline of your academic arc across semesters.' },
          ].map(f => (
            <div key={f.title} className="retro-card hero-feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc muted-text">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="hero-footer">
        <span className="muted-text">ScholarVision v0.1</span>
      </footer>

      {showAuth && (
        <AuthModal mode={authMode} onClose={() => setShowAuth(false)} onLogin={onLogin} />
      )}
    </div>
  )
}
