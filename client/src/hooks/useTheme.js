import { useCallback, useEffect, useState } from 'react'

// Même clé que le script de index.html, qui applique le thème avant le premier affichage.
export const THEME_STORAGE_KEY = 'rehla-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function readSystemTheme() {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

/**
 * Thème clair/sombre posé sur <html data-theme>.
 * Suit le thème du système tant que l'utilisateur n'a rien choisi ; son choix est mémorisé.
 */
export function useTheme() {
  const [storedTheme, setStoredTheme] = useState(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState(readSystemTheme)
  const theme = storedTheme ?? systemTheme

  useEffect(() => {
    const media = window.matchMedia?.(DARK_QUERY)
    if (!media) return undefined
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Stockage indisponible (navigation privée) : le choix vaut pour cette visite.
    }
    setStoredTheme(next)
  }, [theme])

  return { theme, toggleTheme }
}
