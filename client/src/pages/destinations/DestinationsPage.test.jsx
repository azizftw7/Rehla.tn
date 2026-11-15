import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, LocationDisplay } from '../../test/utils.jsx'
import DestinationsPage from './DestinationsPage.jsx'

// Leaflet ne fonctionne pas dans jsdom : la carte est remplacée par un composant qui expose ses props.
vi.mock('../../components/DestinationsMap.jsx', () => ({
  default: function DestinationsMapMock({ destinations, selectedSlug }) {
    return (
      <div
        data-testid="destinations-map"
        data-destinations={destinations.map((d) => d.slug).join(',')}
        data-selected={selectedSlug ?? ''}
      />
    )
  },
}))

const DESTINATIONS = [
  {
    _id: 'd1',
    name: 'Djerba',
    slug: 'djerba',
    region: 'Médenine',
    description: 'L’île aux plages.',
    location: { type: 'Point', coordinates: [10.86, 33.81] },
  },
  {
    _id: 'd2',
    name: 'Tozeur',
    slug: 'tozeur',
    region: 'Tozeur',
    description: 'Porte du désert.',
    location: { type: 'Point', coordinates: [8.13, 33.92] },
  },
]

const list = (items) => jsonResponse({ items, total: items.length, page: 1, pages: 1 })

/**
 * Simule l'API : la grille (limit=12) et la carte (limit=100) ont chacune leur file de réponses.
 * Une fois la file vide, la dernière réponse est réutilisée.
 */
function mockApi({ grid = [list(DESTINATIONS)], map = [list(DESTINATIONS)] } = {}) {
  const queues = { grid: [...grid], map: [...map] }
  const take = (name) => (queues[name].length > 1 ? queues[name].shift() : queues[name][0])
  const fetchMock = vi.fn((url) => {
    const next = take(url.includes('limit=100') ? 'map' : 'grid')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(route = '/destinations') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path="/destinations"
          element={
            <>
              <DestinationsPage />
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const compactList = () => screen.findByRole('list', { name: /Sur la carte/ })

describe('DestinationsPage', () => {
  it('affiche la grille paginée et la carte de toutes les destinations', async () => {
    const fetchMock = mockApi()
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Toutes les destinations' }),
    ).toBeInTheDocument()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('link', { name: 'Djerba' })).toHaveAttribute(
      'href',
      '/destinations/djerba',
    )
    expect(screen.getByText('2 destinations')).toBeInTheDocument()

    await compactList()
    expect(await screen.findByTestId('destinations-map')).toHaveAttribute(
      'data-destinations',
      'djerba,tozeur',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/destinations?page=1&limit=12'),
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/destinations\?limit=100$/),
      expect.any(Object),
    )
  })

  it('transmet à la carte les destinations de la recherche (URL puis formulaire)', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      grid: [list([DESTINATIONS[0]]), list([DESTINATIONS[1]])],
      map: [list([DESTINATIONS[0]]), list([DESTINATIONS[1]])],
    })
    renderPage('/destinations?search=djer&types=hebergement')

    const map = await screen.findByTestId('destinations-map')
    await compactList()
    expect(map).toHaveAttribute('data-destinations', 'djerba')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/destinations\?search=djer&limit=100$/),
      expect.any(Object),
    )
    const input = screen.getByLabelText('Rechercher une destination')
    expect(input).toHaveValue('djer')

    await user.clear(input)
    await user.type(input, 'tozeur')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/destinations?search=tozeur')
    expect(await screen.findByRole('link', { name: 'Tozeur' })).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'Voir Tozeur sur la carte' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('destinations-map')).toHaveAttribute('data-destinations', 'tozeur')
  })

  it('sélectionne une destination sur la carte depuis la liste compacte', async () => {
    const user = userEvent.setup()
    mockApi()
    renderPage()

    const list = await compactList()
    expect(within(list).getByText('Médenine')).toBeInTheDocument()

    const button = within(list).getByRole('button', { name: 'Voir Tozeur sur la carte' })
    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('destinations-map')).toHaveAttribute('data-selected', 'tozeur')
  })

  it('affiche « aucun résultat » (grille et carte) et permet d’effacer la recherche', async () => {
    const user = userEvent.setup()
    mockApi({ grid: [list([]), list(DESTINATIONS)], map: [list([]), list(DESTINATIONS)] })
    renderPage('/destinations?search=atlantide')

    expect(
      await screen.findByRole('heading', {
        name: 'Aucune destination ne correspond à « atlantide »',
      }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Aucun résultat pour « atlantide ».')).toBeInTheDocument()
    expect(screen.getByTestId('destinations-map')).toHaveAttribute('data-destinations', '')

    const buttons = screen.getAllByRole('button', { name: 'Effacer la recherche' })
    await user.click(buttons[buttons.length - 1])

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/destinations$/)
    expect(await screen.findAllByRole('article')).toHaveLength(2)
  })

  it('affiche une erreur et relance la requête avec « Réessayer »', async () => {
    const user = userEvent.setup()
    const failure = new TypeError('Failed to fetch')
    const fetchMock = mockApi({
      grid: [failure, list(DESTINATIONS)],
      map: [failure, list(DESTINATIONS)],
    })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les destinations')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findAllByRole('article')).toHaveLength(2)
    await compactList()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
