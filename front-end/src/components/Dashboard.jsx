import { useState, useEffect } from 'react'
import StudyTracker from './StudyTracker'
import AppUsage from './AppUsage'
import AttentionSpan from './AttentionSpan'
import PredictionPanel from './PredictionPanel'
import FileImport from './FileImport'
import HealthImport from './HealthImport'
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
  { id: 'health',      label: 'Health',      icon: '♡' },
]

const INIT_ATT_SESSIONS = [
  { id: 1, duration: 45, breaks: 2, quality: 'High',   date: '2026-02-27' },
  { id: 2, duration: 25, breaks: 1, quality: 'Medium', date: '2026-02-26' },
  { id: 3, duration: 60, breaks: 3, quality: 'High',   date: '2026-02-25' },
]

export default function Dashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview')
  const [studySessions, setStudySessions] = useState([])
  const [appLogs,       setAppLogs]       = useState([])
  const [attSessions,   setAttSessions]   = useState(INIT_ATT_SESSIONS)
  const [healthMetrics, setHealthMetrics] = useState([])

  useEffect(() => {
    let id = sessionStorage.getItem('sv_session_id')
    if (!id) return
    fetch(`/api/health/metrics/summary?session_id=${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.summary && setHealthMetrics(d.summary))
      .catch(() => {})
  }, [])

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
              healthMetrics={healthMetrics}
            />
          )}
          {tab === 'peers'      && <PeerGraph3D />}
          {tab === 'files'      && <FileImport />}
          {tab === 'health'     && <HealthImport />}
        </main>
      </div>
    </div>
  )
}

/* ─── OVERVIEW PANEL ─── */
function OverviewPanel({ user, setTab }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    function load() {
      const sessionId = sessionStorage.getItem('sv_session_id') || ''
      fetch(`/api/profile/overview?session_id=${sessionId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setStats(d))
        .catch(() => {})
    }
    load()
    window.addEventListener('sv:data-imported', load)
    return () => window.removeEventListener('sv:data-imported', load)
  }, [])

  const cards = [
    {
      icon:  '◈',
      label: 'Study Hours Today',
      value: stats != null ? `${stats.studyHoursToday}h` : '—',
      sub:   stats?.studyHoursToday > 0 ? 'Hours logged today' : 'No sessions logged yet',
      tab:   'study',
    },
    {
      icon:  '◉',
      label: 'Avg. Attention Span',
      value: stats?.avgAttentionSpan != null ? `${stats.avgAttentionSpan}min` : '—',
      sub:   stats?.avgAttentionSpan != null ? 'Avg uninterrupted focus block' : 'Start a focus session',
      tab:   'attention',
    },
    {
      icon:  '◐',
      label: 'Top App Today',
      value: stats?.topAppToday ?? '—',
      sub:   stats?.topAppToday ? 'Most used app today' : 'Log your app usage',
      tab:   'apps',
    },
    {
      icon:  '◇',
      label: 'Predicted Grade',
      value: stats?.currentPredictedGrade ?? '—',
      sub:   stats?.currentPredictedGrade ? 'Based on your baseline' : 'Add data to unlock',
      tab:   'prediction',
    },
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
