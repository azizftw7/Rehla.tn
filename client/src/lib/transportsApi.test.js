import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../test/utils.jsx'
import {
  fetchTransports,
  formatDuration,
  formatTransportPrice,
  formatTransportSource,
} from './transportsApi.js'

describe('formatDuration', () => {
  it('affiche les heures et les minutes', () => {
    expect(formatDuration(450)).toBe('7 h 30')
    expect(formatDuration(65)).toBe('1 h 05')
  })

  it('affiche les heures pleines ou les minutes seules', () => {
    expect(formatDuration(480)).toBe('8 h')
    expect(formatDuration(20)).toBe('20 min')
  })

  it('renvoie null sans durée valide', () => {
    expect(formatDuration(undefined)).toBeNull()
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
    expect(formatDuration('abc')).toBeNull()
  })
})

describe('formatTransportPrice', () => {
  it('affiche le prix en dinars', () => {
    expect(formatTransportPrice(45)).toBe('45 DT')
    expect(formatTransportPrice(1.5)).toBe('1,5 DT')
  })

  it('signale un prix manquant', () => {
    expect(formatTransportPrice(undefined)).toBe('Prix non communiqué')
  })
})

describe('formatTransportSource', () => {
  it('affiche la source et la date de mise à jour', () => {
    expect(formatTransportSource({ source: 'Démo', sourceUpdatedAt: '2026-10-01T00:00:00Z' })).toBe(
      'Source : Démo · mis à jour le 1 octobre 2026',
    )
  })

  it('utilise la date de modification de la fiche à défaut', () => {
    expect(formatTransportSource({ updatedAt: '2026-11-02T10:00:00Z' })).toBe(
      'Mis à jour le 2 novembre 2026',
    )
  })

  it('renvoie null sans source ni date', () => {
    expect(formatTransportSource({})).toBeNull()
  })
})

describe('fetchTransports', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('appelle GET /transports sans les paramètres vides', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [], total: 0, page: 1, pages: 0 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchTransports({ destination: 'djerba', type: '', limit: 100 })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/transports\?destination=djerba&limit=100$/),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
