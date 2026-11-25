import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../../test/utils.jsx'
import ServiceDetailPage from './ServiceDetailPage.jsx'

// Leaflet ne fonctionne pas dans jsdom : la carte est remplacée par un composant qui expose ses props.
vi.mock('../../components/ServicesMap.jsx', () => ({
  default: function ServicesMapMock({ center, services, label }) {
    return (
      <div
        data-testid="services-map"
        aria-label={label}
        data-center={JSON.stringify(center)}
        data-markers={services.map((s) => s._id).join(',')}
      />
    )
  },
}))

const SERVICE_DETAIL = {
  _id: 's1',
  type: 'restaurant',
  name: 'Dar Zarrouk',
  description: 'Cuisine méditerranéenne et poissons frais avec vue panoramique.',
  cuisine: 'Fruits de mer',
  address: 'Rue Hédi Zarrouk, Sidi Bou Saïd',
  destination: { name: 'Sidi Bou Saïd', slug: 'sidi-bou-said', region: 'Tunis' },
  provider: { name: 'Maison Zarrouk' },
  contact: {
    phone: '+216 71 740 591',
    website: 'https://darzarrouk.tn',
  },
  price: { amount: 65, unit: 'repas' },
  free: false,
  ratingAverage: 4.8,
  ratingCount: 12,
  photos: ['https://placehold.co/800x500?text=Terrasse', 'https://placehold.co/800x500?text=Plat'],
}

function renderDetailPage(route = '/services/s1') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/services/:id" element={<ServiceDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ServiceDetailPage', () => {
  it('affiche les détails complets du restaurant, le contact et la galerie', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ service: SERVICE_DETAIL }))),
    )

    renderDetailPage('/services/s1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dar Zarrouk' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cuisine méditerranéenne/)).toBeInTheDocument()
    expect(screen.getByText('Rue Hédi Zarrouk, Sidi Bou Saïd')).toBeInTheDocument()
    expect(screen.getByText('Proposé par Maison Zarrouk')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+216 71 740 591' })).toHaveAttribute(
      'href',
      'tel:+216 71 740 591',
    )
    expect(screen.getByRole('link', { name: 'Site web officiel' })).toHaveAttribute(
      'href',
      'https://darzarrouk.tn',
    )

    expect(screen.getByRole('img', { name: 'Dar Zarrouk — photo 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Afficher la photo 2' }))
    expect(screen.getByRole('img', { name: 'Dar Zarrouk — photo 2' })).toBeInTheDocument()
  })

  it('affiche un état introuvable lorsque le service renvoie 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ message: 'Service introuvable.' }, 404))),
    )

    renderDetailPage('/services/inexistant')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Service introuvable')
    expect(screen.getByRole('link', { name: 'Retour au catalogue' })).toHaveAttribute(
      'href',
      '/services',
    )
  })
})

describe('ServiceDetailPage — événement (US3.4)', () => {
  it('affiche le type d’événement avec les dates et horaires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            service: {
              ...SERVICE_DETAIL,
              _id: 'e1',
              type: 'evenement',
              name: 'Festival des palmeraies',
              cuisine: undefined,
              event: {
                eventType: 'Festival',
                startDate: '2026-10-16T12:00:00.000Z',
                endDate: '2026-10-18T12:00:00.000Z',
                hours: '10h – 23h',
              },
            },
          }),
        ),
      ),
    )

    renderDetailPage('/services/e1')

    expect(await screen.findByRole('heading', { name: 'Dates et horaires' })).toBeInTheDocument()
    expect(screen.getByText(/10h – 23h/)).toBeInTheDocument()
    expect(screen.getByText('Type d’événement : Festival')).toBeInTheDocument()
    expect(screen.getByText('Festival', { selector: '.service-card__tag' })).toBeInTheDocument()
  })
})

const LODGING = {
  _id: 'h1',
  type: 'hebergement',
  accommodationType: 'maison-hotes',
  name: 'Menzel des Palmes Bleues',
  description: 'Maison d’hôtes de six chambres autour d’un patio.',
  address: 'Route de la plage, Djerba',
  destination: { name: 'Djerba', slug: 'djerba', region: 'Médenine' },
  provider: { name: 'Nour Ben Salem' },
  location: { type: 'Point', coordinates: [10.872, 33.861] },
  price: { amount: 180, unit: 'nuit' },
  free: false,
  ratingAverage: 4.5,
  ratingCount: 2,
  photos: [],
}

const OFFERS = [
  {
    _id: 'o1',
    title: 'Séjour d’hiver',
    discountPercent: 15,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2027-02-28T00:00:00.000Z',
  },
  {
    _id: 'o2',
    title: 'Week-end en amoureux',
    discountedPrice: 150,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
  },
]

function mockDetail(body) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(body))))
}

describe('ServiceDetailPage — hébergement (US3.1)', () => {
  it('affiche le type d’hébergement, le prix et les offres en cours', async () => {
    mockDetail({ service: LODGING, offers: OFFERS })
    renderDetailPage('/services/h1')

    await screen.findByRole('heading', { level: 1, name: 'Menzel des Palmes Bleues' })
    expect(screen.getByText('Maison d’hôtes', { selector: '.service-card__tag' })).toBeInTheDocument()
    expect(screen.getByText('180 DT')).toBeInTheDocument()

    const offers = screen.getByRole('heading', { name: 'Offres en cours' }).parentElement
    const items = within(offers).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Séjour d’hiver')
    expect(items[0]).toHaveTextContent('jusqu’au 28 février 2027')
    expect(within(items[0]).getByText('-15 %')).toBeInTheDocument()
    expect(items[1]).toHaveTextContent('Prix réduit : 150 DT')
    expect(items[1]).toHaveTextContent('jusqu’au 31 décembre 2026')
  })

  it('n’affiche pas le bloc des offres quand il n’y en a aucune', async () => {
    mockDetail({ service: LODGING, offers: [] })
    renderDetailPage('/services/h1')

    await screen.findByRole('heading', { level: 1, name: 'Menzel des Palmes Bleues' })
    expect(screen.queryByRole('heading', { name: 'Offres en cours' })).not.toBeInTheDocument()
  })

  it('affiche la mini-carte « Localisation » avec ce seul service', async () => {
    mockDetail({ service: LODGING, offers: [] })
    renderDetailPage('/services/h1')

    expect(await screen.findByRole('heading', { name: 'Localisation' })).toBeInTheDocument()
    const map = await screen.findByTestId('services-map')
    expect(map).toHaveAttribute('aria-label', 'Localisation de Menzel des Palmes Bleues')
    expect(map).toHaveAttribute('data-markers', 'h1')
    expect(JSON.parse(map.dataset.center)).toEqual([33.861, 10.872])
  })

  it('n’affiche pas de carte sans localisation valide', async () => {
    mockDetail({ service: { ...LODGING, location: undefined }, offers: [] })
    renderDetailPage('/services/h1')

    await screen.findByRole('heading', { level: 1, name: 'Menzel des Palmes Bleues' })
    expect(screen.queryByRole('heading', { name: 'Localisation' })).not.toBeInTheDocument()
  })

  it('intègre une vidéo YouTube dans un lecteur', async () => {
    mockDetail({
      service: { ...LODGING, videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
      offers: [],
    })
    renderDetailPage('/services/h1')

    const iframe = await screen.findByTitle('Vidéo de présentation — Menzel des Palmes Bleues')
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(screen.queryByRole('link', { name: 'Voir la vidéo' })).not.toBeInTheDocument()
  })

  it('propose un lien « Voir la vidéo » pour une vidéo hors YouTube', async () => {
    mockDetail({
      service: { ...LODGING, videoUrl: 'https://vimeo.com/123456' },
      offers: [],
    })
    renderDetailPage('/services/h1')

    const link = await screen.findByRole('link', { name: 'Voir la vidéo' })
    expect(link).toHaveAttribute('href', 'https://vimeo.com/123456')
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.queryByTitle(/Vidéo de présentation/)).not.toBeInTheDocument()
  })

  it('relance le chargement avec « Réessayer » après une erreur réseau', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ service: LODGING, offers: [] }))
    vi.stubGlobal('fetch', fetchMock)
    renderDetailPage('/services/h1')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger ce service')
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Menzel des Palmes Bleues' }),
    ).toBeInTheDocument()
    // Deux chargements de la fiche (les avis ont leur propre requête, /reviews).
    const detailCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/services/h1'))
    expect(detailCalls).toHaveLength(2)
  })
})

describe('ServiceDetailPage — message de confirmation', () => {
  it('affiche le message transmis par la page précédente (service publié)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ service: SERVICE_DETAIL, offers: [] })))
    const notice = '« Dar Zarrouk » est publié : les voyageurs peuvent le voir dès maintenant.'

    renderDetailPage({ pathname: '/services/s1', state: { notice } })

    expect(await screen.findByRole('status')).toHaveTextContent(notice)
  })

  it('n’affiche aucun message sans état de navigation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ service: SERVICE_DETAIL, offers: [] })))

    renderDetailPage()

    await screen.findByRole('heading', { level: 1, name: 'Dar Zarrouk' })
    expect(screen.queryByText(/est publié/)).not.toBeInTheDocument()
  })
})
