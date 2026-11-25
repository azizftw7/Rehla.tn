import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { THEME_STORAGE_KEY } from '../hooks/useTheme.js'
import { notifyAdminChange } from '../lib/adminApi.js'
import { TOKEN_STORAGE_KEY } from '../lib/api.js'
import {
  jsonResponse,
  LocationDisplay,
  mockApi,
  mockSystemTheme,
  renderWithRouter,
} from '../test/utils.jsx'
import NavBar from './NavBar.jsx'

/** NavBar avec un utilisateur connecté (session rechargée depuis /users/me). */
function renderConnected(user) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  mockApi({ 'GET /users/me': () => jsonResponse({ user }) })
  return render(
    <AuthProvider>
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('NavBar — utilisateur connecté', () => {
  it('remplace Connexion / Inscription par le nom et « Déconnexion »', async () => {
    renderConnected({ _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' })

    expect(await screen.findByText('Amel Trabelsi')).toBeInTheDocument()
    expect(screen.getByText(/Connecté en tant que/)).toHaveClass('visually-hidden')
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Inscription' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Espace prestataire' })).not.toBeInTheDocument()
  })

  it('propose « Mes favoris » aux voyageurs seulement (US5.1)', async () => {
    renderConnected({ _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' })
    expect(await screen.findByRole('link', { name: 'Mes favoris' })).toHaveAttribute(
      'href',
      '/mes-favoris',
    )
  })

  it('pas de « Mes favoris » pour un prestataire', async () => {
    renderConnected({
      _id: 'p1',
      name: 'Karim Jlassi',
      role: 'prestataire',
      provider: { approval: 'approuve' },
    })
    await screen.findByRole('link', { name: 'Espace prestataire' })
    expect(screen.queryByRole('link', { name: 'Mes favoris' })).not.toBeInTheDocument()
  })

  it('propose l’espace prestataire à un prestataire validé', async () => {
    renderConnected({
      _id: 'p1',
      name: 'Karim Jlassi',
      role: 'prestataire',
      provider: { approval: 'approuve' },
    })

    expect(await screen.findByRole('link', { name: 'Espace prestataire' })).toHaveAttribute(
      'href',
      '/prestataire/services',
    )
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('affiche « En attente » tant que le compte prestataire n’est pas validé', async () => {
    renderConnected({
      _id: 'p2',
      name: 'Sami Gharbi',
      role: 'prestataire',
      provider: { approval: 'en_attente' },
    })

    const link = await screen.findByRole('link', { name: 'Espace prestataire : En attente' })
    expect(link).toHaveAttribute('href', '/prestataire/en-attente')
  })

  it('affiche « Administration » avec le nombre de demandes en attente pour un admin', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
    const stats = { users: {}, suspended: 0, pendingProviders: 3 }
    mockApi({
      'GET /users/me': () =>
        jsonResponse({ user: { _id: 'a1', name: 'Admin Rehla', role: 'admin' } }),
      'GET /admin/stats': () => jsonResponse(stats),
    })
    render(
      <AuthProvider>
        <MemoryRouter>
          <NavBar />
        </MemoryRouter>
      </AuthProvider>,
    )

    const link = await screen.findByRole('link', {
      name: 'Administration : 3 demandes en attente',
    })
    expect(link).toHaveAttribute('href', '/admin')

    // Après une action de l'administrateur, le compteur est relu.
    stats.pendingProviders = 0
    act(() => notifyAdminChange())
    expect(await screen.findByRole('link', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Espace prestataire' })).not.toBeInTheDocument()
  })

  it.each([
    ['voyageur', { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' }],
    [
      'prestataire',
      { _id: 'p1', name: 'Karim Jlassi', role: 'prestataire', provider: { approval: 'approuve' } },
    ],
    ['admin', { _id: 'a1', name: 'Admin Rehla', role: 'admin' }],
  ])('propose « Mot de passe » à un compte %s', async (_role, account) => {
    renderConnected(account)

    expect(await screen.findByRole('link', { name: 'Mot de passe' })).toHaveAttribute(
      'href',
      '/mon-compte/mot-de-passe',
    )
  })

  it('pas de lien « Mot de passe » pour un visiteur', () => {
    renderWithRouter(<NavBar />)
    expect(screen.queryByRole('link', { name: 'Mot de passe' })).not.toBeInTheDocument()
  })

  it('déconnecte l’utilisateur (y compris depuis le menu mobile)', async () => {
    const user = userEvent.setup()
    renderConnected({ _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' })
    await screen.findByText('Amel Trabelsi')

    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    await user.click(burger)
    await user.click(screen.getByRole('button', { name: 'Déconnexion' }))

    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(burger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/connexion')
    expect(screen.queryByText('Amel Trabelsi')).not.toBeInTheDocument()
  })
})

const html = document.documentElement

describe('NavBar — thème clair / sombre', () => {
  it('suit le thème du système par défaut', () => {
    mockSystemTheme('dark')

    renderWithRouter(<NavBar />)

    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: 'Activer le thème clair' })).toBeInTheDocument()
  })

  it('bascule le thème au clic et mémorise le choix', async () => {
    const user = userEvent.setup()
    renderWithRouter(<NavBar />)
    expect(html).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Activer le thème sombre' }))

    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Activer le thème clair' })).toBeInTheDocument()
  })

  it('le choix mémorisé l’emporte sur le thème du système', () => {
    mockSystemTheme('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'light')

    renderWithRouter(<NavBar />)

    expect(html).toHaveAttribute('data-theme', 'light')
  })

  it('suit les changements du système tant que l’utilisateur n’a rien choisi', () => {
    const changeSystemTheme = mockSystemTheme('light')
    renderWithRouter(<NavBar />)

    act(() => changeSystemTheme('dark'))

    expect(html).toHaveAttribute('data-theme', 'dark')
  })
})

describe('NavBar — navigation', () => {
  it('affiche le logo et les liens principaux', () => {
    renderWithRouter(<NavBar />)

    expect(screen.getByRole('link', { name: /rehla\.tn/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Destinations' })).toHaveAttribute(
      'href',
      '/destinations',
    )
    expect(screen.getByRole('link', { name: 'Partage de voyage' })).toHaveAttribute(
      'href',
      '/partage',
    )
    expect(screen.getByRole('link', { name: 'Devenir prestataire' })).toHaveAttribute(
      'href',
      '/inscription?role=prestataire',
    )
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/connexion')
    expect(screen.getByRole('link', { name: 'Inscription' })).toHaveAttribute(
      'href',
      '/inscription',
    )
  })

  it('ouvre et ferme le menu mobile, y compris avec Échap', async () => {
    const user = userEvent.setup()
    renderWithRouter(<NavBar />)
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    expect(burger).toHaveAttribute('aria-expanded', 'false')

    await user.click(burger)
    expect(burger).toHaveAttribute('aria-expanded', 'true')
    expect(burger).toHaveAccessibleName('Fermer le menu')

    await user.keyboard('{Escape}')
    expect(burger).toHaveAttribute('aria-expanded', 'false')
    expect(burger).toHaveFocus()
  })

  it('ferme le menu mobile quand on change de page', async () => {
    const user = userEvent.setup()
    // La barre reste affichée pendant la navigation, comme dans le vrai Layout.
    render(
      <MemoryRouter>
        <NavBar />
        <LocationDisplay />
      </MemoryRouter>,
    )
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    await user.click(burger)

    await user.click(screen.getByRole('link', { name: 'Destinations' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/destinations')
    expect(burger).toHaveAttribute('aria-expanded', 'false')
  })
})
