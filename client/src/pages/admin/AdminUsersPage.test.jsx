import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ProtectedRoute from '../../components/ProtectedRoute.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'

const ADMIN = { _id: 'a1', name: 'Admin Rehla', email: 'admin@rehla.tn', role: 'admin' }
const AMEL = {
  _id: 'u1',
  name: 'Amel Trabelsi',
  email: 'amel@example.com',
  role: 'voyageur',
  status: 'actif',
  createdAt: '2026-10-02T10:00:00.000Z',
}
const SAMI = {
  _id: 'p1',
  name: 'Sami Gharbi',
  email: 'sami@example.com',
  role: 'prestataire',
  status: 'actif',
  createdAt: '2026-11-20T10:00:00.000Z',
  provider: {
    businessName: 'Dar Yasmine',
    activityType: 'hebergement',
    city: 'Sfax',
    phone: '+216 70 000 303',
    approval: 'en_attente',
  },
}

const page = (items) => ({ items, total: items.length, page: 1, pages: items.length ? 1 : 0 })

/**
 * Page « Gestion des utilisateurs » avec un admin connecté.
 * `users` : réponse de GET /admin/users (fonction de l'URL) ; `routes` : autres routes simulées.
 */
function renderPage({ entry = '/admin/utilisateurs', me = ADMIN, users, routes = {} } = {}) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  const fetchMock = mockApi({
    'GET /users/me': () => jsonResponse({ user: me }),
    'GET /admin/stats': () =>
      jsonResponse({ users: {}, suspended: 0, pendingProviders: 1 }),
    'GET /admin/users': (_body, options) => users(options.url),
    ...routes,
  })
  // mockApi ne transmet pas l'URL : on la recopie dans les options pour les filtres.
  const original = fetchMock.getMockImplementation()
  fetchMock.mockImplementation((url, options = {}) => original(url, { ...options, url }))

  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route
              path="/admin/utilisateurs"
              element={
                <>
                  <AdminUsersPage />
                  <LocationDisplay />
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return fetchMock
}

const usersCalls = (fetchMock) =>
  fetchMock.mock.calls
    .map(([url]) => new URL(url))
    .filter((url) => url.pathname.endsWith('/admin/users'))

describe('AdminUsersPage — liste, onglets et recherche', () => {
  it('affiche l’en-tête et le tableau des comptes', async () => {
    renderPage({ users: () => jsonResponse(page([SAMI, AMEL])) })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gestion des utilisateurs' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Administration')).toHaveClass('surtitre')

    const table = await screen.findByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
    expect(headers).toEqual(['Nom', 'E-mail', 'Rôle', 'Statut', 'Inscription', 'Actions'])

    const samiRow = screen.getByRole('rowheader', { name: /Sami Gharbi/ }).closest('tr')
    expect(within(samiRow).getByText('sami@example.com')).toBeInTheDocument()
    expect(within(samiRow).getByText('Prestataire')).toBeInTheDocument()
    expect(within(samiRow).getByText('En attente')).toBeInTheDocument()
    expect(within(samiRow).getByText('20 nov. 2026')).toBeInTheDocument()

    const amelRow = screen.getByRole('rowheader', { name: /Amel Trabelsi/ }).closest('tr')
    expect(within(amelRow).getByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('2 comptes · Tous')).toBeInTheDocument()
  })

  it('les onglets filtrent la liste et sont synchronisés avec l’URL', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({ users: () => jsonResponse(page([AMEL])) })
    await screen.findByRole('table')

    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true')
    // Le nombre de demandes en attente s'affiche sur l'onglet.
    const requests = await screen.findByRole('button', { name: 'Demandes prestataire : 1' })

    await user.click(requests)
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/utilisateurs?approval=en_attente',
    )
    expect(requests).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() =>
      expect(usersCalls(fetchMock).at(-1).searchParams.get('approval')).toBe('en_attente'),
    )

    await user.click(screen.getByRole('button', { name: 'Suspendus' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/utilisateurs?status=suspendu')
    await waitFor(() => {
      const last = usersCalls(fetchMock).at(-1).searchParams
      expect(last.get('status')).toBe('suspendu')
      expect(last.get('approval')).toBeNull()
    })
  })

  it('ouvre l’onglet correspondant à l’URL (lien du tableau de bord)', async () => {
    const fetchMock = renderPage({
      entry: '/admin/utilisateurs?approval=en_attente',
      users: () => jsonResponse(page([SAMI])),
    })

    expect(await screen.findByRole('button', { name: /Demandes prestataire/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await screen.findByRole('table')
    expect(usersCalls(fetchMock)[0].searchParams.get('approval')).toBe('en_attente')
  })

  it('recherche par nom, e-mail ou nom commercial', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({
      users: (url) =>
        jsonResponse(page(new URL(url).searchParams.get('search') ? [SAMI] : [SAMI, AMEL])),
    })
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Recherche'), 'yasmine')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(screen.getByTestId('location')).toHaveTextContent('search=yasmine')
    await waitFor(() =>
      expect(screen.queryByRole('rowheader', { name: /Amel Trabelsi/ })).not.toBeInTheDocument(),
    )
    expect(usersCalls(fetchMock).at(-1).searchParams.get('search')).toBe('yasmine')

    await user.click(screen.getByRole('button', { name: 'Effacer la recherche' }))
    expect(await screen.findByRole('rowheader', { name: /Amel Trabelsi/ })).toBeInTheDocument()
  })

  it('affiche le détail de l’activité d’un prestataire', async () => {
    const user = userEvent.setup()
    renderPage({ users: () => jsonResponse(page([SAMI])) })
    const toggle = await screen.findByRole('button', { name: 'Voir l’activité de Sami Gharbi' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const details = document.getElementById(toggle.getAttribute('aria-controls'))
    expect(within(details).getByText('Dar Yasmine')).toBeInTheDocument()
    expect(within(details).getByText('Hébergement')).toBeInTheDocument()
    expect(within(details).getByText('Sfax')).toBeInTheDocument()
    expect(within(details).getByText('+216 70 000 303')).toBeInTheDocument()
  })

  it('liste vide', async () => {
    renderPage({
      entry: '/admin/utilisateurs?approval=en_attente',
      users: () => jsonResponse(page([])),
    })
    expect(
      await screen.findByRole('heading', { name: 'Aucune demande en attente' }),
    ).toBeInTheDocument()
  })

  it('erreur de chargement puis « Réessayer »', async () => {
    const user = userEvent.setup()
    let calls = 0
    renderPage({
      users: () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ message: 'Service momentanément indisponible.' }, 503)
          : jsonResponse(page([AMEL]))
      },
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les utilisateurs')
    expect(alert).toHaveTextContent('Service momentanément indisponible.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('rowheader', { name: /Amel Trabelsi/ })).toBeInTheDocument()
  })
})

describe('AdminUsersPage — actions', () => {
  it('approuve une demande : message de succès et compte retiré de l’onglet « Demandes »', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({
      entry: '/admin/utilisateurs?approval=en_attente',
      users: () => jsonResponse(page([SAMI])),
      routes: {
        'PATCH /admin/users/p1/validation': () =>
          jsonResponse({ user: { ...SAMI, provider: { ...SAMI.provider, approval: 'approuve' } } }),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Approuver Sami Gharbi' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'La demande de Sami Gharbi est approuvée',
    )
    expect(screen.queryByRole('rowheader', { name: /Sami Gharbi/ })).not.toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(JSON.parse(patch[1].body)).toEqual({ decision: 'approuve' })
  })

  it('refuse une demande avec un motif (boîte de dialogue)', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({
      users: () => jsonResponse(page([SAMI])),
      routes: {
        'PATCH /admin/users/p1/validation': (body) =>
          jsonResponse({
            user: {
              ...SAMI,
              provider: { ...SAMI.provider, approval: 'refuse', rejectionReason: body.reason },
            },
          }),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Refuser Sami Gharbi' }))
    const dialog = screen.getByRole('dialog', { name: 'Refuser la demande de Sami Gharbi ?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    await user.type(within(dialog).getByLabelText('Motif (facultatif)'), 'Téléphone injoignable.')
    await user.click(within(dialog).getByRole('button', { name: 'Refuser la demande' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'La demande de Sami Gharbi est refusée.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const row = screen.getByRole('rowheader', { name: /Sami Gharbi/ }).closest('tr')
    expect(within(row).getByText('Refusé')).toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')
    expect(JSON.parse(patch[1].body)).toEqual({
      decision: 'refuse',
      reason: 'Téléphone injoignable.',
    })
  })

  it('suspend puis réactive un compte', async () => {
    const user = userEvent.setup()
    renderPage({
      users: () => jsonResponse(page([AMEL])),
      routes: {
        'PATCH /admin/users/u1/statut': (body) =>
          jsonResponse({ user: { ...AMEL, status: body.status } }),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Suspendre Amel Trabelsi' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Le compte de Amel Trabelsi est suspendu',
    )
    const row = screen.getByRole('rowheader', { name: /Amel Trabelsi/ }).closest('tr')
    expect(within(row).getByText('Suspendu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Réactiver Amel Trabelsi' }))
    expect(await screen.findByText('Le compte de Amel Trabelsi est réactivé.')).toBeInTheDocument()
    expect(within(row).getByText('Actif')).toBeInTheDocument()
  })

  it('supprime un compte après confirmation', async () => {
    const user = userEvent.setup()
    renderPage({
      users: () => jsonResponse(page([AMEL, SAMI])),
      routes: { 'DELETE /admin/users/u1': () => ({ ok: true, status: 204, json: async () => null }) },
    })

    await user.click(await screen.findByRole('button', { name: 'Supprimer Amel Trabelsi' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce compte ?' })
    expect(dialog).toHaveTextContent('amel@example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Le compte de Amel Trabelsi a été supprimé.',
    )
    expect(screen.queryByRole('rowheader', { name: /Amel Trabelsi/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 compte · Tous')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('affiche l’erreur de l’API dans la boîte de dialogue', async () => {
    const user = userEvent.setup()
    renderPage({
      users: () => jsonResponse(page([AMEL])),
      routes: {
        'DELETE /admin/users/u1': () =>
          jsonResponse({ message: 'Service momentanément indisponible.' }, 503),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Supprimer Amel Trabelsi' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Service momentanément indisponible.')).toBeVisible()
    expect(screen.getByRole('rowheader', { name: /Amel Trabelsi/ })).toBeInTheDocument()
  })

  it('aucune action sur son propre compte ni sur un autre administrateur', async () => {
    const otherAdmin = { ...ADMIN, _id: 'a2', name: 'Leila Admin', email: 'leila@rehla.tn' }
    renderPage({ users: () => jsonResponse(page([{ ...ADMIN, status: 'actif' }, otherAdmin])) })

    const myRow = (await screen.findByRole('rowheader', { name: /Admin Rehla/ })).closest('tr')
    expect(within(myRow).getByText('Votre compte')).toBeInTheDocument()
    expect(within(myRow).queryByRole('button')).not.toBeInTheDocument()

    const otherRow = screen.getByRole('rowheader', { name: /Leila Admin/ }).closest('tr')
    expect(within(otherRow).getByText('Aucune action')).toBeInTheDocument()
    expect(within(otherRow).queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('AdminUsersPage — accès', () => {
  it('« Accès refusé » pour un compte qui n’est pas administrateur', async () => {
    renderPage({ me: AMEL, users: () => jsonResponse(page([])) })

    expect(await screen.findByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
