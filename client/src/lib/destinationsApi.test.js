import { describe, expect, it } from 'vitest'
import { toLatLng } from './destinationsApi.js'

describe('toLatLng', () => {
  it('inverse [longitude, latitude] en [latitude, longitude]', () => {
    expect(toLatLng({ type: 'Point', coordinates: [10.3417, 36.8687] })).toEqual([36.8687, 10.3417])
  })

  it('renvoie null si la localisation est absente ou incomplète', () => {
    expect(toLatLng(undefined)).toBeNull()
    expect(toLatLng(null)).toBeNull()
    expect(toLatLng({})).toBeNull()
    expect(toLatLng({ coordinates: [10.3] })).toBeNull()
  })

  it('renvoie null si les coordonnées ne sont pas des nombres valides', () => {
    expect(toLatLng({ coordinates: ['10', '36'] })).toBeNull()
    expect(toLatLng({ coordinates: [Number.NaN, 36] })).toBeNull()
    expect(toLatLng({ coordinates: [10, 120] })).toBeNull()
    expect(toLatLng({ coordinates: [200, 36] })).toBeNull()
  })
})
