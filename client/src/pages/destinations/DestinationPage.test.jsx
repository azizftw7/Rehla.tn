import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../../test/utils.jsx'
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

function mockApi({ destination = jsonResponse({ destination: DESTINATION }), services = [] } = {}) {
  const queue = [...services]
  const fetchMock = vi.fn((url) => {
    if (url.includes('/destinations/')) {
      return destination instanceof Error
        ? Promise.reject(destination)
        : Promise.resolve(destination)
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
        <Route path="/destinations/:slug" element={<DestinationPage />} />
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
      expect.stringContaining('type=restaurant'),
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
})
