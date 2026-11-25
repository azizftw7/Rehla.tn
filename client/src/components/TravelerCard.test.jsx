import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatStay, publicName } from '../lib/tripSharesApi.js'
import TravelerCard from './TravelerCard.jsx'

describe('TravelerCard (US5.3, US5.4)', () => {
  it('affiche toutes les informations rendues visibles', () => {
    render(
      <TravelerCard
        destination="Djerba"
        traveler={{
          name: 'Karim T.',
          profile: 'resident',
          city: 'Sfax',
          languages: ['Arabe', 'Anglais'],
          avatarUrl: 'https://example.com/karim.png',
          startDate: '2026-07-12T00:00:00.000Z',
          endDate: '2026-07-18T00:00:00.000Z',
          message: 'Kayak à plusieurs ?',
          overlapDays: 5,
        }}
      />,
    )
    const card = screen.getByRole('article')
    expect(within(card).getByRole('heading', { name: 'Karim T.' })).toBeInTheDocument()
    expect(within(card).getByText('Résident')).toBeInTheDocument()
    expect(within(card).getByText('Sfax')).toBeInTheDocument()
    expect(within(card).getByText('Djerba')).toBeInTheDocument()
    expect(within(card).getByText('12 – 18 juil. 2026')).toBeInTheDocument()
    expect(within(card).getByText('5 jours en commun')).toBeInTheDocument()
    expect(within(card).getByText('« Kayak à plusieurs ? »')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Photo de Karim T.' })).toBeInTheDocument()
    const languages = within(card).getByRole('list', { name: 'Langues parlées' })
    expect(within(languages).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Arabe',
      'Anglais',
    ])
  })

  it('n’affiche que le prénom, l’initiale et les dates quand rien d’autre n’est visible', () => {
    render(
      <TravelerCard
        traveler={{
          name: 'Sofia R.',
          startDate: '2026-07-16T00:00:00.000Z',
          endDate: '2026-07-18T00:00:00.000Z',
          overlapDays: 1,
        }}
      />,
    )
    const card = screen.getByRole('article')
    expect(card).toHaveTextContent('Sofia R.')
    expect(card).toHaveTextContent('1 jour en commun')
    expect(within(card).queryByRole('img')).not.toBeInTheDocument()
    expect(within(card).queryByRole('list')).not.toBeInTheDocument()
    expect(card.textContent).not.toMatch(/Étudiant|Résident|Touriste|«/)
  })
})

describe('tripSharesApi — mise en forme', () => {
  it('publicName garde le prénom et l’initiale du nom', () => {
    expect(publicName('Amel Ben Salah')).toBe('Amel B.')
    expect(publicName('Karim')).toBe('Karim')
  })

  it('formatStay regroupe le mois et l’année quand c’est possible', () => {
    expect(formatStay('2026-07-28', '2026-08-03')).toBe('28 juil. – 3 août 2026')
    expect(formatStay('2026-12-28', '2027-01-03')).toBe('28 déc. 2026 – 3 janv. 2027')
    expect(formatStay(null, '2026-08-03')).toBeNull()
  })
})
