import { useState } from 'react'
import ThemeSwitcher from './ThemeSwitcher'
import StudyTracker from './StudyTracker'
import AppUsage from './AppUsage'
import AttentionSpan from './AttentionSpan'
import PredictionPanel from './PredictionPanel'
import FileImport from './FileImport'
import './Dashboard.css'

const TABS = [
  { id: 'overview',    label: 'OVERVIEW',    icon: '◎' },
  { id: 'study',       label: 'STUDY LOG',   icon: '◈' },
  { id: 'apps',        label: 'APP USAGE',   icon: '◐' },
  { id: 'attention',   label: 'ATTENTION',   icon: '◉' },
  { id: 'prediction',  label: 'PREDICTION',  icon: '◇' },
  { id: 'files',       label: 'FILES',       icon: '▦' },
]

export default function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : 'SCHOLAR'

  return (
    <div className="dash-root">
      {/* TOP BAR */}
      <header className="dash-header">
        <div className="dash-logo">
          <span className="muted-text">[SV]</span> SCHOLARVISION
        </div>
        <div className="dash-header-right">
          <ThemeSwitcher />
          <div className="dash-user">
            <span className="muted-text">USER://</span>
            <span>{displayName.toUpperCase()}</span>
          </div>
          <button className="retro-btn" onClick={onLogout}>LOGOUT</button>
        </div>
      </header>

      <div className="dash-body">
        {/* SIDEBAR NAV */}
        <nav className="dash-sidebar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`dash-nav-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
          <div className="sidebar-spacer" />
          <div className="sidebar-meta muted-text">
            <div>{user?.fieldOfStudy || '—'}</div>
            <div>{user?.yearOfStudy || '—'}</div>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main className="dash-content">
          {tab === 'overview'   && <OverviewPanel user={user} setTab={setTab} />}
          {tab === 'study'      && <StudyTracker />}
          {tab === 'apps'       && <AppUsage />}
          {tab === 'attention'  && <AttentionSpan />}
          {tab === 'prediction' && <PredictionPanel user={user} />}
          {tab === 'files'      && <FileImport />}
        </main>
      </div>
    </div>
  )
}

/* ─── OVERVIEW PANEL ─── */
function OverviewPanel({ user, setTab }) {
  const cards = [
    {
      icon: '◈', label: 'STUDY HOURS TODAY', value: '—',
      sub: 'No sessions logged yet', tab: 'study',
    },
    {
      icon: '◉', label: 'AVG. ATTENTION SPAN', value: '—',
      sub: 'Start a focus session', tab: 'attention',
    },
    {
      icon: '◐', label: 'TOP APP TODAY', value: '—',
      sub: 'Log your app usage', tab: 'apps',
    },
    {
      icon: '◇', label: 'PREDICTED GRADE', value: '—',
      sub: 'Add data to unlock', tab: 'prediction',
    },
  ]

  return (
    <div className="overview-root">
      <div className="panel-title">
        <span className="muted-text">&gt;</span> SYSTEM OVERVIEW
        <span className="blink muted-text" style={{ marginLeft: '0.4rem' }}>█</span>
      </div>

      {user && (
        <div className="retro-card overview-profile">
          <div className="profile-row">
            <div>
              <div className="profile-name glow-text">
                {user.firstName} {user.lastName}
              </div>
              <div className="muted-text" style={{ fontSize: '0.78rem' }}>
                {user.fieldOfStudy} · {user.yearOfStudy}
                {user.university ? ` · ${user.university}` : ''}
              </div>
            </div>
            <div className="profile-goal">
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }} className="muted-text">
                WEEKLY TARGET
              </div>
              <div style={{ fontSize: '1.3rem' }}>
                {user.weeklyHours || '—'}h
              </div>
            </div>
          </div>
          {user.studyGoal && (
            <div className="profile-goaltext muted-text">
              <span style={{ color: 'var(--fg-dim)' }}>&gt; GOAL:</span> {user.studyGoal}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="overview-stats">
        {cards.map(c => (
          <button
            key={c.label}
            className="retro-card stat-card"
            onClick={() => setTab(c.tab)}
          >
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-sub muted-text">{c.sub}</div>
          </button>
        ))}
      </div>

      {/* Mini terminal */}
      <div className="retro-card overview-terminal">
        <div className="term-bar muted-text">SYSTEM LOG</div>
        <div className="term-body">
          <p><span className="muted-text">[INFO]</span> Profile initialised successfully.</p>
          <p><span className="muted-text">[INFO]</span> Awaiting study session data...</p>
          <p><span className="muted-text">[INFO]</span> Prediction model standing by.</p>
          <p><span className="muted-text">[HINT]</span> Navigate to STUDY LOG to begin tracking.</p>
          <p className="dim-text">&gt; <span className="blink">█</span></p>
        </div>
      </div>
    </div>
  )
}
