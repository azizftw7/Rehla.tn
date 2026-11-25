import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api.js'

export function formatServicePrice(service) {
  if (service.free) {
    return { main: 'Gratuit', unit: '' }
  }
  if (service.price?.amount != null) {
    return {
      main: `${service.price.amount} DT`,
      unit: service.price.unit ? `/ ${service.price.unit}` : '',
    }
  }
  return { main: 'Sur demande', unit: '' }
}

// Les dates d'événement sont enregistrées à minuit UTC : on les affiche en UTC pour ne pas
// changer de jour selon le fuseau du navigateur.
const DAY_MONTH = { day: 'numeric', month: 'short', timeZone: 'UTC' }

function formatShortDate(date, withYear) {
  return date.toLocaleDateString('fr-FR', withYear ? { ...DAY_MONTH, year: 'numeric' } : DAY_MONTH)
}

/**
 * Période d'un événement : « Du 12 juil. au 20 août 2026 », « Le 5 déc. 2026 ».
 * Renvoie null si la date de début manque ou est invalide.
 */
export function formatEventPeriod(event) {
  if (!event?.startDate) return null
  const start = new Date(event.startDate)
  if (Number.isNaN(start.getTime())) return null

  const end = event.endDate ? new Date(event.endDate) : null
  const sameDay =
    !end ||
    Number.isNaN(end.getTime()) ||
    end.toISOString().slice(0, 10) === start.toISOString().slice(0, 10)
  if (sameDay) return `Le ${formatShortDate(start, true)}`

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  return `Du ${formatShortDate(start, !sameYear)} au ${formatShortDate(end, true)}`
}

export function fetchServices(params = {}, options = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return apiGet(`/services${query ? `?${query}` : ''}`, options)
}

export function fetchServiceById(id, options = {}) {
  return apiGet(`/services/${encodeURIComponent(id)}`, options)
}

export function fetchDestinationsList(options = {}) {
  return apiGet('/destinations?limit=100', options)
}

/** Réduction d'une offre : « -15 % » ou « 199 DT » (prix réduit). */
export function formatOfferDiscount(offer) {
  if (offer?.discountPercent != null) return `-${offer.discountPercent} %`
  if (offer?.discountedPrice != null) return `${offer.discountedPrice} DT`
  return null
}

/** Fin d'une offre : « jusqu'au 28 février 2027 » (null si la date est invalide). */
export function formatOfferEnd(offer) {
  if (!offer?.endDate) return null
  const end = new Date(offer.endDate)
  if (Number.isNaN(end.getTime())) return null
  const label = end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `jusqu’au ${label}`
}

const YOUTUBE_ID = /^[\w-]{11}$/

/**
 * Adresse d'intégration d'une vidéo YouTube (youtube.com/watch?v=…, youtu.be/…, /embed/…,
 * /shorts/…), ou null si le lien n'est pas une vidéo YouTube reconnue.
 */
export function getYoutubeEmbedUrl(videoUrl) {
  let url
  try {
    url = new URL(videoUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.replace(/^(www\.|m\.)/, '')
  let id = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1)
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/')
    if (first === 'watch') id = url.searchParams.get('v')
    else if (first === 'embed' || first === 'shorts') id = second
  }

  return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

/**
 * POST /api/provider/services (prestataire connecté) → { service }.
 * formData : champs à plat + jusqu'à 5 fichiers « photos » (multipart/form-data).
 */
export function createService(formData, options = {}) {
  return apiPost('/provider/services', formData, options)
}

// ---------- Espace prestataire : ses propres services (masqués compris) ----------

/** GET /api/provider/services?page&limit → { items, total, page, pages }. */
export function fetchMyServices({ page = 1, limit = 12 } = {}, options = {}) {
  return apiGet(`/provider/services?page=${page}&limit=${limit}`, options)
}

/** GET /api/provider/services/:id → { service } (404 si le service n'est pas le sien). */
export function fetchMyService(id, options = {}) {
  return apiGet(`/provider/services/${encodeURIComponent(id)}`, options)
}

/**
 * PUT /api/provider/services/:id → { service }.
 * formData : mêmes champs que la création + keptPhotos (anciennes photos gardées) + nouvelles « photos ».
 */
export function updateService(id, formData, options = {}) {
  return apiPut(`/provider/services/${encodeURIComponent(id)}`, formData, options)
}

/** PATCH /api/provider/services/:id/visibilite → { service }. */
export function setServiceHidden(id, hidden, options = {}) {
  return apiPatch(`/provider/services/${encodeURIComponent(id)}/visibilite`, { hidden }, options)
}

/** DELETE /api/provider/services/:id (204). */
export function deleteService(id, options = {}) {
  return apiDelete(`/provider/services/${encodeURIComponent(id)}`, options)
}

/** GET /api/services/languages (US4.2) → { languages } : langues parlées par les guides. */
export function fetchGuideLanguages(options = {}) {
  return apiGet('/services/languages', options)
}
