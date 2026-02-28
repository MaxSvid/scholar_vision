import { useState } from 'react'
import StudyTracker from './StudyTracker'
import AppUsage from './AppUsage'
import AttentionSpan from './AttentionSpan'
import PredictionPanel from './PredictionPanel'
import FileImport from './FileImport'
import DataGraph3D from './DataGraph3D'
import PeerGraph3D from './PeerGraph3D'
import './Dashboard.css'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: '◎' },
  { id: 'study',       label: 'Study Log',   icon: '◈' },
  { id: 'apps',        label: 'App Usage',   icon: '◐' },
  { id: 'attention',   label: 'Attention',   icon: '◉' },
  { id: 'prediction',  label: 'Prediction',  icon: '◇' },
  { id: 'graph3d',     label: '3D Graph',    icon: '◈' },
  { id: 'peers',       label: 'Peers',       icon: '❂' },
  { id: 'files',       label: 'Files',       icon: '▦' },
]

const INIT_STUDY_SESSIONS = [
  { id: 1, subject: 'Mathematics', hours: 2.5, date: '2026-02-27', notes: 'Calculus revision' },
  { id: 2, subject: 'Programming', hours: 3,   date: '2026-02-26', notes: 'Data structures assignment' },
]

const INIT_APP_LOGS = [
  { id: 1, app: 'VS Code',  hours: 3.5, category: 'Productive',  date: '2026-02-27' },
  { id: 2, app: 'TikTok',   hours: 1.2, category: 'Distracting', date: '2026-02-27' },
  { id: 3, app: 'Anki',     hours: 0.8, category: 'Productive',  date: '2026-02-26' },
  { id: 4, app: 'Netflix',  hours: 2.0, category: 'Distracting', date: '2026-02-26' },
]

const INIT_ATT_SESSIONS = [
  { id: 1, duration: 45, breaks: 2, quality: 'High',   date: '2026-02-27' },
  { id: 2, duration: 25, breaks: 1, quality: 'Medium', date: '2026-02-26' },
  { id: 3, duration: 60, breaks: 3, quality: 'High',   date: '2026-02-25' },
]

export default function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [studySessions, setStudySessions] = useState(INIT_STUDY_SESSIONS)
  const [appLogs,       setAppLogs]       = useState(INIT_APP_LOGS)
  const [attSessions,   setAttSessions]   = useState(INIT_ATT_SESSIONS)

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : 'Scholar'

  return (
    <div className="dash-root">
      {/* TOP BAR */}
      <header className="dash-header">
        <div className="dash-logo">
          <img src="/favicon.png" alt="ScholarVision logo" className="nav-logo-img" />
          SV
        </div>
        <div className="dash-header-right">
          <div className="dash-user">{displayName}</div>
          <button className="retro-btn" onClick={onLogout}>Logout</button>
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
          {tab === 'study'      && <StudyTracker sessions={studySessions} setSessions={setStudySessions} />}
          {tab === 'apps'       && <AppUsage logs={appLogs} setLogs={setAppLogs} />}
          {tab === 'attention'  && <AttentionSpan sessions={attSessions} setSessions={setAttSessions} />}
          {tab === 'prediction' && <PredictionPanel user={user} />}
          {tab === 'graph3d'    && (
            <DataGraph3D
              user={user}
              studySessions={studySessions}
              appLogs={appLogs}
              attSessions={attSessions}
            />
          )}
          {tab === 'peers'      && <PeerGraph3D />}
          {tab === 'files'      && <FileImport />}
        </main>
      </div>
    </div>
  )
}

/* ─── OVERVIEW PANEL ─── */
function OverviewPanel({ user, setTab }) {
  const cards = [
    { icon: '◈', label: 'Study Hours Today',   value: '—', sub: 'No sessions logged yet',  tab: 'study' },
    { icon: '◉', label: 'Avg. Attention Span', value: '—', sub: 'Start a focus session',   tab: 'attention' },
    { icon: '◐', label: 'Top App Today',        value: '—', sub: 'Log your app usage',      tab: 'apps' },
    { icon: '◇', label: 'Predicted Grade',      value: '—', sub: 'Add data to unlock',      tab: 'prediction' },
  ]

  return (
    <div className="overview-root">
      <div className="panel-title">Overview</div>

      {user && (
        <div className="retro-card overview-profile">
          <div className="profile-row">
            <div>
              <div className="profile-name">{user.firstName} {user.lastName}</div>
              <div className="muted-text" style={{ fontSize: '0.78rem' }}>
                {user.fieldOfStudy} · {user.yearOfStudy}
                {user.university ? ` · ${user.university}` : ''}
              </div>
            </div>
            <div className="profile-goal">
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }} className="muted-text">
                Weekly Target
              </div>
              <div style={{ fontSize: '1.3rem' }}>
                {user.weeklyHours || '—'}h
              </div>
            </div>
          </div>
          {user.studyGoal && (
            <div className="profile-goaltext muted-text">
              Goal: {user.studyGoal}
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

      {/* Status */}
      <div className="retro-card overview-status">
        <p>Profile initialised. Navigate to a section to begin tracking.</p>
      </div>
    </div>
  )
}
