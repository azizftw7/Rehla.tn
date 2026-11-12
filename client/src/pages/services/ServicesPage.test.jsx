import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../../test/utils.jsx'
import ServicesPage from './ServicesPage.jsx'

const DESTINATIONS = [
  { _id: 'd1', name: 'Sidi Bou Saïd', slug: 'sidi-bou-said', region: 'Tunis' },
  { _id: 'd2', name: 'Djerba', slug: 'djerba', region: 'Médenine' },
]

const RESTAURANTS = [
  {
    _id: 's1',
    type: 'restaurant',
    name: 'Dar Zarrouk',
    description: 'Poissons grillés face à la baie.',
    destination: { name: 'Sidi Bou Saïd', slug: 'sidi-bou-said' },
    cuisine: 'Fruits de mer',
    price: { amount: 65, unit: 'repas' },
    free: false,
    ratingAverage: 4.8,
    ratingCount: 12,
    photos: ['https://placehold.co/480x360?text=Dar+Zarrouk'],
  },
  {
    _id: 's2',
    type: 'restaurant',
    name: 'Café des Nattes',
    destination: { name: 'Sidi Bou Saïd', slug: 'sidi-bou-said' },
    free: true,
    ratingAverage: 0,
    ratingCount: 0,
    photos: [],
  },
]

function renderServicesPage(initialEntry = '/services?type=restaurant') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/services" element={<ServicesPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockServicesApi(serviceResponses = []) {
  const queue = [...serviceResponses]
  const fetchMock = vi.fn((url) => {
    if (url.includes('/destinations')) {
      return Promise.resolve(jsonResponse({ items: DESTINATIONS, total: 2, page: 1, pages: 1 }))
    }
    const next = queue.shift()
    if (!next) {
      return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, pages: 0 }))
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ServicesPage', () => {
  it('affiche les cartes de restaurants avec prix, note et destination', async () => {
    mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
    ])

    renderServicesPage('/services?type=restaurant')

    expect(await screen.findByRole('heading', { level: 1, name: 'Restaurants' })).toBeInTheDocument()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(2)

    expect(within(cards[0]).getByRole('link', { name: 'Dar Zarrouk' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    expect(within(cards[0]).getByText(/65 DT/)).toBeInTheDocument()
    expect(within(cards[0]).getByText('4.8')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Fruits de mer')).toBeInTheDocument()

    expect(within(cards[1]).getByText('Gratuit')).toBeInTheDocument()
  })

  it('filtre par onglet de catégorie et par recherche', async () => {
    const user = userEvent.setup()
    const fetchMock = mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
      jsonResponse({ items: [], total: 0, page: 1, pages: 0 }),
      jsonResponse({ items: [], total: 0, page: 1, pages: 0 }),
    ])

    renderServicesPage('/services?type=restaurant')
    await screen.findAllByRole('article')

    await user.click(screen.getByRole('button', { name: 'Activités' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Activités' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('type=activite'),
      expect.any(Object),
    )

    await user.type(screen.getByLabelText('Recherche'), 'kayak')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('search=kayak'),
      expect.any(Object),
    )
  })

  it('affiche un message d’erreur si l’API échoue', async () => {
    mockServicesApi([new TypeError('Failed to fetch')])

    renderServicesPage('/services')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les services')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur.')
  })
})