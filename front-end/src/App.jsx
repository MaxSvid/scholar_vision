import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import HeroPage from './components/HeroPage'
import Dashboard from './components/Dashboard'

function AppInner() {
  const { user, logout } = useAuth()
  return user
    ? <Dashboard user={user} onLogout={logout} />
    : <HeroPage onLogin={() => {}} />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  )
}
