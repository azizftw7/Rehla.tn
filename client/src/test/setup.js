import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { mockSystemTheme } from './utils.jsx'

beforeEach(() => {
  // jsdom n'implémente pas matchMedia : thème système clair par défaut.
  mockSystemTheme('light')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
