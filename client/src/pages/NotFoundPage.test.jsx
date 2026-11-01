import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'

const renderApp = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() => {
  // L'accueil charge les destinations : on laisse la requête en attente.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
})

describe('Page 404', () => {
  it('s’affiche pour une adresse inconnue, dans la mise en page du site', () => {
    renderApp('/une-page-qui-n-existe-pas')

    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getByText('/une-page-qui-n-existe-pas')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('propose de revenir à l’accueil ou de rechercher une destination', () => {
    renderApp('/inconnue')

    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Rechercher une destination' })).toHaveAttribute(
      'href',
      '/#recherche',
    )
  })

  it('« Rechercher une destination » ramène à l’accueil, curseur dans la recherche', async () => {
    const user = userEvent.setup()
    renderApp('/inconnue')

    await user.click(screen.getByRole('link', { name: 'Rechercher une destination' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Toute la Tunisie, sur une seule carte' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Destination' })).toHaveFocus()
  })

  it('« Retour à l’accueil » ramène à la page d’accueil', async () => {
    const user = userEvent.setup()
    renderApp('/inconnue')

    await user.click(screen.getByRole('link', { name: 'Retour à l’accueil' }))

    expect(screen.queryByRole('heading', { name: 'Page introuvable' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Destination' })).not.toHaveFocus()
  })
})
