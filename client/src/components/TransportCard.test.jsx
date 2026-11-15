import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TransportCard from './TransportCard.jsx'

const LOUAGE = {
  _id: 't1',
  type: 'louage',
  from: 'Tunis',
  to: 'Djerba',
  price: 45,
  duration: 450,
  schedule: 'Départ dès que le louage est complet',
  operator: 'Station de louages de Tunis',
  source: 'Données de démonstration',
  sourceUpdatedAt: '2026-10-01T00:00:00.000Z',
}

describe('TransportCard', () => {
  it('affiche le type, le trajet, l’opérateur, le prix, la durée, les horaires et la source', () => {
    render(<TransportCard transport={LOUAGE} />)

    expect(screen.getByText('Louage')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Tunis → Djerba' })).toBeInTheDocument()
    expect(screen.getByText('Station de louages de Tunis')).toBeInTheDocument()
    expect(screen.getByText('45 DT')).toBeInTheDocument()
    expect(screen.getByText('7 h 30')).toBeInTheDocument()
    expect(screen.getByText('Départ dès que le louage est complet')).toBeInTheDocument()
    expect(
      screen.getByText('Source : Données de démonstration · mis à jour le 1 octobre 2026'),
    ).toBeInTheDocument()
    // Libellés pour les lecteurs d'écran (les icônes sont décoratives).
    expect(screen.getByText(/Durée :/)).toHaveClass('visually-hidden')
  })

  it('n’affiche pas les informations manquantes', () => {
    render(<TransportCard transport={{ _id: 't2', type: 'ferry', from: 'Jorf', to: 'Ajim' }} />)

    expect(screen.getByText('Ferry')).toBeInTheDocument()
    expect(screen.getByText('Prix non communiqué')).toBeInTheDocument()
    expect(screen.queryByText(/Durée :/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Source/)).not.toBeInTheDocument()
  })
})
