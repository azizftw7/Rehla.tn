import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import LoginPage from './LoginPage.jsx'

const USER = { _id: 'u1', name: 'Nour Ben Salem', email: 'nour@rehla.tn', role: 'voyageur' }

function renderLogin(entry = '/connexion') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function fillAndSubmit(user, email, password) {
  await user.type(screen.getByLabelText('Adresse e-mail'), email)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('LoginPage', () => {
  it('connecte l’utilisateur, mémorise le token et revient à la page demandée', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'POST /auth/login': () => jsonResponse({ token: 'jeton-123', user: USER }),
    })
    renderLogin({ pathname: '/connexion', state: { from: { pathname: '/favoris', search: '?page=2' } } })

    await fillAndSubmit(user, ' nour@rehla.tn ', 'motdepasse1')

    expect(await screen.findByTestId('location')).toHaveTextContent('/favoris?page=2')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jeton-123')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'nour@rehla.tn',
      password: 'motdepasse1',
    })
  })

  it('revient à l’accueil sans page demandée', async () => {
    const user = userEvent.setup()
    mockApi({ 'POST /auth/login': () => jsonResponse({ token: 't', user: USER }) })
    renderLogin()

    await fillAndSubmit(user, 'nour@rehla.tn', 'motdepasse1')

    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/$/)
  })

  it('affiche le message général si les identifiants sont faux', async () => {
    const user = userEvent.setup()
    mockApi({
      'POST /auth/login': () =>
        jsonResponse({ message: 'E-mail ou mot de passe incorrect.', details: [] }, 401),
    })
    renderLogin()

    await fillAndSubmit(user, 'nour@rehla.tn', 'mauvais')

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('affiche l’erreur sous le champ concerné et y place le curseur', async () => {
    const user = userEvent.setup()
    const message = "L'adresse e-mail n'est pas valide."
    mockApi({
      'POST /auth/login': () =>
        jsonResponse({ message: 'Données invalides.', details: [{ field: 'email', message }] }, 400),
    })
    renderLogin()

    await fillAndSubmit(user, 'pas-un-email', 'motdepasse1')

    const email = screen.getByLabelText('Adresse e-mail')
    expect(await screen.findByText(message)).toHaveAttribute('id', 'connexion-email-erreur')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription(message)
    expect(email).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // L'erreur disparaît dès qu'on corrige le champ.
    await user.type(email, 'x')
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it('affiche ou masque le mot de passe', async () => {
    const user = userEvent.setup()
    renderLogin()
    const password = screen.getByLabelText('Mot de passe')
    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' })

    expect(password).toHaveAttribute('type', 'password')
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'password')
  })
})
