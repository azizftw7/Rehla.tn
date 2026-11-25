import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { FavoritesProvider } from '../context/FavoritesContext.jsx'
import { TOKEN_STORAGE_KEY } from '../lib/api.js'
import { jsonResponse, mockApi } from '../test/utils.jsx'
import FavoriteButton from './FavoriteButton.jsx'
import ServiceCard from './ServiceCard.jsx'

const TRAVELER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' }
const PROVIDER = { _id: 'p1', name: 'Nour Ben Salem', role: 'prestataire' }
const SERVICE = {
  _id: 's1',
  type: 'hebergement',
  name: 'Dar Yasmine',
  destination: { name: 'Djerba' },
  price: { amount: 120, unit: 'nuit' },
  photos: [],
}

function LoginSpy() {
  const location = useLocation()
  return <p data-testid="login">retour : {location.state?.from?.pathname}</p>
}

function renderWithSession({ user = null, routes = {}, ui } = {}) {
  if (user) localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  const fetchMock = mockApi({
    'GET /users/me': () => jsonResponse({ user }),
    'GET /favorites/ids': () => jsonResponse({ ids: [] }),
    ...routes,
  })
  render(
    <AuthProvider>
      <FavoritesProvider>
        <MemoryRouter initialEntries={['/services/s1']}>
          <Routes>
            <Route
              path="/services/:id"
              element={
                ui ?? <FavoriteButton serviceId="s1" serviceName="Dar Yasmine" variant="detail" />
              }
            />
            <Route path="/connexion" element={<LoginSpy />} />
          </Routes>
        </MemoryRouter>
      </FavoritesProvider>
    </AuthProvider>,
  )
  return fetchMock
}

const heart = () => screen.findByRole('button', { name: 'Mettre « Dar Yasmine » en favori' })

describe('FavoriteButton (US5.1)', () => {
  it('redirige un visiteur vers la connexion, avec retour sur la page', async () => {
    const user = userEvent.setup()
    renderWithSession()

    const button = await heart()
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)
    expect(screen.getByTestId('login')).toHaveTextContent('retour : /services/s1')
  })

  it('coche le cœur d’un service déjà en favori, puis le retire et le remet', async () => {
    const user = userEvent.setup()
    const fetchMock = renderWithSession({
      user: TRAVELER,
      routes: {
        'GET /favorites/ids': () => jsonResponse({ ids: ['s1'] }),
        'DELETE /favorites/s1': () => ({ ok: true, status: 204, json: async () => null }),
        'POST /favorites': () => jsonResponse({ favorite: { _id: 'f1' } }, 201),
      },
    })

    const button = await heart()
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))

    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))

    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
    const post = fetchMock.mock.calls.find(([, options = {}]) => options.method === 'POST')
    expect(JSON.parse(post[1].body)).toEqual({ serviceId: 's1' })
  })

  it('affiche l’erreur de l’API sans changer l’état', async () => {
    const user = userEvent.setup()
    renderWithSession({
      user: TRAVELER,
      routes: {
        'POST /favorites': () =>
          jsonResponse({ message: 'Le service est momentanément indisponible.' }, 503),
      },
    })
    const button = await heart()
    await user.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    )
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('n’apparaît pas pour un prestataire', async () => {
    renderWithSession({ user: PROVIDER })
    await waitFor(() => expect(screen.queryByText(/Vérification/)).not.toBeInTheDocument())
    // Laisse la session se charger avant de vérifier l'absence du bouton.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('s’affiche sur ServiceCard, mais pas quand favorite={false}', async () => {
    renderWithSession({
      ui: (
        <>
          <ServiceCard service={SERVICE} />
          <ServiceCard service={{ ...SERVICE, _id: 's2', name: 'Autre' }} favorite={false} />
        </>
      ),
    })
    expect(await heart()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Mettre « Autre » en favori' }),
    ).not.toBeInTheDocument()
  })
})
