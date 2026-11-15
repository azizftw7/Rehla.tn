import { apiGet } from './api.js'

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
