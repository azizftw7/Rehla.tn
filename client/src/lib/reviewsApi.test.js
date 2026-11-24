import { describe, expect, it } from 'vitest'
import { formatRating, formatReviewDate, isEdited } from './reviewsApi.js'

describe('reviewsApi — formatage', () => {
  it('formatRating : une décimale et la virgule française', () => {
    expect(formatRating(4.5)).toBe('4,5')
    expect(formatRating(4)).toBe('4,0')
    expect(formatRating(undefined)).toBe('0,0')
  })

  it('formatReviewDate : date longue en français, null si invalide', () => {
    expect(formatReviewDate('2026-03-12T10:00:00.000Z')).toBe('12 mars 2026')
    expect(formatReviewDate('pas une date')).toBeNull()
    expect(formatReviewDate(undefined)).toBeNull()
  })

  it('isEdited : vrai seulement si l’avis a changé plus d’une minute après sa publication', () => {
    const createdAt = '2026-11-10T10:00:00.000Z'
    expect(isEdited({ createdAt, updatedAt: '2026-11-10T10:00:30.000Z' })).toBe(false)
    expect(isEdited({ createdAt, updatedAt: '2026-11-12T08:00:00.000Z' })).toBe(true)
    expect(isEdited({})).toBe(false)
  })
})
