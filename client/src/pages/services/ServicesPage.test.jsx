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
    mockServicesApi([jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 })])

    renderServicesPage('/services?type=restaurant')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Restaurants' }),
    ).toBeInTheDocument()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(2)

    expect(within(cards[0]).getByRole('link', { name: 'Dar Zarrouk' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    expect(within(cards[0]).getByText(/65 DT/)).toBeInTheDocument()
    expect(within(cards[0]).getByText('4,8')).toBeInTheDocument()
    expect(within(cards[0]).getByText('Fruits de mer')).toBeInTheDocument()

    expect(within(cards[1]).getAllByText('Gratuit')).toHaveLength(2)
  })

  it('filtre par onglet de catégorie, catégorie d’activité et par recherche', async () => {
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
    await user.type(screen.getByLabelText('Catégorie d’activité'), 'Plage')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('search=kayak'),
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('activityCategory=Plage'),
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
const EVENTS = [
  {
    _id: 'e1',
    type: 'evenement',
    name: 'Festival des palmeraies',
    destination: { name: 'Tozeur', slug: 'tozeur' },
    free: false,
    price: { amount: 10, unit: 'entrée' },
    event: {
      eventType: 'Festival',
      startDate: '2026-07-12T00:00:00.000Z',
      endDate: '2026-08-20T00:00:00.000Z',
    },
    ratingAverage: 0,
    ratingCount: 0,
    photos: [],
  },
]

describe('ServicesPage — événements (US3.4)', () => {
  it('affiche les dates et le type de l’événement sur la carte', async () => {
    mockServicesApi([jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 })])
    renderServicesPage('/services?type=evenement')

    const [card] = await screen.findAllByRole('article')
    expect(within(card).getByText('Du 12 juil. au 20 août 2026')).toBeInTheDocument()
    expect(within(card).getByText('Festival')).toBeInTheDocument()
  })

  it('n’affiche les filtres d’événement que sur l’onglet Événements', async () => {
    const user = userEvent.setup()
    mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
      jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=restaurant')
    await screen.findAllByRole('article')

    expect(screen.queryByLabelText('Type d’événement')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Du')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Événements' }))

    expect(screen.getByLabelText('Type d’événement')).toBeInTheDocument()
    expect(screen.getByLabelText('Du')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Au')).toHaveAttribute('type', 'date')
  })

  it('envoie le type d’événement et la période à l’API et les garde dans l’URL', async () => {
    const user = userEvent.setup()
    const fetchMock = mockServicesApi([
      jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 }),
      jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=evenement&from=2026-07-01&to=2026-08-31')
    await screen.findAllByRole('article')

    expect(screen.getByLabelText('Du')).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('Au')).toHaveValue('2026-08-31')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/type=evenement.*from=2026-07-01&to=2026-08-31/),
      expect.any(Object),
    )

    await user.selectOptions(screen.getByLabelText('Type d’événement'), 'Festival')

    expect(screen.getByLabelText('Type d’événement')).toHaveValue('Festival')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('eventType=Festival'),
      expect.any(Object),
    )
  })

  it('signale une période inversée sans l’envoyer à l’API', async () => {
    const fetchMock = mockServicesApi([
      jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=evenement&from=2026-12-10&to=2026-12-01')
    await screen.findAllByRole('article')

    expect(screen.getByLabelText('Au')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('La date de fin doit être après la date de début.')).toBeInTheDocument()
    const url = fetchMock.mock.calls.at(-1)[0]
    expect(url).toContain('from=2026-12-10')
    expect(url).not.toContain('to=')
  })

  it('ignore les filtres d’événement sur les autres onglets', async () => {
    const fetchMock = mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=restaurant&eventType=Concert&from=2026-12-01')
    await screen.findAllByRole('article')

    const url = fetchMock.mock.calls.at(-1)[0]
    expect(url).not.toContain('eventType')
    expect(url).not.toContain('from=')
  })

  it('relance vraiment la requête avec « Réessayer »', async () => {
    const user = userEvent.setup()
    mockServicesApi([
      new TypeError('Failed to fetch'),
      jsonResponse({ items: EVENTS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=evenement')

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findAllByRole('article')).toHaveLength(1)
  })
})

const LODGINGS = [
  {
    _id: 'h1',
    type: 'hebergement',
    name: 'Menzel des Palmes Bleues',
    accommodationType: 'maison-hotes',
    destination: { name: 'Djerba', slug: 'djerba' },
    price: { amount: 180, unit: 'nuit' },
    free: false,
    ratingAverage: 4.5,
    ratingCount: 2,
    photos: [],
  },
]

describe('ServicesPage — hébergements (US3.1)', () => {
  it('affiche le type d’hébergement en badge sur la carte', async () => {
    mockServicesApi([jsonResponse({ items: LODGINGS, total: 1, page: 1, pages: 1 })])
    renderServicesPage('/services?type=hebergement')

    const [card] = await screen.findAllByRole('article')
    expect(within(card).getByText('Maison d’hôtes')).toHaveClass('service-card__tag')
  })

  it('n’affiche le filtre « Type d’hébergement » que sur l’onglet Hébergements', async () => {
    const user = userEvent.setup()
    mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
      jsonResponse({ items: LODGINGS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=restaurant')
    await screen.findAllByRole('article')

    expect(screen.queryByLabelText('Type d’hébergement')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hébergements' }))

    const select = screen.getByLabelText('Type d’hébergement')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Tous les types',
      'Hôtel',
      'Maison d’hôtes',
      'Dar',
      'Appartement',
      'Camping',
    ])
  })

  it('synchronise le type d’hébergement avec l’URL et l’envoie à l’API', async () => {
    const user = userEvent.setup()
    const fetchMock = mockServicesApi([
      jsonResponse({ items: LODGINGS, total: 1, page: 1, pages: 1 }),
      jsonResponse({ items: LODGINGS, total: 1, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=hebergement&accommodationType=dar')
    await screen.findAllByRole('article')

    expect(screen.getByLabelText('Type d’hébergement')).toHaveValue('dar')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('accommodationType=dar'),
      expect.any(Object),
    )

    await user.selectOptions(screen.getByLabelText('Type d’hébergement'), 'maison-hotes')

    expect(screen.getByLabelText('Type d’hébergement')).toHaveValue('maison-hotes')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('accommodationType=maison-hotes'),
      expect.any(Object),
    )
  })

  it('ignore le type d’hébergement sur les autres onglets', async () => {
    const fetchMock = mockServicesApi([
      jsonResponse({ items: RESTAURANTS, total: 2, page: 1, pages: 1 }),
    ])
    renderServicesPage('/services?type=restaurant&accommodationType=dar')
    await screen.findAllByRole('article')

    expect(fetchMock.mock.calls.at(-1)[0]).not.toContain('accommodationType')
  })
})
