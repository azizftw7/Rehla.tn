import { apiGet } from './api.js'

/** GET /api/transports?destination&type&from&page&limit → { items, total, page, pages }. */
export function fetchTransports(params = {}, options = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  const query = searchParams.toString()
  return apiGet(`/transports${query ? `?${query}` : ''}`, options)
}

/** Prix en dinars : « 45 DT », « 1,5 DT » ; « Prix non communiqué » s'il manque. */
export function formatTransportPrice(price) {
  if (price == null || Number.isNaN(Number(price))) return 'Prix non communiqué'
  return `${Number(price).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} DT`
}

/** Durée en minutes : 450 → « 7 h 30 », 60 → « 1 h », 20 → « 20 min » (null si absente). */
export function formatDuration(minutes) {
  const total = Math.round(Number(minutes))
  if (minutes == null || !Number.isFinite(total) || total <= 0) return null
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  if (rest === 0) return `${hours} h`
  return `${hours} h ${String(rest).padStart(2, '0')}`
}

/**
 * Origine de l'information : « Source : … · mis à jour le 1 octobre 2026 ».
 * Sans date de la source, on prend la date de dernière modification de la fiche.
 */
export function formatTransportSource(transport) {
  const raw = transport?.sourceUpdatedAt ?? transport?.updatedAt
  const date = raw ? new Date(raw) : null
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null

  const parts = []
  if (transport?.source) parts.push(`Source : ${transport.source}`)
  if (dateLabel) parts.push(`${parts.length ? 'mis' : 'Mis'} à jour le ${dateLabel}`)
  return parts.length ? parts.join(' · ') : null
}
