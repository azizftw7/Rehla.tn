import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ProtectedRoute from '../../components/ProtectedRoute.jsx'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import LoginPage from '../auth/LoginPage.jsx'
import ChangePasswordPage from './ChangePasswordPage.jsx'

const TRAVELER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' }

function renderPage(routes = {}, { loggedIn = true } = {}) {
  if (loggedIn) localStorage.setItem(TOKEN_STORAGE_KEY, 'jeton')
  const fetchMock = mockApi({ 'GET /users/me': () => jsonResponse({ user: TRAVELER }), ...routes })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/mon-compte/mot-de-passe']}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route
            path="/mon-compte/mot-de-passe"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  return fetchMock
}

async function fill(user, { current, next, confirm = next }) {
  await screen.findByRole('heading', { level: 1, name: 'Modifier mon mot de passe' })
  if (current) await user.type(screen.getByLabelText('Mot de passe actuel'), current)
  if (next) await user.type(screen.getByLabelText('Nouveau mot de passe'), next)
  if (confirm) await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), confirm)
  await user.click(screen.getByRole('button', { name: 'Modifier mon mot de passe' }))
}

const passwordCalls = (fetchMock) =>
  fetchMock.mock.calls.filter(([url]) => url.endsWith('/users/me/password'))

describe('ChangePasswordPage', () => {
  it('affiche l’en-tête et des champs accessibles', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Modifier mon mot de passe' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Mon compte')).toHaveClass('surtitre')
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    const next = screen.getByLabelText('Nouveau mot de passe')
    expect(next).toHaveAttribute('autocomplete', 'new-password')
    expect(next).toHaveAccessibleDescription(
      '8 caractères minimum, différent du mot de passe actuel.',
    )
  })

  it('modifie le mot de passe : message de succès et champs vidés', async () => {
    const user = userEvent.setup()
    let resolve
    const fetchMock = renderPage({
      'PUT /users/me/password': () =>
        new Promise((r) => {
          resolve = () => r(jsonResponse({ message: 'Votre mot de passe a été modifié.' }))
        }),
    })

    await fill(user, { current: 'ancien-mdp-1', next: 'nouveau-mdp-1' })

    // Bouton désactivé pendant l'envoi.
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled()
    resolve()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Votre mot de passe a été modifié.',
    )
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('')
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveValue('')
    expect(screen.getByLabelText('Confirmer le nouveau mot de passe')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Modifier mon mot de passe' })).toBeEnabled()
    expect(JSON.parse(passwordCalls(fetchMock)[0][1].body)).toEqual({
      currentPassword: 'ancien-mdp-1',
      newPassword: 'nouveau-mdp-1',
    })
  })

  it('mot de passe actuel faux : message du serveur sous ce champ', async () => {
    const user = userEvent.setup()
    renderPage({
      'PUT /users/me/password': () =>
        jsonResponse(
          {
            message: 'Le mot de passe actuel est incorrect.',
            details: [
              { field: 'currentPassword', message: 'Le mot de passe actuel est incorrect.' },
            ],
          },
          400,
        ),
    })

    await fill(user, { current: 'faux-mdp-1', next: 'nouveau-mdp-1' })

    const current = screen.getByLabelText('Mot de passe actuel')
    expect(await screen.findByText('Le mot de passe actuel est incorrect.')).toBeInTheDocument()
    expect(current).toHaveAttribute('aria-invalid', 'true')
    expect(current).toHaveAccessibleDescription('Le mot de passe actuel est incorrect.')
    expect(current).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('confirmation différente : erreur sans appel au serveur', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage()

    await fill(user, { current: 'ancien-mdp-1', next: 'nouveau-mdp-1', confirm: 'nouveau-mdp-2' })

    const confirm = screen.getByLabelText('Confirmer le nouveau mot de passe')
    expect(confirm).toHaveAccessibleDescription('Les deux mots de passe ne correspondent pas.')
    expect(confirm).toHaveFocus()
    expect(passwordCalls(fetchMock)).toHaveLength(0)
  })

  it('nouveau mot de passe trop court ou identique à l’actuel', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage()

    await fill(user, { current: 'ancien-mdp-1', next: 'court' })
    const next = screen.getByLabelText('Nouveau mot de passe')
    expect(next).toHaveAccessibleDescription(
      '8 caractères minimum, différent du mot de passe actuel. Le mot de passe doit contenir au moins 8 caractères.',
    )

    await user.clear(next)
    await user.type(next, 'ancien-mdp-1')
    const confirm = screen.getByLabelText('Confirmer le nouveau mot de passe')
    await user.clear(confirm)
    await user.type(confirm, 'ancien-mdp-1')
    await user.click(screen.getByRole('button', { name: 'Modifier mon mot de passe' }))
    expect(
      screen.getByText('Le nouveau mot de passe doit être différent de l’ancien.'),
    ).toBeInTheDocument()
    expect(passwordCalls(fetchMock)).toHaveLength(0)
  })

  it('page inaccessible sans connexion : redirection vers la connexion', async () => {
    renderPage({}, { loggedIn: false })

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Mot de passe actuel')).not.toBeInTheDocument()
  })
})
