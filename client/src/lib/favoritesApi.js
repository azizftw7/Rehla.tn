import { apiDelete, apiGet, apiPost } from './api.js'

// Favoris du voyageur connecté (US5.1).

export const FAVORITES_PAGE_SIZE = 12

/** GET /api/favorites?page&limit → { items: [{ _id, service, createdAt }], total, page, pages }. */
export function fetchFavorites({ page = 1, limit = FAVORITES_PAGE_SIZE } = {}, options = {}) {
  return apiGet(`/favorites?page=${page}&limit=${limit}`, options)
}

/** GET /api/favorites/ids → { ids } : services en favori (cœurs déjà cochés). */
export function fetchFavoriteIds(options = {}) {
  return apiGet('/favorites/ids', options)
}

/** POST /api/favorites { serviceId } → { favorite } (409 si déjà en favori). */
export function addFavorite(serviceId, options = {}) {
  return apiPost('/favorites', { serviceId }, options)
}

/** DELETE /api/favorites/:serviceId (204 ; 404 s'il n'était pas en favori). */
export function removeFavorite(serviceId, options = {}) {
  return apiDelete(`/favorites/${encodeURIComponent(serviceId)}`, options)
}
