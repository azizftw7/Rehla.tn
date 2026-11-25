import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, LocationDisplay } from '../../test/utils.jsx'
import DestinationPage from './DestinationPage.jsx'

// Leaflet ne fonctionne pas dans jsdom : la carte est remplacée par un composant qui expose ses props.
vi.mock('../../components/ServicesMap.jsx', () => ({
  default: function ServicesMapMock({ center, services, selectedId }) {
    return (
      <div
        data-testid="services-map"
        data-center={JSON.stringify(center)}
        data-selected={selectedId ?? ''}
        data-markers={services.map((s) => s._id).join(',')}
      />
    )
  },
}))

const DESTINATION = {
  _id: 'd1',
  name: 'Sidi Bou Saïd',
  slug: 'sidi-bou-said',
  region: 'Tunis',
  description: 'Le village bleu et blanc qui domine le golfe de Tunis.',
  location: { type: 'Point', coordinates: [10.3417, 36.8687] },
}

const SERVICES = [
  {
    _id: 's1',
    type: 'hebergement',
    name: 'Dar Yasmine',
    price: { amount: 180, unit: 'nuit' },
    free: false,
    location: { type: 'Point', coordinates: [10.34, 36.87] },
  },
  {
    _id: 's2',
    type: 'restaurant',
    name: 'Café des Nattes',
    free: true,
    location: { type: 'Point', coordinates: [10.341, 36.869] },
  },
]

const TRANSPORTS = [
  {
    _id: 't1',
    type: 'train',
    from: 'Tunis Marine',
    to: 'Sidi Bou Saïd',
    price: 1,
    duration: 35,
    schedule: 'Toutes les 15 à 20 minutes',
    operator: 'Train de banlieue nord',
    source: 'Données de démonstration',
    sourceUpdatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    _id: 't2',
    type: 'louage',
    from: 'Tunis',
    to: 'Sidi Bou Saïd',
    price: 3,
    duration: 30,
  },
]

function mockApi({
  destination = jsonResponse({ destination: DESTINATION }),
  services = [],
  transports = [],
} = {}) {
  const queue = [...services]
  const transportsQueue = [...transports]
  const fetchMock = vi.fn((url) => {
    if (url.includes('/destinations/')) {
      return destination instanceof Error
        ? Promise.reject(destination)
        : Promise.resolve(destination)
    }
    if (url.includes('/transports')) {
      const next =
        transportsQueue.shift() ?? jsonResponse({ items: [], total: 0, page: 1, pages: 0 })
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    }
    const next = queue.shift() ?? jsonResponse({ items: [], total: 0, page: 1, pages: 0 })
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(route = '/destinations/sidi-bou-said') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/destinations/:slug"
          element={
            <>
              <DestinationPage />
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const page = (items) => jsonResponse({ items, total: items.length, page: 1, pages: 1 })

describe('DestinationPage', () => {
  it('affiche la destination, la carte centrée sur elle et la liste des services', async () => {
    const fetchMock = mockApi({ services: [page(SERVICES)] })
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sidi Bou Saïd' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Tunis')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Toutes les destinations' })).toHaveAttribute(
      'href',
      '/destinations',
    )
    expect(screen.getByText(/village bleu et blanc/)).toBeInTheDocument()

    const map = await screen.findByTestId('services-map')
    // GeoJSON [longitude, latitude] → Leaflet [latitude, longitude]
    expect(map).toHaveAttribute('data-center', JSON.stringify([36.8687, 10.3417]))

    const list = await screen.findByRole('list', { name: 'Services de la destination' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Hébergement')).toBeInTheDocument()
    expect(within(items[0]).getByRole('link', { name: 'Dar Yasmine' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    expect(within(items[0]).getByText(/180 DT/)).toBeInTheDocument()
    expect(within(items[1]).getByText('Gratuit')).toBeInTheDocument()
    expect(map).toHaveAttribute('data-markers', 's1,s2')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/services?destination=sidi-bou-said&limit=100'),
      expect.any(Object),
    )
  })

  it('filtre les services par onglet de catégorie', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({ services: [page(SERVICES), page([SERVICES[1]])] })
    renderPage()
    await screen.findByRole('list', { name: 'Services de la destination' })

    const tab = screen.getByRole('button', { name: 'Restaurants' })
    await user.click(tab)

    expect(tab).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('types=restaurant'),
      expect.any(Object),
    )
    expect(await screen.findByText('1 adresse · Restaurants')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Services de la destination' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByTestId('services-map')).toHaveAttribute('data-markers', 's2')
  })

  it('sélectionne un service sur la carte depuis la liste', async () => {
    const user = userEvent.setup()
    mockApi({ services: [page(SERVICES)] })
    renderPage()
    await screen.findByRole('list', { name: 'Services de la destination' })

    const button = screen.getByRole('button', { name: 'Voir Café des Nattes sur la carte' })
    await user.click(button)

    expect(screen.getByTestId('services-map')).toHaveAttribute('data-selected', 's2')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('affiche « Destination introuvable » avec un lien vers l’accueil (404)', async () => {
    mockApi({ destination: jsonResponse({ message: 'Destination introuvable.' }, 404) })
    renderPage('/destinations/atlantide')

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByRole('heading', { name: 'Destination introuvable' }),
    ).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('propose de réessayer si le serveur est injoignable', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({ destination: new TypeError('Failed to fetch') })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger cette destination')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur.')

    fetchMock.mockImplementation((url) =>
      Promise.resolve(
        url.includes('/destinations/')
          ? jsonResponse({ destination: DESTINATION })
          : page(SERVICES),
      ),
    )
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sidi Bou Saïd' }),
    ).toBeInTheDocument()
  })

  it('affiche un message quand la catégorie ne contient aucun service', async () => {
    mockApi({ services: [page([])] })
    renderPage('/destinations/sidi-bou-said?type=guide')

    expect(
      await screen.findByText('Aucun service dans cette catégorie pour le moment.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guides locaux' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  describe('onglet Transports (US4.1)', () => {
    it('affiche les transports à la place des services, carte centrée sur la destination', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ services: [page(SERVICES)], transports: [page(TRANSPORTS)] })
      renderPage()
      await screen.findByRole('list', { name: 'Services de la destination' })

      const tab = screen.getByRole('button', { name: 'Transports' })
      await user.click(tab)
      expect(tab).toHaveAttribute('aria-pressed', 'true')

      const list = await screen.findByRole('list', {
        name: 'Transports pour rejoindre Sidi Bou Saïd',
      })
      expect(within(list).getAllByRole('article')).toHaveLength(2)
      expect(
        within(list).getByRole('heading', { name: 'Tunis Marine → Sidi Bou Saïd' }),
      ).toBeInTheDocument()
      expect(within(list).getByText('Train de banlieue nord')).toBeInTheDocument()
      expect(within(list).getByText('1 DT')).toBeInTheDocument()
      expect(within(list).getByText('35 min')).toBeInTheDocument()
      expect(
        within(list).getByText('Source : Données de démonstration · mis à jour le 1 octobre 2026'),
      ).toBeInTheDocument()
      expect(screen.getByText('2 transports')).toBeInTheDocument()
      expect(
        screen.queryByRole('list', { name: 'Services de la destination' }),
      ).not.toBeInTheDocument()

      const map = screen.getByTestId('services-map')
      expect(map).toHaveAttribute('data-markers', '')
      expect(map).toHaveAttribute('data-center', JSON.stringify([36.8687, 10.3417]))

      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/transports\?destination=sidi-bou-said&limit=100$/),
        expect.any(Object),
      )
    })

    it('filtre les transports par type', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ transports: [page(TRANSPORTS), page([TRANSPORTS[1]])] })
      renderPage('/destinations/sidi-bou-said?type=transport')
      await screen.findByRole('list', { name: 'Transports pour rejoindre Sidi Bou Saïd' })

      const group = screen.getByRole('group', { name: 'Filtrer par type de transport' })
      const louage = within(group).getByRole('button', { name: 'Louage' })
      await user.click(louage)

      expect(louage).toHaveAttribute('aria-pressed', 'true')
      expect(within(group).getByRole('button', { name: 'Tous' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/transports?destination=sidi-bou-said&type=louage'),
        expect.any(Object),
      )
      expect(await screen.findByText('1 transport · Louages')).toBeInTheDocument()
    })

    it('affiche un état vide quand aucun transport n’est référencé', async () => {
      const user = userEvent.setup()
      mockApi({ transports: [page([]), page(TRANSPORTS)] })
      renderPage('/destinations/sidi-bou-said?type=transport&mode=ferry')

      expect(
        await screen.findByText('Aucun transport référencé pour cette destination.'),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Voir tous les transports' }))
      expect(await screen.findByText('2 transports')).toBeInTheDocument()
    })

    it('propose de réessayer si les transports ne se chargent pas', async () => {
      const user = userEvent.setup()
      mockApi({
        transports: [
          jsonResponse({ message: 'Service momentanément indisponible.' }, 503),
          page(TRANSPORTS),
        ],
      })
      renderPage('/destinations/sidi-bou-said?type=transport')

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Impossible de charger les transports')
      expect(alert).toHaveTextContent('Service momentanément indisponible.')

      await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))
      expect(
        await screen.findByRole('list', { name: 'Transports pour rejoindre Sidi Bou Saïd' }),
      ).toBeInTheDocument()
    })
  })

  describe('filtres multicritères (US2.3)', () => {
    const lastServicesUrl = (fetchMock) =>
      fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes('/services?')).at(-1)

    it('sélectionne plusieurs catégories à la fois et les garde dans l’URL', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ services: [page(SERVICES), page([SERVICES[0]]), page(SERVICES)] })
      renderPage()
      await screen.findByRole('list', { name: 'Services de la destination' })

      const group = screen.getByRole('group', { name: 'Filtrer par catégorie' })
      await user.click(within(group).getByRole('button', { name: 'Hébergements' }))
      await user.click(within(group).getByRole('button', { name: 'Restaurants' }))

      expect(within(group).getByRole('button', { name: 'Hébergements' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(within(group).getByRole('button', { name: 'Restaurants' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(within(group).getByRole('button', { name: 'Tous' })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
      expect(lastServicesUrl(fetchMock)).toContain('types=hebergement%2Crestaurant')
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/destinations/sidi-bou-said?types=hebergement%2Crestaurant',
      )
      // La carte reçoit les résultats : elle se recadre sur eux.
      expect(await screen.findByText('2 adresses')).toBeInTheDocument()
      expect(screen.getByTestId('services-map')).toHaveAttribute('data-markers', 's1,s2')
    })

    it('applique les filtres avancés lus dans l’URL', async () => {
      const fetchMock = mockApi({ services: [page([SERVICES[0]])] })
      renderPage(
        '/destinations/sidi-bou-said?types=hebergement&maxPrice=200&minRating=4&accommodationType=dar',
      )

      expect(await screen.findByText('1 adresse · Hébergements · 3 filtres')).toBeInTheDocument()
      expect(lastServicesUrl(fetchMock)).toContain(
        'types=hebergement&maxPrice=200&minRating=4&accommodationType=dar',
      )
      // Des filtres actifs : le panneau est ouvert et affiche les valeurs de l'URL.
      const toggle = screen.getByRole('button', { name: /Filtres/ })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(toggle).toHaveTextContent('3 actifs')
      expect(screen.getByLabelText('Prix')).toHaveValue('200')
      expect(screen.getByLabelText('Note minimale')).toHaveValue('4')
      expect(screen.getByLabelText('Type d’hébergement')).toHaveValue('dar')
      // Filtres propres aux autres types : masqués quand seuls les hébergements sont affichés.
      expect(screen.queryByLabelText('Catégorie d’activité')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Événements du')).not.toBeInTheDocument()
    })

    it('ouvre les filtres et envoie prix et note à l’API', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ services: [page(SERVICES), page(SERVICES), page([SERVICES[1]])] })
      renderPage()
      await screen.findByRole('list', { name: 'Services de la destination' })

      const toggle = screen.getByRole('button', { name: /Filtres/ })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')

      await user.selectOptions(screen.getByLabelText('Prix'), 'Gratuit uniquement')
      await user.selectOptions(screen.getByLabelText('Note minimale'), '4 étoiles et plus')

      expect(lastServicesUrl(fetchMock)).toContain('free=true&minRating=4')
      expect(screen.getByTestId('location')).toHaveTextContent('?free=true&minRating=4')
      expect(await screen.findByText('1 adresse · 2 filtres')).toBeInTheDocument()
    })

    it('filtre les guides par langue (US4.2)', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ services: [page([]), page([])] })
      renderPage('/destinations/sidi-bou-said?types=guide&language=espagnol')

      expect(await screen.findByText(/1 filtre/)).toBeInTheDocument()
      expect(lastServicesUrl(fetchMock)).toContain('types=guide&language=espagnol')
      const select = screen.getByLabelText('Langue du guide')
      expect(select).toHaveValue('Espagnol')
      // Filtre propre aux guides : les filtres des hébergements ne s'affichent pas.
      expect(screen.queryByLabelText('Type d’hébergement')).not.toBeInTheDocument()

      await user.selectOptions(select, 'Allemand')
      expect(lastServicesUrl(fetchMock)).toContain('language=Allemand')
      expect(screen.getByTestId('location')).toHaveTextContent('language=Allemand')
    })

    it('n’envoie pas une période incohérente et l’explique', async () => {
      const fetchMock = mockApi({ services: [page([])] })
      renderPage('/destinations/sidi-bou-said?types=evenement&from=2026-12-10&to=2026-12-01')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La date de fin doit être postérieure ou égale à la date de début.',
      )
      expect(screen.getByLabelText('au')).toHaveAttribute('aria-invalid', 'true')
      expect(lastServicesUrl(fetchMock)).not.toContain('from=')
    })

    it('propose d’effacer les filtres quand rien ne correspond', async () => {
      const user = userEvent.setup()
      const fetchMock = mockApi({ services: [page([]), page([SERVICES[1]])] })
      renderPage('/destinations/sidi-bou-said?types=restaurant&minRating=4.5')

      expect(
        await screen.findByRole('heading', { name: 'Aucun service ne correspond à ces filtres.' }),
      ).toBeInTheDocument()
      const state = screen
        .getByRole('heading', { name: 'Aucun service ne correspond à ces filtres.' })
        .closest('div')
      await user.click(within(state).getByRole('button', { name: 'Effacer les filtres' }))

      // Les catégories choisies restent, seuls les filtres avancés sont effacés.
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/destinations/sidi-bou-said?types=restaurant',
      )
      expect(lastServicesUrl(fetchMock)).not.toContain('minRating')
      expect(await screen.findByText('1 adresse · Restaurants')).toBeInTheDocument()
    })
  })
})
