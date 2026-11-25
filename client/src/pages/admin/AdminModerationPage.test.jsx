import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import AdminModerationPage from './AdminModerationPage.jsx'

const REVIEWS = [
  {
    _id: 'r1',
    rating: 1,
    comment: 'PROMO !!! Réservez ailleurs.',
    author: { _id: 'u6', name: 'Nour Ayari', email: 'voyageur6@demo.rehla.tn' },
    service: { _id: 's1', name: 'La Maison aux Volets Bleus', type: 'hebergement', hidden: false },
    createdAt: '2026-11-20T10:00:00.000Z',
  },
  {
    _id: 'r2',
    rating: 5,
    author: { _id: 'u1', name: 'Amel Trabelsi', email: 'voyageur1@demo.rehla.tn' },
    service: { _id: 's2', name: 'Kayak', type: 'activite', hidden: true },
    createdAt: '2026-11-18T10:00:00.000Z',
  },
]
const SERVICES = [
  {
    _id: 's1',
    type: 'hebergement',
    name: 'La Maison aux Volets Bleus',
    hidden: false,
    destination: { name: 'Sidi Bou Saïd' },
    provider: { name: 'Nour Ben Salem', provider: { businessName: 'Nour Évasions' } },
  },
]
const SHARES = [
  {
    _id: 't1',
    user: { name: 'Amel Trabelsi', email: 'voyageur1@demo.rehla.tn' },
    destination: { name: 'Djerba' },
    startDate: '2026-12-07T00:00:00.000Z',
    endDate: '2026-12-13T00:00:00.000Z',
    message: 'Un louage depuis Tunis ?',
  },
]

const page = (items, extra = {}) =>
  jsonResponse({ items, total: items.length, page: 1, pages: items.length ? 1 : 0, ...extra })

function renderPage(routes = {}, entry = '/admin/moderation') {
  const fetchMock = mockApi({
    'GET /admin/reviews': () => page(REVIEWS),
    'GET /admin/services': () => page(SERVICES),
    'GET /admin/trip-shares': () => page(SHARES),
    ...routes,
  })
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin/moderation" element={<AdminModerationPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return fetchMock
}

const lastQuery = (fetchMock, path) =>
  new URL(
    fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === `/api${path}`).at(-1)[0],
  ).searchParams

describe('AdminModerationPage — avis (US7.2)', () => {
  it('liste les avis avec l’auteur, le service et la date', async () => {
    renderPage()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Modération des contenus' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Avis' })).toHaveAttribute('aria-pressed', 'true')

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('PROMO !!! Réservez ailleurs.')).toBeInTheDocument()
    expect(within(rows[0]).getByText('voyageur6@demo.rehla.tn')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link', { name: 'La Maison aux Volets Bleus' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    // Service masqué : pas de lien.
    expect(within(rows[1]).queryByRole('link')).not.toBeInTheDocument()
    expect(within(rows[1]).getByText('Note sans commentaire')).toBeInTheDocument()
    expect(screen.getByText('2 avis')).toBeInTheDocument()
  })

  it('cherche (paramètre search) et efface la recherche', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage()
    await screen.findByRole('table')

    await user.type(screen.getByLabelText('Recherche'), 'promo')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))
    await waitFor(() => expect(lastQuery(fetchMock, '/admin/reviews').get('search')).toBe('promo'))

    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    await waitFor(() => expect(lastQuery(fetchMock, '/admin/reviews').get('search')).toBeNull())
  })

  it('supprime un avis après confirmation', async () => {
    const user = userEvent.setup()
    let items = REVIEWS
    const fetchMock = renderPage({
      'GET /admin/reviews': () => page(items),
      'DELETE /admin/reviews/r1': () => {
        items = [REVIEWS[1]]
        return { ok: true, status: 204, json: async () => null }
      },
    })
    await user.click(
      await screen.findByRole('button', { name: 'Supprimer l’avis de Nour Ayari' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Supprimer cet avis ?' })
    expect(dialog).toHaveTextContent('la note du service recalculée')
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(fetchMock.mock.calls.some(([, o = {}]) => o.method === 'DELETE')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Supprimer l’avis de Nour Ayari' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer définitivement' }),
    )
    expect(await screen.findByText('L’avis de Nour Ayari a été supprimé.')).toBeInTheDocument()
    expect(await screen.findByText('1 avis')).toBeInTheDocument()
  })

  it('affiche une erreur avec « Réessayer » et un état vide', async () => {
    const user = userEvent.setup()
    let fail = true
    renderPage({
      'GET /admin/reviews': () =>
        fail ? jsonResponse({ message: 'Serveur indisponible.' }, 503) : page([]),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur indisponible.')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(
      await screen.findByRole('heading', { name: 'Aucun avis pour le moment' }),
    ).toBeInTheDocument()
  })
})

describe('AdminModerationPage — services et partages (US7.2)', () => {
  it('masque puis réaffiche un service', async () => {
    const user = userEvent.setup()
    const sent = []
    renderPage(
      {
        'PATCH /admin/services/s1/visibilite': (body) => {
          sent.push(body)
          return jsonResponse({ service: { ...SERVICES[0], hiddenByAdmin: body.hidden } })
        },
      },
      '/admin/moderation?onglet=services',
    )
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Nour Évasions')).toBeInTheDocument()
    expect(within(table).getByText('Visible')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Masquer « La Maison aux Volets Bleus »' }),
    )
    expect(await screen.findByText(/est masqué par la modération/)).toBeInTheDocument()
    expect(within(table).getByText('Masqué par la modération')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Réafficher « La Maison aux Volets Bleus »' }),
    )
    expect(await screen.findByText(/est de nouveau visible/)).toBeInTheDocument()
    expect(sent).toEqual([{ hidden: true }, { hidden: false }])
  })

  it('distingue un service masqué par son prestataire, sans toucher à son choix', async () => {
    const user = userEvent.setup()
    const providerHidden = { ...SERVICES[0], hidden: true, hiddenByAdmin: false }
    const sent = []
    renderPage(
      {
        'GET /admin/services': () => page([providerHidden]),
        'PATCH /admin/services/s1/visibilite': (body) => {
          sent.push(body)
          return jsonResponse({ service: { ...providerHidden, hiddenByAdmin: body.hidden } })
        },
      },
      '/admin/moderation?onglet=services',
    )
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Masqué par le prestataire')).toBeInTheDocument()
    // Pas de lien vers une fiche qui n'est pas publique.
    expect(within(table).queryByRole('link')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Masquer « La Maison aux Volets Bleus »' }),
    )
    expect(await screen.findByText(/est masqué par la modération/)).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Réafficher « La Maison aux Volets Bleus »' }),
    )
    expect(await screen.findByText(/il reste masqué par son prestataire/)).toBeInTheDocument()
    expect(sent).toEqual([{ hidden: true }, { hidden: false }])
  })

  it('filtre les services masqués (hidden=true) depuis l’URL', async () => {
    const fetchMock = renderPage({}, '/admin/moderation?onglet=services&visibilite=masques')
    await screen.findByRole('table')
    expect(lastQuery(fetchMock, '/admin/services').get('hidden')).toBe('true')
    expect(screen.getByLabelText('Visibilité')).toHaveValue('masques')
  })

  it('supprime un service après confirmation', async () => {
    const user = userEvent.setup()
    let items = SERVICES
    renderPage(
      {
        'GET /admin/services': () => page(items),
        'DELETE /admin/services/s1': () => {
          items = []
          return { ok: true, status: 204, json: async () => null }
        },
      },
      '/admin/moderation?onglet=services',
    )
    await user.click(
      await screen.findByRole('button', { name: 'Supprimer « La Maison aux Volets Bleus »' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce service ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(
      await screen.findByText('« La Maison aux Volets Bleus » a été supprimé.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Aucun service pour le moment' }),
    ).toBeInTheDocument()
  })

  it('liste et supprime un partage de voyage', async () => {
    const user = userEvent.setup()
    let deleted = false
    renderPage({
      'DELETE /admin/trip-shares/t1': () => {
        deleted = true
        return { ok: true, status: 204, json: async () => null }
      },
    })
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Partages de voyage' }))

    const table = await screen.findByRole('table', { name: /Partages de voyage/ })
    expect(within(table).getByText('Djerba')).toBeInTheDocument()
    expect(within(table).getByText('Du 7 déc. 2026 au 13 déc. 2026')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Supprimer le partage de Amel Trabelsi' }),
    )
    await user.click(
      within(screen.getByRole('dialog', { name: 'Supprimer ce partage de voyage ?' })).getByRole(
        'button',
        { name: 'Supprimer définitivement' },
      ),
    )
    expect(
      await screen.findByText('Le partage de Amel Trabelsi a été supprimé.'),
    ).toBeInTheDocument()
    expect(deleted).toBe(true)
  })
})
