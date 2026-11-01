import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '../hooks/useTheme.js'
import { LocationDisplay, mockSystemTheme, renderWithRouter } from '../test/utils.jsx'
import NavBar from './NavBar.jsx'

const html = document.documentElement

describe('NavBar — thème clair / sombre', () => {
  it('suit le thème du système par défaut', () => {
    mockSystemTheme('dark')

    renderWithRouter(<NavBar />)

    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(screen.getByRole('button', { name: 'Activer le thème clair' })).toBeInTheDocument()
  })

  it('bascule le thème au clic et mémorise le choix', async () => {
    const user = userEvent.setup()
    renderWithRouter(<NavBar />)
    expect(html).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Activer le thème sombre' }))

    expect(html).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Activer le thème clair' })).toBeInTheDocument()
  })

  it('le choix mémorisé l’emporte sur le thème du système', () => {
    mockSystemTheme('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'light')

    renderWithRouter(<NavBar />)

    expect(html).toHaveAttribute('data-theme', 'light')
  })

  it('suit les changements du système tant que l’utilisateur n’a rien choisi', () => {
    const changeSystemTheme = mockSystemTheme('light')
    renderWithRouter(<NavBar />)

    act(() => changeSystemTheme('dark'))

    expect(html).toHaveAttribute('data-theme', 'dark')
  })
})

describe('NavBar — navigation', () => {
  it('affiche le logo et les liens principaux', () => {
    renderWithRouter(<NavBar />)

    expect(screen.getByRole('link', { name: /rehla\.tn/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Destinations' })).toHaveAttribute(
      'href',
      '/destinations',
    )
    expect(screen.getByRole('link', { name: 'Partage de voyage' })).toHaveAttribute(
      'href',
      '/partage',
    )
    expect(screen.getByRole('link', { name: 'Devenir prestataire' })).toHaveAttribute(
      'href',
      '/inscription?role=prestataire',
    )
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/connexion')
    expect(screen.getByRole('link', { name: 'Inscription' })).toHaveAttribute(
      'href',
      '/inscription',
    )
  })

  it('ouvre et ferme le menu mobile, y compris avec Échap', async () => {
    const user = userEvent.setup()
    renderWithRouter(<NavBar />)
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    expect(burger).toHaveAttribute('aria-expanded', 'false')

    await user.click(burger)
    expect(burger).toHaveAttribute('aria-expanded', 'true')
    expect(burger).toHaveAccessibleName('Fermer le menu')

    await user.keyboard('{Escape}')
    expect(burger).toHaveAttribute('aria-expanded', 'false')
    expect(burger).toHaveFocus()
  })

  it('ferme le menu mobile quand on change de page', async () => {
    const user = userEvent.setup()
    // La barre reste affichée pendant la navigation, comme dans le vrai Layout.
    render(
      <MemoryRouter>
        <NavBar />
        <LocationDisplay />
      </MemoryRouter>,
    )
    const burger = screen.getByRole('button', { name: 'Ouvrir le menu' })
    await user.click(burger)

    await user.click(screen.getByRole('link', { name: 'Destinations' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/destinations')
    expect(burger).toHaveAttribute('aria-expanded', 'false')
  })
})
