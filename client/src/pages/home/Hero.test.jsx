import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '../../test/utils.jsx'
import Hero from './Hero.jsx'

describe('Hero de l’accueil', () => {
  it('affiche le titre et la grande barre de recherche', () => {
    renderWithRouter(<Hero />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Toute la Tunisie, sur une seule carte' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Destination' })).toHaveAttribute(
      'id',
      'recherche',
    )
  })

  it('propose les 6 filtres rapides, activables au clavier', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Hero />)
    const filters = screen.getByRole('group', { name: 'Filtres rapides par type' })
    const labels = ['Hébergement', 'Restaurant', 'Activité', 'Événement', 'Guide', 'Transport']

    for (const label of labels) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(filters.children).toHaveLength(6)

    screen.getByRole('button', { name: 'Guide' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Guide' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lance la recherche avec le texte et les filtres choisis', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Hero />)

    await user.type(screen.getByRole('searchbox', { name: 'Destination' }), '  Djerba ')
    await user.click(screen.getByRole('button', { name: 'Hébergement' }))
    await user.click(screen.getByRole('button', { name: 'Guide' }))
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/destinations?search=Djerba&types=hebergement%2Cguide',
    )
  })

  it('désactive un filtre au second clic', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Hero />)
    const filter = screen.getByRole('button', { name: 'Restaurant' })

    await user.click(filter)
    await user.click(filter)

    expect(filter).toHaveAttribute('aria-pressed', 'false')
  })
})
