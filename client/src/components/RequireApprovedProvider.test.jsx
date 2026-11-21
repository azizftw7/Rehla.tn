import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../lib/api.js'
import ProviderPendingPage from '../pages/provider/ProviderPendingPage.jsx'
import { jsonResponse, mockApi } from '../test/utils.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import RequireApprovedProvider from './RequireApprovedProvider.jsx'

const provider = (provider) => ({
  _id: 'p1',
  name: 'Sami Gharbi',
  role: 'prestataire',
  provider: { businessName: 'Dar Yasmine', ...provider },
})

function renderProviderSpace(user, entry = '/prestataire/services') {
  localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  mockApi({ 'GET /users/me': () => jsonResponse({ user }) })
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<ProtectedRoute roles={['prestataire']} />}>
            <Route path="/prestataire/en-attente" element={<ProviderPendingPage />} />
            <Route element={<RequireApprovedProvider />}>
              <Route path="/prestataire/services" element={<h1>Mes services</h1>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('RequireApprovedProvider et page « en attente »', () => {
  it('redirige un prestataire en attente vers /prestataire/en-attente', async () => {
    renderProviderSpace(provider({ approval: 'en_attente' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Votre demande est en cours de validation',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mes services' })).not.toBeInTheDocument()
    expect(screen.getByText(/Dar Yasmine/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('affiche le refus et son motif', async () => {
    renderProviderSpace(
      provider({ approval: 'refuse', rejectionReason: 'Numéro de téléphone injoignable.' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Votre demande a été refusée' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Motif du refus' })).toBeInTheDocument()
    expect(screen.getByText('Numéro de téléphone injoignable.')).toBeInTheDocument()
  })

  it('laisse passer un prestataire approuvé', async () => {
    renderProviderSpace(provider({ approval: 'approuve' }))

    expect(await screen.findByRole('heading', { name: 'Mes services' })).toBeInTheDocument()
  })

  it('la page d’attente propose l’espace prestataire une fois le compte validé', async () => {
    renderProviderSpace(provider({ approval: 'approuve' }), '/prestataire/en-attente')

    expect(
      await screen.findByRole('heading', { name: 'Votre compte prestataire est validé' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accéder à mon espace' })).toHaveAttribute(
      'href',
      '/prestataire/services',
    )
  })
})
