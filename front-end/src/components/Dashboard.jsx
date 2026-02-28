import { useState } from 'react'
import ThemeSwitcher from './ThemeSwitcher'
import StudyTracker from './StudyTracker'
import AppUsage from './AppUsage'
import AttentionSpan from './AttentionSpan'
import PredictionPanel from './PredictionPanel'
import FileImport from './FileImport'
import './Dashboard.css'

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: '◎' },
  { id: 'study',       label: 'Study Log',   icon: '◈' },
  { id: 'apps',        label: 'App Usage',   icon: '◐' },
  { id: 'attention',   label: 'Attention',   icon: '◉' },
  { id: 'prediction',  label: 'Prediction',  icon: '◇' },
  { id: 'files',       label: 'Files',       icon: '▦' },
]

export default function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName}`
    : 'Scholar'

  return (
    <div className="dash-root">
      {/* TOP BAR */}
      <header className="dash-header">
        <div className="dash-logo">ScholarVision</div>
        <div className="dash-header-right">
          <ThemeSwitcher />
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
