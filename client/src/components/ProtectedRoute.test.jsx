import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../lib/api.js'
import LoginPage from '../pages/auth/LoginPage.jsx'
import { jsonResponse, mockApi } from '../test/utils.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

const PROVIDER = { _id: 'p1', name: 'Karim Jlassi', role: 'prestataire' }
const TRAVELER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' }

function renderProtected(entry = '/prestataire/services') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route element={<ProtectedRoute roles={['prestataire']} />}>
            <Route path="/prestataire/services" element={<h1>Mes services</h1>} />
          </Route>
          <Route
            path="/favoris"
            element={
              <ProtectedRoute>
                <h1>Mes favoris</h1>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('redirige vers /connexion puis revient sur la page après la connexion', async () => {
    const user = userEvent.setup()
    mockApi({ 'POST /auth/login': () => jsonResponse({ token: 'jeton', user: PROVIDER }) })
    renderProtected()

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mes services' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Adresse e-mail'), 'karim@rehla.tn')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('heading', { name: 'Mes services' })).toBeInTheDocument()
  })

  it('recharge la session depuis /users/me et affiche la page au bon rôle', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-stocke')
    const fetchMock = mockApi({ 'GET /users/me': () => jsonResponse({ user: PROVIDER }) })
    renderProtected()

    expect(screen.getByRole('status')).toHaveTextContent('Vérification de votre session…')
    expect(await screen.findByRole('heading', { name: 'Mes services' })).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jeton-stocke')
  })

  it('affiche « Accès refusé » si le rôle ne convient pas', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-voyageur')
    mockApi({ 'GET /users/me': () => jsonResponse({ user: TRAVELER }) })
    renderProtected()

    expect(await screen.findByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('sans rôle précisé, accepte tout utilisateur connecté', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-voyageur')
    mockApi({ 'GET /users/me': () => jsonResponse({ user: TRAVELER }) })
    renderProtected('/favoris')

    expect(await screen.findByRole('heading', { name: 'Mes favoris' })).toBeInTheDocument()
  })

  it('un token expiré (401) est supprimé et renvoie vers la connexion', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton-expire')
    mockApi({
      'GET /users/me': () =>
        jsonResponse({ message: 'Votre session a expiré. Reconnectez-vous.' }, 401),
    })
    renderProtected('/favoris')

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })
})
