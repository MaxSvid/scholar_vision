import { useState, useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import HeroPage from './components/HeroPage'
import Dashboard from './components/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)

  // Restore session from localStorage on mount
  useEffect(() => {
    const auth = localStorage.getItem('sv-auth')
    const stored = localStorage.getItem('sv-user')
    if (auth === '1' && stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  const handleLogin = (userData) => setUser(userData)

  const handleLogout = () => {
    localStorage.removeItem('sv-auth')
    setUser(null)
  }

  return (
    <ThemeProvider>
      {user
        ? <Dashboard user={user} onLogout={handleLogout} />
        : <HeroPage onLogin={handleLogin} />
      }
    </ThemeProvider>
  )
}
