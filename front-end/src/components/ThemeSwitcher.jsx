import { useTheme } from '../context/ThemeContext'
import './ThemeSwitcher.css'

export default function ThemeSwitcher() {
  const { theme, setTheme, THEMES } = useTheme()

  return (
    <div className="theme-switcher">
      <span className="theme-label">PALETTE:</span>
      <div className="theme-dots">
        {THEMES.map(t => (
          <button
            key={t.id}
            title={t.label}
            className={`theme-dot ${theme === t.id ? 'active' : ''}`}
            style={{ '--dot-fg': t.fg, '--dot-bg': t.bg }}
            onClick={() => setTheme(t.id)}
            aria-label={`Switch to ${t.label} theme`}
          >
            <span className="dot-inner" />
          </button>
        ))}
      </div>
    </div>
  )
}
