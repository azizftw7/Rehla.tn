import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { formatDayMonth, formatStay } from '../../lib/tripSharesApi.js'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import TripSharePage from './TripSharePage.jsx'

const DAY_MS = 24 * 60 * 60 * 1000
const day = (offset) => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10)
const iso = (offset) => `${day(offset)}T00:00:00.000Z`

const USER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur', profile: 'etudiant' }
const DESTINATIONS = [
  { _id: 'd1', name: 'Djerba', slug: 'djerba' },
  { _id: 'd2', name: 'Tozeur', slug: 'tozeur' },
]
const MY_SHARE = {
  _id: 't1',
  destination: { _id: 'd1', name: 'Djerba', slug: 'djerba' },
  startDate: iso(12),
  endDate: iso(18),
  expiresAt: iso(19),
  message: 'Un louage depuis Tunis ?',
  city: 'Tunis',
  languages: ['Français'],
  visible: { profile: true, city: true, languages: true, photo: false },
  travelersCount: 2,
  updatedAt: '2026-11-20T10:00:00.000Z',
}
const CO_TRAVELERS = [
  {
    _id: 'k1',
    name: 'Youssef H.',
    profile: 'resident',
    city: 'Sfax',
    languages: ['Arabe'],
    startDate: iso(14),
    endDate: iso(20),
    message: 'Kayak ?',
    overlapDays: 5,
  },
  { _id: 'k2', name: 'Nour A.', startDate: iso(15), endDate: iso(16), overlapDays: 2 },
]

const page = (items, extra = {}) =>
  jsonResponse({ items, total: items.length, page: 1, pages: items.length ? 1 : 0, ...extra })

function renderPage(routes = {}) {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  const fetchMock = mockApi({
    'GET /users/me': () => jsonResponse({ user: USER }),
    'GET /destinations': () => page(DESTINATIONS),
    'GET /trip-shares/me': () => page([]),
    'GET /trip-shares/t1/co-voyageurs': () =>
      page(CO_TRAVELERS, {
        destination: { name: 'Djerba' },
        languages: ['Arabe'],
      }),
    ...routes,
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/partage']}>
        <TripSharePage />
      </MemoryRouter>
    </AuthProvider>,
  )
  return fetchMock
}

const calls = (fetchMock, method, path) =>
  fetchMock.mock.calls.filter(
    ([url, options = {}]) =>
      (options.method || 'GET') === method && new URL(url).pathname === `/api${path}`,
  )

async function fillForm({ start = day(12), end = day(18) } = {}) {
  const destination = await screen.findByRole('combobox', { name: 'Destination' })
  await waitFor(() => expect(destination).not.toBeDisabled())
  fireEvent.change(destination, { target: { value: 'd1' } })
  fireEvent.change(screen.getByLabelText('Date d’aller'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('Date de retour'), { target: { value: end } })
}

describe('TripSharePage — publication et aperçu (US5.3)', () => {
  it('affiche l’en-tête, le formulaire, l’aperçu et la section verrouillée', async () => {
    renderPage()

    expect(screen.getByText('Partage de voyage')).toHaveClass('surtitre')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Partager mon déplacement' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Prénom et initiale (toujours visibles)' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Profil' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Publier mon partage' })).toBeInTheDocument()

    const preview = screen.getByRole('complementary', { name: 'Ce que les autres voient' })
    expect(await within(preview).findByRole('heading', { name: 'Amel T.' })).toBeInTheDocument()
    expect(within(preview).getByRole('note')).toHaveTextContent(
      'Vos coordonnées restent privées : jamais d’e-mail ni de téléphone.',
    )

    expect(
      await screen.findByText(/Publiez votre partage pour voir les voyageurs/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Vous n’avez aucun partage en cours/)).toBeInTheDocument()
  })

  it('met l’aperçu à jour en direct selon les cases cochées', async () => {
    const user = userEvent.setup()
    renderPage()
    const preview = screen.getByRole('complementary', { name: 'Ce que les autres voient' })
    await within(preview).findByText('Étudiant')

    await fillForm()
    expect(within(preview).getByText('Djerba')).toBeInTheDocument()
    expect(within(preview).getByText(formatStay(day(12), day(18)))).toBeInTheDocument()
    const expiry = formatDayMonth(new Date(Date.parse(iso(19))))
    expect(within(preview).getByRole('note')).toHaveTextContent(`le ${expiry}`)

    await user.type(screen.getByLabelText(/Message/), 'Un louage ?')
    expect(within(preview).getByText('« Un louage ? »')).toBeInTheDocument()
    expect(screen.getByText('11 / 200 caractères')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Profil' }))
    expect(within(preview).queryByText('Étudiant')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Ville de départ' }))
    await user.type(screen.getByRole('textbox', { name: 'Ville de départ' }), 'Tunis')
    expect(within(preview).getByText('Tunis')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Langues parlées' }))
    await user.click(screen.getByRole('checkbox', { name: 'Arabe' }))
    expect(within(preview).getByRole('list', { name: 'Langues parlées' })).toHaveTextContent(
      'Arabe',
    )
  })

  it('signale les erreurs avant l’envoi', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage()
    await screen.findByRole('option', { name: 'Djerba' })

    await user.click(screen.getByRole('button', { name: 'Publier mon partage' }))
    expect(screen.getByText('Choisissez une destination.')).toBeInTheDocument()
    expect(screen.getByText("La date d'aller est obligatoire.")).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Destination' })).toHaveFocus()

    await fillForm({ start: day(12), end: day(12) })
    await user.click(screen.getByRole('checkbox', { name: 'Ville de départ' }))
    await user.click(screen.getByRole('button', { name: 'Publier mon partage' }))
    expect(
      screen.getByText("La date de retour doit être postérieure à la date d'aller."),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Indiquez votre ville de départ, ou décochez « Ville de départ ».'),
    ).toBeInTheDocument()
    expect(calls(fetchMock, 'POST', '/trip-shares')).toHaveLength(0)
  })

  it('publie le partage puis affiche les co-voyageurs et « Mes partages »', async () => {
    const user = userEvent.setup()
    let shares = []
    let sent
    const fetchMock = renderPage({
      'GET /trip-shares/me': () => page(shares),
      'POST /trip-shares': (body) => {
        sent = body
        shares = [MY_SHARE]
        return jsonResponse({ tripShare: MY_SHARE }, 201)
      },
    })

    await fillForm()
    await user.type(screen.getByLabelText(/Message/), '  Un louage ?  ')
    await user.click(screen.getByRole('button', { name: 'Publier mon partage' }))

    expect(await screen.findByText(/Votre partage est publié/)).toBeInTheDocument()
    expect(sent).toEqual({
      destination: 'd1',
      startDate: day(12),
      endDate: day(18),
      message: 'Un louage ?',
      visible: { profile: true, city: false, languages: false, photo: false },
    })

    expect(
      await screen.findByRole('heading', { name: '2 voyageurs à Djerba sur vos dates' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Visible parce que vous partagez vous aussi votre séjour.'),
    ).toBeInTheDocument()
    const grid = screen.getByRole('list', { name: 'Voyageurs à Djerba' })
    expect(within(grid).getAllByRole('article')).toHaveLength(2)
    expect(within(grid).getByText('5 jours en commun')).toBeInTheDocument()
    expect(calls(fetchMock, 'GET', '/trip-shares/t1/co-voyageurs').length).toBeGreaterThan(0)

    const mine = screen.getByRole('list', { name: 'Mes partages' })
    expect(within(mine).getByText(`Djerba · ${formatStay(iso(12), iso(18))}`)).toBeInTheDocument()
    expect(within(mine).getByText(/Visible par 2 voyageurs · s’efface le/)).toBeInTheDocument()
    expect(within(mine).getByText('Visible')).toBeInTheDocument()
  })
})

describe('TripSharePage — co-voyageurs (US5.4)', () => {
  it('filtre par profil, langue et « 3 jours en commun ou plus »', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({ 'GET /trip-shares/me': () => page([MY_SHARE]) })
    await screen.findByRole('list', { name: 'Voyageurs à Djerba' })

    const lastQuery = () =>
      new URL(calls(fetchMock, 'GET', '/trip-shares/t1/co-voyageurs').at(-1)[0]).searchParams

    await user.click(screen.getByRole('button', { name: 'Résident' }))
    await waitFor(() => expect(lastQuery().get('profile')).toBe('resident'))
    expect(screen.getByRole('button', { name: 'Résident' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(await screen.findByRole('button', { name: 'Arabe' }))
    await waitFor(() => expect(lastQuery().get('language')).toBe('Arabe'))

    await user.click(screen.getByRole('button', { name: '3 jours en commun ou plus' }))
    await waitFor(() => expect(lastQuery().get('minDays')).toBe('3'))
  })

  it('affiche un état vide avec « Effacer les filtres »', async () => {
    const user = userEvent.setup()
    renderPage({
      'GET /trip-shares/me': () => page([MY_SHARE]),
      'GET /trip-shares/t1/co-voyageurs': () =>
        page([], { destination: { name: 'Djerba' }, languages: [] }),
    })
    expect(
      await screen.findByRole('heading', {
        name: 'Personne d’autre à Djerba sur vos dates pour l’instant',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Touriste' }))
    expect(
      await screen.findByRole('heading', { name: 'Aucun voyageur ne correspond à ces filtres' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(screen.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('affiche l’erreur de chargement avec « Réessayer »', async () => {
    renderPage({
      'GET /trip-shares/me': () => page([MY_SHARE]),
      'GET /trip-shares/t1/co-voyageurs': () =>
        jsonResponse({ message: 'Serveur indisponible.' }, 503),
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Serveur indisponible.')
    expect(within(alert).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

describe('TripSharePage — mes partages', () => {
  it('modifie un partage (formulaire prérempli, PUT)', async () => {
    const user = userEvent.setup()
    let sent
    renderPage({
      'GET /trip-shares/me': () => page([MY_SHARE]),
      'PUT /trip-shares/t1': (body) => {
        sent = body
        return jsonResponse({ tripShare: { ...MY_SHARE, message: body.message } })
      },
    })
    const label = `Djerba · ${formatStay(iso(12), iso(18))}`
    await user.click(await screen.findByRole('button', { name: `Modifier le partage ${label}` }))

    expect(screen.getByRole('heading', { name: 'Modifier mon partage' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/)).toHaveValue('Un louage depuis Tunis ?')
    expect(screen.getByRole('textbox', { name: 'Ville de départ' })).toHaveValue('Tunis')
    expect(screen.getByRole('checkbox', { name: 'Français' })).toBeChecked()

    await user.clear(screen.getByLabelText(/Message/))
    await user.type(screen.getByLabelText(/Message/), 'Nouveau message')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByText('Votre partage est modifié.')).toBeInTheDocument()
    expect(sent).toMatchObject({
      destination: 'd1',
      startDate: day(12),
      endDate: day(18),
      message: 'Nouveau message',
      city: 'Tunis',
      languages: ['Français'],
    })
    expect(screen.getByRole('heading', { name: 'Mon déplacement' })).toBeInTheDocument()
  })

  it('supprime un partage après confirmation', async () => {
    const user = userEvent.setup()
    let shares = [MY_SHARE]
    const fetchMock = renderPage({
      'GET /trip-shares/me': () => page(shares),
      'DELETE /trip-shares/t1': () => {
        shares = []
        return { ok: true, status: 204, json: async () => null }
      },
    })
    const label = `Djerba · ${formatStay(iso(12), iso(18))}`
    await user.click(await screen.findByRole('button', { name: `Supprimer le partage ${label}` }))

    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce partage ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(calls(fetchMock, 'DELETE', '/trip-shares/t1')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: `Supprimer le partage ${label}` }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))

    expect(
      await screen.findByText('Votre partage à Djerba est supprimé.'),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Vous n’avez aucun partage en cours/)).toBeInTheDocument()
    expect(screen.getByText(/Publiez votre partage pour voir les voyageurs/)).toBeInTheDocument()
  })
})
