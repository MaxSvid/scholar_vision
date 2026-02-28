import { createContext, useContext, useState, useEffect } from 'react'

const THEMES = [
  { id: 'matrix',    label: 'MATRIX',    fg: '#00ff41', bg: '#0d0d0d' },
  { id: 'amber',     label: 'AMBER',     fg: '#ffb000', bg: '#100800' },
  { id: 'blueprint', label: 'BLUEPRINT', fg: '#00e5ff', bg: '#00050f' },
  { id: 'ibm',       label: 'IBM',       fg: '#f0f0f0', bg: '#0000aa' },
  { id: 'phosphor',  label: 'PHOSPHOR',  fg: '#e8ffe8', bg: '#001200' },
]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('sv-theme') || 'matrix'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sv-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
