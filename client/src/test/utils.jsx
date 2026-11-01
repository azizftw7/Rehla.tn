import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'

/**
 * Simule le thème du système (prefers-color-scheme).
 * Renvoie une fonction pour déclencher un changement de thème système pendant le test.
 */
export function mockSystemTheme(theme) {
  const listeners = new Set()
  const media = {
    matches: theme === 'dark',
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  window.matchMedia = vi.fn(() => media)
  return (next) => {
    media.matches = next === 'dark'
    listeners.forEach((listener) => listener({ matches: media.matches }))
  }
}

/** Réponse JSON simulée pour fetch. */
export function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

/** Affiche l'URL courante : permet de vérifier une navigation. */
export function LocationDisplay() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

/** Rend un élément dans un routeur en mémoire, à l'URL donnée. */
export function renderWithRouter(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}
