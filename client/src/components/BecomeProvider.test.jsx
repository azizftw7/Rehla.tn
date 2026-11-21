import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthContext } from '../context/authContextDef.js'
import ProviderSection from '../pages/home/ProviderSection.jsx'
import Footer from './Footer.jsx'
import NavBar from './NavBar.jsx'

// « Devenir prestataire » : visible pour un visiteur ou un voyageur seulement
// (NavBar, Footer, section Prestataires de l'accueil).

const TRAVELER = { _id: 'u1', name: 'Amel Trabelsi', role: 'voyageur' }
const PROVIDER = {
  _id: 'p1',
  name: 'Karim Jlassi',
  role: 'prestataire',
  provider: { approval: 'approuve' },
}
const ADMIN = { _id: 'a1', name: 'Admin Rehla', role: 'admin' }

function renderWithSession(ui, { user = null, loading = false } = {}) {
  return render(
    <AuthContext value={{ user, token: user ? 'jeton' : null, loading, logout: () => {} }}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthContext>,
  )
}

const becomeProvider = (container = screen) =>
  container.queryByRole('link', { name: 'Devenir prestataire' })

describe('« Devenir prestataire » — NavBar', () => {
  it.each([
    ['un visiteur', null],
    ['un voyageur', TRAVELER],
  ])('visible pour %s', (_label, user) => {
    renderWithSession(<NavBar />, { user })
    expect(becomeProvider()).toHaveAttribute('href', '/inscription?role=prestataire')
  })

  it('absent pour un prestataire, qui garde « Espace prestataire »', () => {
    renderWithSession(<NavBar />, { user: PROVIDER })
    expect(becomeProvider()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Espace prestataire' })).toBeInTheDocument()
  })

  it('absent pour un admin, qui garde « Administration »', () => {
    renderWithSession(<NavBar />, { user: ADMIN })
    expect(becomeProvider()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Administration/ })).toBeInTheDocument()
  })

  it('absent pendant la vérification de la session', () => {
    renderWithSession(<NavBar />, { loading: true })
    expect(becomeProvider()).not.toBeInTheDocument()
  })
})

describe('« Devenir prestataire » — Footer', () => {
  const prestatairesColumn = () => screen.getByRole('navigation', { name: 'Prestataires' })

  it.each([
    ['un visiteur', null],
    ['un voyageur', TRAVELER],
  ])('visible pour %s', (_label, user) => {
    renderWithSession(<Footer />, { user })
    expect(becomeProvider(within(prestatairesColumn()))).toBeInTheDocument()
  })

  it.each([
    ['un prestataire', PROVIDER],
    ['un admin', ADMIN],
  ])('absent pour %s', (_label, user) => {
    renderWithSession(<Footer />, { user })
    expect(becomeProvider()).not.toBeInTheDocument()
    expect(within(prestatairesColumn()).getByRole('link', { name: 'Espace prestataire' }))
      .toBeInTheDocument()
  })
})

describe('« Devenir prestataire » — section Prestataires de l’accueil', () => {
  it.each([
    ['un visiteur', null],
    ['un voyageur', TRAVELER],
  ])('bouton visible pour %s', (_label, user) => {
    renderWithSession(<ProviderSection />, { user })
    expect(becomeProvider()).toHaveAttribute('href', '/inscription?role=prestataire')
  })

  it('« Mon espace prestataire » pour un prestataire connecté', () => {
    renderWithSession(<ProviderSection />, { user: PROVIDER })
    expect(becomeProvider()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mon espace prestataire' })).toHaveAttribute(
      'href',
      '/prestataire/services',
    )
  })

  it('section masquée pour un admin', () => {
    renderWithSession(<ProviderSection />, { user: ADMIN })
    expect(
      screen.queryByRole('heading', { name: 'Faites découvrir votre adresse aux voyageurs' }),
    ).not.toBeInTheDocument()
  })
})
