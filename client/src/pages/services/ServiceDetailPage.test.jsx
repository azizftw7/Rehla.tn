import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../../test/utils.jsx'
import ServiceDetailPage from './ServiceDetailPage.jsx'

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
  photos: [
    'https://placehold.co/800x500?text=Terrasse',
    'https://placehold.co/800x500?text=Plat',
  ],
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
