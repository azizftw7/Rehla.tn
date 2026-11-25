import { apiDelete, apiGet, apiPost, apiPut } from './api.js'

// Partage volontaire de déplacement et co-voyageurs (US5.3, US5.4). Réservé aux voyageurs.

export const MAX_MESSAGE_LENGTH = 200
export const CO_TRAVELERS_PAGE_SIZE = 12
export const MIN_SHARED_DAYS = 3
export const LANGUAGES = ['Arabe', 'Français', 'Anglais', 'Italien', 'Allemand', 'Espagnol']

const DAY_MS = 24 * 60 * 60 * 1000

/** GET /api/trip-shares/me → { items, total, page, pages } (ses partages actifs). */
export function fetchMyTripShares({ page = 1, limit = 50 } = {}, options = {}) {
  return apiGet(`/trip-shares/me?page=${page}&limit=${limit}`, options)
}

/** POST /api/trip-shares → { tripShare } (409 si un de ses partages chevauche ces dates). */
export function createTripShare(body, options = {}) {
  return apiPost('/trip-shares', body, options)
}

/** PUT /api/trip-shares/:id → { tripShare }. */
export function updateTripShare(id, body, options = {}) {
  return apiPut(`/trip-shares/${encodeURIComponent(id)}`, body, options)
}

/** DELETE /api/trip-shares/:id (204). */
export function deleteTripShare(id, options = {}) {
  return apiDelete(`/trip-shares/${encodeURIComponent(id)}`, options)
}

/**
 * GET /api/trip-shares/:id/co-voyageurs?profile&language&minDays&page&limit
 * → { items, total, page, pages, destination, languages }
 */
export function fetchCoTravelers(shareId, params = {}, options = {}) {
  const query = new URLSearchParams()
  Object.entries({ limit: CO_TRAVELERS_PAGE_SIZE, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      query.set(key, String(value))
    }
  })
  return apiGet(`/trip-shares/${encodeURIComponent(shareId)}/co-voyageurs?${query}`, options)
}

/**
 * Nom affiché aux autres voyageurs : prénom et initiale du nom (comme le serveur).
 * « Amel Ben Salah » → « Amel B. »
 */
export function publicName(fullName = '') {
  const [first = '', ...rest] = String(fullName).trim().split(/\s+/)
  const initial = rest.length > 0 ? `${rest[0].charAt(0).toUpperCase()}.` : ''
  return [first, initial].filter(Boolean).join(' ')
}

// Les dates de séjour sont enregistrées à minuit UTC : affichage en UTC (pas de décalage de jour).
const toDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
const format = (date, options) => date.toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' })

/** « 12 – 18 juil. 2026 », « 28 juil. – 3 août 2026 », « 28 déc. 2026 – 3 janv. 2027 ». */
export function formatStay(startValue, endValue) {
  const start = toDate(startValue)
  const end = toDate(endValue)
  if (!start || !end) return null
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()
  const endLabel = format(end, { day: 'numeric', month: 'short', year: 'numeric' })
  if (sameMonth) return `${start.getUTCDate()} – ${endLabel}`
  const startLabel = format(start, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${startLabel} – ${endLabel}`
}

/** « 19 juil. » */
export function formatDayMonth(value) {
  const date = toDate(value)
  return date ? format(date, { day: 'numeric', month: 'short' }) : null
}

/** Lendemain du retour (« AAAA-MM-JJ » ou ISO) : date de suppression automatique du partage. */
export function expiryFromEnd(endValue) {
  const end = toDate(endValue)
  return end ? new Date(end.getTime() + DAY_MS) : null
}

/** « AAAA-MM-JJ » d'une date ISO (pour les champs <input type="date">). */
export function toInputDate(value) {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

/** Aujourd'hui au format « AAAA-MM-JJ » (UTC, comme le serveur). */
export function todayInputDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}
