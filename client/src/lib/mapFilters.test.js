import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  EMPTY_FILTERS,
  getPeriodError,
  parseMapFilters,
  toApiParams,
  toSearchParams,
  withTypes,
} from './mapFilters.js'

const parse = (query) => parseMapFilters(new URLSearchParams(query))

describe('parseMapFilters', () => {
  it('lit plusieurs types dans l’ordre des catégories et ignore les inconnus', () => {
    expect(parse('types=restaurant,inconnu,hebergement').types).toEqual([
      'hebergement',
      'restaurant',
    ])
  })

  it('lit encore l’ancien paramètre « type »', () => {
    expect(parse('type=guide').types).toEqual(['guide'])
    expect(parse('type=transport').transport).toBe(true)
  })

  it('« transport » seul ouvre l’onglet des transports, mélangé il est ignoré', () => {
    expect(parse('types=transport&maxPrice=50')).toEqual({ ...EMPTY_FILTERS, transport: true })
    expect(parse('types=transport,guide')).toMatchObject({ transport: false, types: ['guide'] })
  })

  it('lit le prix, la note, les filtres propres à un type et la période', () => {
    expect(
      parse(
        'maxPrice=100&minRating=4.5&accommodationType=dar&activityCategory=Plage&from=2026-12-01&to=2026-12-31',
      ),
    ).toEqual({
      transport: false,
      types: [],
      price: '100',
      minRating: '4.5',
      accommodationType: 'dar',
      activityCategory: 'Plage',
      from: '2026-12-01',
      to: '2026-12-31',
    })
    expect(parse('free=true&maxPrice=100').price).toBe('gratuit')
  })

  it('ignore les valeurs mal formées', () => {
    expect(
      parse('maxPrice=abc&minRating=9&accommodationType=chateau&from=demain&to=2026-13'),
    ).toEqual(EMPTY_FILTERS)
  })
})

describe('withTypes', () => {
  it('efface les filtres propres à un type qui n’est plus affiché', () => {
    const filters = {
      ...EMPTY_FILTERS,
      types: ['hebergement', 'evenement'],
      price: '50',
      accommodationType: 'dar',
      from: '2026-12-01',
    }

    expect(withTypes(filters, ['evenement'])).toEqual({
      ...filters,
      types: ['evenement'],
      accommodationType: '',
    })
  })

  it('garde tous les filtres quand aucun type n’est choisi (= tous)', () => {
    const filters = { ...EMPTY_FILTERS, types: ['guide'], accommodationType: 'dar' }
    expect(withTypes(filters, [])).toMatchObject({ types: [], accommodationType: 'dar' })
  })
})

describe('toSearchParams / toApiParams', () => {
  it('n’écrit que les valeurs renseignées', () => {
    const filters = { ...EMPTY_FILTERS, types: ['hebergement', 'restaurant'], price: '50' }

    expect(toSearchParams(filters)).toEqual({ types: 'hebergement,restaurant', maxPrice: '50' })
    expect(toSearchParams({ ...EMPTY_FILTERS, price: 'gratuit' })).toEqual({ free: 'true' })
    expect(toSearchParams({ ...EMPTY_FILTERS, transport: true }, { mode: 'bus' })).toEqual({
      types: 'transport',
      mode: 'bus',
    })
  })

  it('n’envoie pas à l’API une période incohérente', () => {
    const filters = { ...EMPTY_FILTERS, from: '2026-12-10', to: '2026-12-01' }

    expect(getPeriodError(filters)).toBe(
      'La date de fin doit être postérieure ou égale à la date de début.',
    )
    expect(toApiParams(filters)).toEqual({})
    expect(getPeriodError({ ...filters, to: '2026-12-10' })).toBeNull()
  })
})

describe('countActiveFilters', () => {
  it('compte les filtres en plus des types, la période pour un seul', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, types: ['guide'] })).toBe(0)
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        price: '50',
        minRating: '4',
        from: '2026-12-01',
        to: '2026-12-31',
      }),
    ).toBe(3)
  })
})
