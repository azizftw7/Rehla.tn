import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../context/AuthContext.jsx'
import { TOKEN_STORAGE_KEY } from '../../lib/api.js'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import RegisterPage from './RegisterPage.jsx'

function renderRegister(entry = '/inscription') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/inscription"
            element={
              <>
                <RegisterPage />
                <LocationDisplay />
              </>
            }
          />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const created = (user) => () => jsonResponse({ token: 'jeton-new', user }, 201)

describe('RegisterPage — voyageur', () => {
  it('crée un compte voyageur puis connecte l’utilisateur', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'POST /auth/register': created({ _id: 'u1', name: 'Amel', role: 'voyageur' }),
    })
    renderRegister()

    expect(screen.getByRole('button', { name: 'Voyageur' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByLabelText('Nom commercial')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Nom et prénom'), 'Amel Trabelsi')
    await user.type(screen.getByLabelText('Adresse e-mail'), 'amel@rehla.tn')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1')
    await user.selectOptions(screen.getByLabelText('Vous êtes'), 'Étudiant')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('jeton-new')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: 'Amel Trabelsi',
      email: 'amel@rehla.tn',
      password: 'motdepasse1',
      profile: 'etudiant',
      role: 'voyageur',
    })
  })

  it('affiche chaque erreur du serveur sous son champ (champs vides non envoyés)', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'POST /auth/register': () =>
        jsonResponse(
          {
            message: 'Données invalides.',
            details: [
              { field: 'name', message: 'Le nom est obligatoire.' },
              { field: 'password', message: 'Le mot de passe doit contenir au moins 8 caractères.' },
              { field: 'profile', message: 'Le profil est obligatoire (etudiant, resident ou touriste).' },
            ],
          },
          400,
        ),
    })
    renderRegister()

    await user.type(screen.getByLabelText('Adresse e-mail'), 'amel@rehla.tn')
    await user.type(screen.getByLabelText('Mot de passe'), 'court')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    const name = screen.getByLabelText('Nom et prénom')
    expect(await screen.findByText('Le nom est obligatoire.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      '8 caractères minimum. Le mot de passe doit contenir au moins 8 caractères.',
    )
    expect(screen.getByLabelText('Vous êtes')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Adresse e-mail')).not.toHaveAttribute('aria-invalid')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'amel@rehla.tn',
      password: 'court',
      role: 'voyageur',
    })
  })

  it('affiche « e-mail déjà utilisé » (409) sous le champ e-mail', async () => {
    const user = userEvent.setup()
    const message = 'Cette adresse e-mail est déjà utilisée.'
    mockApi({
      'POST /auth/register': () =>
        jsonResponse({ message, details: [{ field: 'email', message }] }, 409),
    })
    renderRegister()

    await user.type(screen.getByLabelText('Adresse e-mail'), 'pris@rehla.tn')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByLabelText('Adresse e-mail')).toHaveAccessibleDescription(message)
  })

  it('affiche un message général si le serveur est injoignable', async () => {
    const user = userEvent.setup()
    mockApi({
      'POST /auth/register': () => Promise.reject(new TypeError('Failed to fetch')),
    })
    renderRegister()

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.',
    )
  })
})

describe('RegisterPage — prestataire', () => {
  it('ouvre directement l’onglet Prestataire avec ?role=prestataire', () => {
    renderRegister('/inscription?role=prestataire')

    expect(screen.getByRole('button', { name: 'Prestataire' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Nom commercial')).toBeInTheDocument()
    expect(screen.queryByLabelText('Vous êtes')).not.toBeInTheDocument()
  })

  it('change d’onglet et garde l’URL synchronisée', async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.click(screen.getByRole('button', { name: 'Prestataire' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/inscription?role=prestataire')
    expect(screen.getByLabelText('Type de service')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voyageur' }))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/inscription$/)
  })

  it('envoie role=prestataire et l’objet provider', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'POST /auth/register': created({ _id: 'p1', name: 'Karim', role: 'prestataire' }),
    })
    renderRegister('/inscription?role=prestataire')

    await user.type(screen.getByLabelText('Nom et prénom du responsable'), 'Karim Jlassi')
    await user.type(screen.getByLabelText('Adresse e-mail'), 'karim@rehla.tn')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1')
    await user.type(screen.getByLabelText('Nom commercial'), 'Sahara Lumière')
    const activity = screen.getByLabelText('Type de service')
    expect(within(activity).getAllByRole('option').map((o) => o.value)).toEqual([
      '',
      'hebergement',
      'restaurant',
      'activite',
      'evenement',
      'guide',
    ])
    await user.selectOptions(activity, 'Activité')
    await user.type(screen.getByLabelText('Ville'), 'Tozeur')
    await user.type(screen.getByLabelText('Téléphone'), '+216 76 000 000')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    // Le compte doit d'abord être validé par l'administrateur.
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/prestataire/en-attente'),
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: 'Karim Jlassi',
      email: 'karim@rehla.tn',
      password: 'motdepasse1',
      role: 'prestataire',
      provider: {
        businessName: 'Sahara Lumière',
        activityType: 'activite',
        city: 'Tozeur',
        phone: '+216 76 000 000',
      },
    })
  })

  it('affiche les erreurs des champs de l’activité (provider.*)', async () => {
    const user = userEvent.setup()
    mockApi({
      'POST /auth/register': () =>
        jsonResponse(
          {
            message: 'Données invalides.',
            details: [
              { field: 'provider.businessName', message: 'Le nom commercial est obligatoire.' },
              { field: 'provider.phone', message: "Le numéro de téléphone n'est pas valide." },
            ],
          },
          400,
        ),
    })
    renderRegister('/inscription?role=prestataire')

    await user.type(screen.getByLabelText('Téléphone'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    const businessName = screen.getByLabelText('Nom commercial')
    expect(await screen.findByText('Le nom commercial est obligatoire.')).toBeInTheDocument()
    expect(businessName).toHaveAccessibleDescription('Le nom commercial est obligatoire.')
    expect(businessName).toHaveFocus()
    expect(screen.getByLabelText('Téléphone')).toHaveAccessibleDescription(
      "Ex. +216 71 000 000 Le numéro de téléphone n'est pas valide.",
    )
  })
})
