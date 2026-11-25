import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import ServiceReviews from './ServiceReviews.jsx'

const TRAVELER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur', profile: 'etudiant' }
const PROVIDER = { _id: 'p1', name: 'Sami Gharbi', role: 'prestataire' }

const REVIEWS = [
  {
    _id: 'r2',
    rating: 4,
    comment: 'Très calme, un peu loin du centre.',
    author: { _id: 'u3', name: 'Claire M.', profile: 'touriste' },
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
  },
  {
    _id: 'r1',
    rating: 5,
    comment: 'Accueil chaleureux et patio magnifique.',
    author: { _id: 'u2', name: 'Youssef H.', profile: 'resident' },
    providerReply: { text: 'Merci, au plaisir de vous revoir !' },
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  },
]

const MY_REVIEW = {
  _id: 'r9',
  rating: 3,
  comment: 'Correct.',
  author: { _id: 'u1', name: 'Amel T.', profile: 'etudiant' },
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
}

const reviewsPage = (items = REVIEWS, extra = {}) =>
  jsonResponse({
    items,
    total: items.length,
    page: 1,
    pages: items.length ? 1 : 0,
    summary: {
      average: 4.5,
      count: items.length,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    },
    ...extra,
  })

function renderReviews({ user = null, routes = {} } = {}) {
  if (user) localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  const onSummaryChange = vi.fn()
  const fetchMock = mockApi({
    'GET /users/me': () => jsonResponse({ user }),
    'GET /services/s1/reviews': () => reviewsPage(),
    'GET /services/s1/reviews/me': () => jsonResponse({ review: null }),
    ...routes,
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/services/s1']}>
        <Routes>
          <Route
            path="/services/:id"
            element={
              <ServiceReviews
                serviceId="s1"
                initialSummary={{ average: 0, count: 0 }}
                onSummaryChange={onSummaryChange}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return { fetchMock, onSummaryChange }
}

const calls = (fetchMock, method, path) =>
  fetchMock.mock.calls.filter(
    ([url, options = {}]) =>
      (options.method || 'GET') === method && new URL(url).pathname === `/api${path}`,
  )

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ServiceReviews — consultation (US3.5)', () => {
  it('affiche la moyenne, la répartition et la liste des avis', async () => {
    const { onSummaryChange } = renderReviews()

    const list = await screen.findByRole('list', { name: 'Avis des voyageurs' })
    const items = within(list).getAllByRole('article')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('heading', { name: 'Claire M.' })).toBeInTheDocument()
    expect(within(items[0]).getByText('Touriste')).toBeInTheDocument()
    expect(within(items[0]).getByRole('img', { name: 'Note : 4 sur 5' })).toBeInTheDocument()
    expect(within(items[0]).getByText('2 novembre 2026')).toBeInTheDocument()

    // Réponse du prestataire et mention « modifié » sur le second avis.
    expect(within(items[1]).getByText('Réponse du prestataire')).toBeInTheDocument()
    expect(within(items[1]).getByText('Merci, au plaisir de vous revoir !')).toBeInTheDocument()
    expect(within(items[1]).getByText(/modifié/)).toBeInTheDocument()

    expect(screen.getByRole('img', { name: 'Note : 4,5 sur 5' })).toBeInTheDocument()
    expect(screen.getByText('2 avis')).toBeInTheDocument()
    const bars = screen.getByRole('list', { name: 'Répartition des notes' })
    expect(within(bars).getByText('5 étoiles : 1 avis')).toBeInTheDocument()
    expect(within(bars).getByText('3 étoiles : 0 avis')).toBeInTheDocument()

    expect(onSummaryChange).toHaveBeenCalledWith(expect.objectContaining({ average: 4.5 }))
  })

  it('invite un visiteur à se connecter pour donner son avis', async () => {
    renderReviews()

    expect(
      await screen.findByRole('link', { name: 'Se connecter pour donner mon avis' }),
    ).toHaveAttribute('href', '/connexion')
    expect(screen.queryByRole('group', { name: /Votre note/ })).not.toBeInTheDocument()
  })

  it('indique qu’un prestataire ne peut pas laisser d’avis', async () => {
    renderReviews({ user: PROVIDER })

    expect(
      await screen.findByText('Seuls les voyageurs peuvent laisser un avis.'),
    ).toBeInTheDocument()
  })

  it('affiche un état vide quand le service n’a aucun avis', async () => {
    renderReviews({
      user: TRAVELER,
      routes: { 'GET /services/s1/reviews': () => reviewsPage([]) },
    })

    expect(
      await screen.findByText(
        'Aucun avis pour le moment. Soyez le premier à partager votre expérience !',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Répartition des notes' })).not.toBeInTheDocument()
  })

  it('propose de réessayer si les avis ne se chargent pas', async () => {
    const user = userEvent.setup()
    let attempts = 0
    renderReviews({
      routes: {
        'GET /services/s1/reviews': () => {
          attempts += 1
          return attempts === 1
            ? jsonResponse({ message: 'Service temporairement indisponible.' }, 503)
            : reviewsPage()
        },
      },
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les avis')
    expect(alert).toHaveTextContent('Service temporairement indisponible.')
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('list', { name: 'Avis des voyageurs' })).toBeInTheDocument()
  })

  it('pagine la liste des avis', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderReviews({
      routes: {
        'GET /services/s1/reviews': () => reviewsPage(REVIEWS, { total: 7, pages: 2 }),
      },
    })

    const nav = await screen.findByRole('navigation', { name: 'Pagination des avis' })
    expect(within(nav).getByRole('button', { name: 'Précédent' })).toBeDisabled()
    await user.click(within(nav).getByRole('button', { name: 'Suivant' }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)[0]).toMatch(/\/services\/s1\/reviews\?page=2&limit=5$/),
    )
  })
})

describe('ServiceReviews — publier, modifier, supprimer (US3.5)', () => {
  it('publie l’avis d’un voyageur, avec la note obligatoire', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderReviews({
      user: TRAVELER,
      routes: {
        'POST /services/s1/reviews': () => jsonResponse({ review: MY_REVIEW }, 201),
      },
    })

    const form = (await screen.findByRole('heading', { name: 'Donner mon avis' })).closest('form')
    await user.click(within(form).getByRole('button', { name: 'Publier mon avis' }))
    expect(within(form).getByText('Choisissez une note de 1 à 5 étoiles.')).toBeInTheDocument()
    expect(calls(fetchMock, 'POST', '/services/s1/reviews')).toHaveLength(0)

    await user.click(within(form).getByRole('radio', { name: '4 étoiles' }))
    const textarea = within(form).getByLabelText(/Votre commentaire/)
    await user.type(textarea, 'Très bon séjour')
    expect(within(form).getByText('15 / 1000 caractères')).toBeInTheDocument()
    await user.click(within(form).getByRole('button', { name: 'Publier mon avis' }))

    const [, options] = calls(fetchMock, 'POST', '/services/s1/reviews')[0]
    expect(JSON.parse(options.body)).toEqual({ rating: 4, comment: 'Très bon séjour' })
    expect(await screen.findByText('Merci ! Votre avis est publié.')).toBeInTheDocument()
    // La liste et « votre avis » sont rechargés.
    await waitFor(() => expect(calls(fetchMock, 'GET', '/services/s1/reviews')).toHaveLength(2))
  })

  it('affiche l’erreur de l’API (avis déjà donné, 409)', async () => {
    const user = userEvent.setup()
    renderReviews({
      user: TRAVELER,
      routes: {
        'POST /services/s1/reviews': () =>
          jsonResponse({ message: 'Vous avez déjà laissé un avis sur ce service.' }, 409),
      },
    })

    const form = (await screen.findByRole('heading', { name: 'Donner mon avis' })).closest('form')
    await user.click(within(form).getByRole('radio', { name: '5 étoiles' }))
    await user.click(within(form).getByRole('button', { name: 'Publier mon avis' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Vous avez déjà laissé un avis sur ce service.',
    )
  })

  it('modifie son avis depuis le formulaire prérempli', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderReviews({
      user: TRAVELER,
      routes: {
        'GET /services/s1/reviews/me': () => jsonResponse({ review: MY_REVIEW }),
        'PATCH /reviews/r9': () =>
          jsonResponse({ review: { ...MY_REVIEW, rating: 5, comment: 'Excellent.' } }),
      },
    })

    const mine = (await screen.findByRole('heading', { name: 'Votre avis' })).parentElement
    expect(within(mine).getByText('Correct.')).toBeInTheDocument()
    await user.click(within(mine).getByRole('button', { name: 'Modifier' }))

    const form = screen.getByRole('heading', { name: 'Modifier mon avis' }).closest('form')
    expect(within(form).getByRole('radio', { name: '3 étoiles' })).toBeChecked()
    const textarea = within(form).getByLabelText(/Votre commentaire/)
    expect(textarea).toHaveValue('Correct.')

    await user.click(within(form).getByRole('radio', { name: '5 étoiles' }))
    await user.clear(textarea)
    await user.type(textarea, 'Excellent.')
    await user.click(within(form).getByRole('button', { name: 'Enregistrer' }))

    const [, options] = calls(fetchMock, 'PATCH', '/reviews/r9')[0]
    expect(JSON.parse(options.body)).toEqual({ rating: 5, comment: 'Excellent.' })
    expect(await screen.findByText('Votre avis est modifié.')).toBeInTheDocument()
  })

  it('annule la modification sans rien envoyer', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderReviews({
      user: TRAVELER,
      routes: { 'GET /services/s1/reviews/me': () => jsonResponse({ review: MY_REVIEW }) },
    })

    await user.click(await screen.findByRole('button', { name: 'Modifier' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.getByRole('heading', { name: 'Votre avis' })).toBeInTheDocument()
    expect(calls(fetchMock, 'PATCH', '/reviews/r9')).toHaveLength(0)
  })

  it('supprime son avis après confirmation', async () => {
    const user = userEvent.setup()
    const { fetchMock } = renderReviews({
      user: TRAVELER,
      routes: {
        'GET /services/s1/reviews/me': () => jsonResponse({ review: MY_REVIEW }),
        'DELETE /reviews/r9': () => jsonResponse(null, 204),
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    const dialog = screen.getByRole('dialog', { name: 'Supprimer votre avis ?' })
    // Rien n'est supprimé avant la confirmation.
    expect(calls(fetchMock, 'DELETE', '/reviews/r9')).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Votre avis est supprimé.')).toBeInTheDocument()
    expect(calls(fetchMock, 'DELETE', '/reviews/r9')).toHaveLength(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
