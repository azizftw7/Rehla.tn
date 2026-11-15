import { describe, expect, it } from 'vitest'
import { formatEventPeriod } from './servicesApi.js'

describe('formatEventPeriod', () => {
  it('affiche une période sur la même année', () => {
    expect(
      formatEventPeriod({
        startDate: '2026-07-12T00:00:00.000Z',
        endDate: '2026-08-20T00:00:00.000Z',
      }),
    ).toBe('Du 12 juil. au 20 août 2026')
  })

  it('précise les deux années quand la période change d’année', () => {
    expect(formatEventPeriod({ startDate: '2026-12-28', endDate: '2027-01-03' })).toBe(
      'Du 28 déc. 2026 au 3 janv. 2027',
    )
  })

  it('affiche une seule date pour un événement d’un jour ou sans date de fin', () => {
    expect(formatEventPeriod({ startDate: '2026-12-05' })).toBe('Le 5 déc. 2026')
    expect(formatEventPeriod({ startDate: '2026-12-05', endDate: '2026-12-05' })).toBe(
      'Le 5 déc. 2026',
    )
  })

  it('renvoie null sans date de début valide', () => {
    expect(formatEventPeriod(undefined)).toBeNull()
    expect(formatEventPeriod({})).toBeNull()
    expect(formatEventPeriod({ startDate: 'pas une date' })).toBeNull()
  })
})
