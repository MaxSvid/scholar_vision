import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sv_token'))
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('sv_user')) } catch { return null }
  })

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      const msg = Array.isArray(e.detail)
        ? e.detail.map(d => d.msg || 'Validation error').join('; ')
        : (e.detail || `Login failed (${res.status})`)
      throw new Error(msg)
    }
    const data = await res.json()
    localStorage.setItem('sv_token', data.access_token)
    localStorage.setItem('sv_user',  JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (fields) => {
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      const msg = Array.isArray(e.detail)
        ? e.detail.map(d => d.msg || 'Validation error').join('; ')
        : (e.detail || `Registration failed (${res.status})`)
      throw new Error(msg)
    }
    const data = await res.json()
    localStorage.setItem('sv_token', data.access_token)
    localStorage.setItem('sv_user',  JSON.stringify(data.user))
    setToken(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sv_token')
    localStorage.removeItem('sv_user')
    setToken(null)
    setUser(null)
  }, [])

  // Reads token from localStorage at call time — stable reference, no deps on token state
  const apiFetch = useCallback(async (url, options = {}) => {
    const tk = localStorage.getItem('sv_token')
    const headers = { ...(options.headers || {}) }
    if (tk) headers['Authorization'] = `Bearer ${tk}`
    const res = await fetch(url, { ...options, headers })
    if (res.status === 401) {
      logout()
      throw new Error('Session expired — please log in again.')
    }
    return res
  }, [logout])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, register, apiFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
