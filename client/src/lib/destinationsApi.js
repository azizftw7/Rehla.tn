import { apiGet } from './api.js'

/** GET /api/destinations?search=&page=&limit= → { items, total, page, pages } */
export function fetchDestinations({ search, page, limit } = {}, options = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (page) params.set('page', String(page))
  if (limit) params.set('limit', String(limit))
  const query = params.toString()
  return apiGet(`/destinations${query ? `?${query}` : ''}`, options)
}

/** GET /api/destinations/:slug → { destination } */
export function fetchDestinationBySlug(slug, options = {}) {
  return apiGet(`/destinations/${encodeURIComponent(slug)}`, options)
}

/**
 * Convertit un Point GeoJSON ({ coordinates: [longitude, latitude] }) en [latitude, longitude]
 * pour Leaflet. Renvoie null si les coordonnées sont absentes ou invalides.
 */
export function toLatLng(location) {
  const coordinates = location?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null

  const [lng, lat] = coordinates
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return [lat, lng]
}
