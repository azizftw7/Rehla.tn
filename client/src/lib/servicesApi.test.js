import { describe, expect, it } from 'vitest'
import {
  formatEventPeriod,
  formatOfferDiscount,
  formatOfferEnd,
  getYoutubeEmbedUrl,
} from './servicesApi.js'

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

describe('offres (US3.1)', () => {
  it('affiche la réduction en pourcentage ou le prix réduit', () => {
    expect(formatOfferDiscount({ discountPercent: 15 })).toBe('-15 %')
    expect(formatOfferDiscount({ discountedPrice: 199 })).toBe('199 DT')
    expect(formatOfferDiscount({})).toBeNull()
  })

  it('affiche la date de fin de l’offre', () => {
    expect(formatOfferEnd({ endDate: '2027-02-28T00:00:00.000Z' })).toBe('jusqu’au 28 février 2027')
    expect(formatOfferEnd({ endDate: 'pas une date' })).toBeNull()
    expect(formatOfferEnd({})).toBeNull()
  })
})

describe('getYoutubeEmbedUrl', () => {
  const EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'

  it('reconnaît les différents formats de lien YouTube', () => {
    expect(getYoutubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe(EMBED)
    expect(getYoutubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(EMBED)
    expect(getYoutubeEmbedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(EMBED)
    expect(getYoutubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(EMBED)
    expect(getYoutubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(EMBED)
  })

  it('renvoie null pour un autre site ou un lien invalide', () => {
    expect(getYoutubeEmbedUrl('https://vimeo.com/123456')).toBeNull()
    expect(getYoutubeEmbedUrl('https://www.youtube.com/watch?v=<script>')).toBeNull()
    expect(getYoutubeEmbedUrl('javascript:alert(1)')).toBeNull()
    expect(getYoutubeEmbedUrl('pas une url')).toBeNull()
    expect(getYoutubeEmbedUrl(undefined)).toBeNull()
  })
})
