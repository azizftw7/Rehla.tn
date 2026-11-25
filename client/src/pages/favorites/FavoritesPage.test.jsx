import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import FavoritesPage from './FavoritesPage.jsx'

const DAR = {
  _id: 's1',
  type: 'hebergement',
  name: 'Dar Yasmine',
  destination: { _id: 'd1', name: 'Djerba' },
  price: { amount: 120, unit: 'nuit' },
  photos: [],
}
const KAYAK = {
  _id: 's2',
  type: 'activite',
  name: 'Balade en kayak',
  destination: { _id: 'd1', name: 'Djerba' },
  activityCategory: 'Nautique',
  free: true,
  photos: [],
}

const page = (items, extra = {}) =>
  jsonResponse({
    items: items.map((service, index) => ({ _id: `f${index}`, service })),
    total: items.length,
    page: 1,
    pages: items.length ? 1 : 0,
    ...extra,
  })

function renderPage(routes, entry = '/mes-favoris') {
  const fetchMock = mockApi({ 'GET /favorites': () => page([DAR, KAYAK]), ...routes })
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/mes-favoris" element={<FavoritesPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
  return fetchMock
}

describe('FavoritesPage (US5.1)', () => {
  it('affiche les favoris avec un bouton « Retirer »', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Mes favoris' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Chargement de vos favoris' })).toBeInTheDocument()

    const list = await screen.findByRole('list', { name: 'Mes favoris' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getByRole('link', { name: 'Dar Yasmine' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    expect(screen.getByText('2 favoris')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Retirer « Balade en kayak » de mes favoris' }),
    ).toBeInTheDocument()
  })

  it('affiche un état vide avec un lien vers les services', async () => {
    renderPage({ 'GET /favorites': () => page([]) })
    expect(
      await screen.findByRole('heading', { name: 'Vous n’avez pas encore de favori' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorer les services' })).toHaveAttribute(
      'href',
      '/services',
    )
  })

  it('affiche une erreur avec « Réessayer »', async () => {
    const user = userEvent.setup()
    let fail = true
    renderPage({
      'GET /favorites': () =>
        fail ? jsonResponse({ message: 'Serveur indisponible.' }, 503) : page([DAR]),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur indisponible.')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('list', { name: 'Mes favoris' })).toBeInTheDocument()
  })

  it('retire un favori après confirmation et recharge la liste', async () => {
    const user = userEvent.setup()
    let items = [DAR, KAYAK]
    const fetchMock = renderPage({
      'GET /favorites': () => page(items),
      'DELETE /favorites/s2': () => {
        items = [DAR]
        return { ok: true, status: 204, json: async () => null }
      },
    })

    await user.click(
      await screen.findByRole('button', { name: 'Retirer « Balade en kayak » de mes favoris' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Retirer ce favori ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(fetchMock.mock.calls.some(([, o = {}]) => o.method === 'DELETE')).toBe(false)

    await user.click(
      screen.getByRole('button', { name: 'Retirer « Balade en kayak » de mes favoris' }),
    )
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retirer' }))

    expect(
      await screen.findByText('« Balade en kayak » a été retiré de vos favoris.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('1 favori')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Balade en kayak' })).not.toBeInTheDocument()
  })

  it('pagine avec ?page= dans l’URL', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({
      'GET /favorites': () => page([DAR], { total: 13, pages: 2 }),
    })
    await user.click(await screen.findByRole('button', { name: 'Suivant' }))
    await waitFor(() =>
      expect(new URL(fetchMock.mock.calls.at(-1)[0]).searchParams.get('page')).toBe('2'),
    )
  })
})
