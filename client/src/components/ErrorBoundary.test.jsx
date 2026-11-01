import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

let shouldThrow
function Fragile() {
  if (shouldThrow) throw new Error('Panne simulée')
  return <p>Contenu affiché</p>
}

beforeEach(() => {
  shouldThrow = true
  // React et l'ErrorBoundary journalisent l'erreur : on garde la sortie des tests lisible.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ErrorBoundary', () => {
  it('affiche « Une erreur est survenue » à la place du composant qui plante', () => {
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Une erreur est survenue' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
    expect(screen.queryByText('Panne simulée')).not.toBeInTheDocument()
  })

  it('journalise l’erreur dans la console', () => {
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    )

    expect(console.error).toHaveBeenCalledWith(
      'Erreur inattendue dans l’interface :',
      expect.objectContaining({ message: 'Panne simulée' }),
      expect.any(String),
    )
  })

  it('« Réessayer » réaffiche le contenu quand le problème a disparu', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    )

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(screen.getByText('Contenu affiché')).toBeInTheDocument()
  })

  it('oublie l’erreur quand resetKey change (changement de page)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Fragile />
      </ErrorBoundary>,
    )
    shouldThrow = false

    rerender(
      <ErrorBoundary resetKey="/b">
        <Fragile />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Contenu affiché')).toBeInTheDocument()
  })

  it('version autonome : page complète avec le logo', () => {
    render(
      <ErrorBoundary standalone>
        <Fragile />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('link', { name: 'rehla.tn, retour à l\'accueil' })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})

describe('Erreur dans une page du site', () => {
  it('garde la navigation, et changer de page efface l’erreur', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(
      <MemoryRouter initialEntries={['/test-erreur']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Une erreur est survenue' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()

    const header = screen.getByRole('banner')
    await user.click(within(header).getByRole('link', { name: 'rehla.tn, retour à l\'accueil' }))

    expect(screen.queryByRole('heading', { name: 'Une erreur est survenue' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Toute la Tunisie, sur une seule carte' }),
    ).toBeInTheDocument()
  })
})
