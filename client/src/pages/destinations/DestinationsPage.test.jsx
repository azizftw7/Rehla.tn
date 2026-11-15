import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, LocationDisplay } from '../../test/utils.jsx'
import DestinationsPage from './DestinationsPage.jsx'

const DESTINATIONS = [
  {
    _id: 'd1',
    name: 'Djerba',
    slug: 'djerba',
    region: 'Médenine',
    description: 'L’île aux plages.',
  },
  { _id: 'd2', name: 'Tozeur', slug: 'tozeur', region: 'Tozeur', description: 'Porte du désert.' },
]

const list = (items, extra = {}) =>
  jsonResponse({ items, total: items.length, page: 1, pages: 1, ...extra })

function mockApi(responses) {
  const queue = [...responses]
  const fetchMock = vi.fn(() => {
    const next = queue.shift() ?? list([])
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

describe('DestinationsPage', () => {
  it('affiche la liste des destinations', async () => {
    const fetchMock = mockApi([list(DESTINATIONS)])
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
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/destinations?page=1&limit=12'),
      expect.any(Object),
    )
  })

  it('lit la recherche dans l’URL et la met à jour à l’envoi du formulaire', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi([list([DESTINATIONS[0]]), list([DESTINATIONS[1]])])
    renderPage('/destinations?search=djer&types=hebergement')

    await screen.findAllByRole('article')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/destinations?search=djer&page=1&limit=12'),
      expect.any(Object),
    )
    const input = screen.getByLabelText('Rechercher une destination')
    expect(input).toHaveValue('djer')

    await user.clear(input)
    await user.type(input, 'tozeur')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/destinations?search=tozeur')
    expect(await screen.findByRole('link', { name: 'Tozeur' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('search=tozeur'),
      expect.any(Object),
    )
  })

  it('affiche « aucun résultat » et permet d’effacer la recherche', async () => {
    const user = userEvent.setup()
    mockApi([list([]), list(DESTINATIONS)])
    renderPage('/destinations?search=atlantide')

    expect(
      await screen.findByRole('heading', {
        name: 'Aucune destination ne correspond à « atlantide »',
      }),
    ).toBeInTheDocument()

    const buttons = screen.getAllByRole('button', { name: 'Effacer la recherche' })
    await user.click(buttons[buttons.length - 1])

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/destinations$/)
    expect(await screen.findAllByRole('article')).toHaveLength(2)
  })

  it('affiche une erreur et relance la requête avec « Réessayer »', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi([new TypeError('Failed to fetch'), list(DESTINATIONS)])
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les destinations')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findAllByRole('article')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
