import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, renderWithRouter } from '../../test/utils.jsx'
import DestinationsSection from './DestinationsSection.jsx'

const DESTINATIONS = [
  {
    _id: '1',
    name: 'Djerba',
    slug: 'djerba',
    region: 'Médenine',
    description: 'Île du golfe de Gabès.',
    coverImage: 'https://placehold.co/1200x600?text=Djerba',
  },
  { _id: '2', name: 'Sidi Bou Saïd', slug: 'sidi-bou-said', region: 'Tunis' },
]

const page = (items) => ({ items, total: items.length, page: 1, pages: 1 })

function mockFetch(...responses) {
  const fetchMock = vi.fn()
  responses.forEach((response) =>
    response instanceof Error
      ? fetchMock.mockRejectedValueOnce(response)
      : fetchMock.mockResolvedValueOnce(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Section « Où partir cet automne ? »', () => {
  it('affiche des squelettes pendant le chargement', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const { container } = renderWithRouter(<DestinationsSection />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des destinations…')
    expect(container.querySelectorAll('.destination-card--skeleton')).toHaveLength(3)
    expect(screen.getByRole('region', { name: 'Où partir cet automne ?' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('charge au plus 6 destinations depuis l’API et affiche une carte par destination', async () => {
    const fetchMock = mockFetch(jsonResponse(page(DESTINATIONS)))

    renderWithRouter(<DestinationsSection />)

    const list = await screen.findByRole('list')
    const cards = within(list).getAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByRole('link', { name: 'Djerba' })).toHaveAttribute(
      'href',
      '/destinations/djerba',
    )
    expect(within(cards[0]).getByRole('img', { name: 'Vue de Djerba' })).toBeInTheDocument()
    expect(within(cards[0]).getByText('Médenine')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/destinations?limit=6',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('affiche un message quand il n’y a aucune destination', async () => {
    mockFetch(jsonResponse(page([])))

    renderWithRouter(<DestinationsSection />)

    expect(await screen.findByText('Aucune destination pour le moment.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('affiche une erreur claire si le serveur est injoignable, puis réessaie', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(
      new TypeError('Failed to fetch'),
      jsonResponse(page(DESTINATIONS)),
    )

    renderWithRouter(<DestinationsSection />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les destinations.')
    expect(alert).toHaveTextContent('Impossible de joindre le serveur.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findAllByRole('article')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('affiche le message d’erreur renvoyé par l’API', async () => {
    mockFetch(
      jsonResponse(
        { message: 'Le service est momentanément indisponible. Réessayez dans quelques instants.' },
        503,
      ),
    )

    renderWithRouter(<DestinationsSection />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    )
  })
})
