import { useState, useEffect } from 'react'
import ThemeSwitcher from './ThemeSwitcher'
import AuthModal from './AuthModal'
import './HeroPage.css'

const TAGLINES = [
  'PREDICT YOUR ACADEMIC FUTURE.',
  'TRACK. ANALYSE. EXCEL.',
  'DATA-DRIVEN STUDY HABITS.',
  'UNLOCK YOUR PEAK PERFORMANCE.',
]

export default function HeroPage({ onLogin }) {
  const [tagline, setTagline] = useState('')
  const [tagIdx, setTagIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')

  // Typewriter effect
  useEffect(() => {
    const target = TAGLINES[tagIdx]
    if (charIdx < target.length) {
      const t = setTimeout(() => {
        setTagline(target.slice(0, charIdx + 1))
        setCharIdx(c => c + 1)
      }, 55)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        setCharIdx(0)
        setTagline('')
        setTagIdx(i => (i + 1) % TAGLINES.length)
      }, 2600)
      return () => clearTimeout(t)
    }
  }, [charIdx, tagIdx])

  const openAuth = (mode) => {
    setAuthMode(mode)
    setShowAuth(true)
  }

  return (
    <div className="hero-root">
      {/* NAV */}
      <nav className="hero-nav">
        <div className="hero-nav-logo">
          <span className="logo-bracket">[</span>
          SV
          <span className="logo-bracket">]</span>
        </div>
        <div className="hero-nav-right">
          <ThemeSwitcher />
          <button className="retro-btn" onClick={() => openAuth('login')}>
            LOGIN
          </button>
          <button className="retro-btn solid" onClick={() => openAuth('register')}>
            REGISTER
          </button>
        </div>
      </nav>

      {/* HERO CONTENT */}
      <main className="hero-main">
        {/* ASCII decoration */}
        <pre className="hero-ascii" aria-hidden="true">{`
  ███████╗ ██████╗██╗  ██╗ ██████╗ ██╗      █████╗ ██████╗
  ██╔════╝██╔════╝██║  ██║██╔═══██╗██║     ██╔══██╗██╔══██╗
  ███████╗██║     ███████║██║   ██║██║     ███████║██████╔╝
  ╚════██║██║     ██╔══██║██║   ██║██║     ██╔══██║██╔══██╗
  ███████║╚██████╗██║  ██║╚██████╔╝███████╗██║  ██║██║  ██║
  ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
         V I S I O N  //  A C A D E M I C  I N T E L
        `}</pre>

        <div className="hero-tagline-row">
          <span className="hero-prompt">&gt;&nbsp;</span>
          <span className="hero-tagline">{tagline}</span>
          <span className="hero-cursor blink">█</span>
        </div>

        <p className="hero-sub">
          ScholarVision monitors your study patterns, attention span, and app usage
          to predict your academic trajectory and help you course-correct — before exams do.
        </p>

        <div className="hero-cta-row">
          <button className="retro-btn solid hero-cta" onClick={() => openAuth('register')}>
            &gt; BEGIN_SESSION
          </button>
          <button className="retro-btn hero-cta" onClick={() => openAuth('login')}>
            &gt; RESTORE_SESSION
          </button>
        </div>

        {/* Feature grid */}
        <div className="hero-features">
          {[
            { icon: '◈', title: 'STUDY TRACKER',    desc: 'Log and monitor daily study hours across all subjects.' },
            { icon: '◉', title: 'ATTENTION SPAN',   desc: 'Measure focus sessions and distraction patterns in real time.' },
            { icon: '◐', title: 'APP ANALYTICS',    desc: 'Identify which apps are eating into your study time.' },
            { icon: '◇', title: 'ML PREDICTIONS',   desc: 'AI model forecasts your grade trajectory from behavioural data.' },
            { icon: '▦', title: 'FILE IMPORT',      desc: 'Upload grade sheets, feedback reports, and academic records.' },
            { icon: '◎', title: 'PERFORMANCE MAP',  desc: 'Visual timeline of your academic arc across semesters.' },
          ].map(f => (
            <div key={f.title} className="retro-card hero-feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc muted-text">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="hero-footer">
        <span className="muted-text">SCHOLARVISION v0.1 // FOR HIGH ACHIEVERS ONLY</span>
        <span className="blink muted-text">■</span>
      </footer>

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onLogin={onLogin}
        />
      )}
    </div>
  )
}
