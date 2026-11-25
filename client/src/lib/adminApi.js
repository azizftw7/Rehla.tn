import { apiDelete, apiGet, apiPatch } from './api.js'

// Appels de l'espace administrateur (/api/admin). Réservés aux comptes admin.

export const ROLE_LABELS = {
  voyageur: 'Voyageur',
  prestataire: 'Prestataire',
  admin: 'Administrateur',
}

/**
 * { users: { voyageur, prestataire, admin, total }, suspended, pendingProviders,
 *   reviews, tripShares, services: { total, hidden } } (compteurs de contenus : US7.2)
 */
export function fetchAdminStats(options) {
  return apiGet('/admin/stats', options)
}

/** Liste paginée : filtres role, status, approval, search, page, limit (vides ignorés). */
export function fetchAdminUsers(params = {}, options) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const qs = query.toString()
  return apiGet(`/admin/users${qs ? `?${qs}` : ''}`, options)
}

export function setUserStatus(id, status) {
  return apiPatch(`/admin/users/${id}/statut`, { status })
}

/** decision : 'approuve' | 'refuse' ; reason : motif facultatif d'un refus. */
export function reviewProvider(id, decision, reason) {
  return apiPatch(`/admin/users/${id}/validation`, reason ? { decision, reason } : { decision })
}

export function deleteUser(id) {
  return apiDelete(`/admin/users/${id}`)
}

// Signal « les comptes ont changé » : la NavBar met alors à jour son compteur de demandes.
const ADMIN_CHANGE_EVENT = 'rehla:admin-change'

export function notifyAdminChange() {
  window.dispatchEvent(new Event(ADMIN_CHANGE_EVENT))
}

export function onAdminChange(handler) {
  window.addEventListener(ADMIN_CHANGE_EVENT, handler)
  return () => window.removeEventListener(ADMIN_CHANGE_EVENT, handler)
}

// ---------- US7.2 : modération des contenus ----------

const withQuery = (path, params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const qs = query.toString()
  return `${path}${qs ? `?${qs}` : ''}`
}

/** GET /api/admin/reviews?search&page&limit → { items, total, page, pages } */
export function fetchAdminReviews(params, options) {
  return apiGet(withQuery('/admin/reviews', params), options)
}

/** DELETE /api/admin/reviews/:id (204) : la note du service est recalculée. */
export function deleteAdminReview(id) {
  return apiDelete(`/admin/reviews/${id}`)
}

/** GET /api/admin/services?search&type&hidden&page&limit → { items, total, page, pages } */
export function fetchAdminServices(params, options) {
  return apiGet(withQuery('/admin/services', params), options)
}

/** PATCH /api/admin/services/:id/visibilite { hidden } → { service } */
export function setAdminServiceHidden(id, hidden) {
  return apiPatch(`/admin/services/${id}/visibilite`, { hidden })
}

/** DELETE /api/admin/services/:id (204) : avec ses photos, offres, avis et favoris. */
export function deleteAdminService(id) {
  return apiDelete(`/admin/services/${id}`)
}

/** GET /api/admin/trip-shares?search&page&limit → { items, total, page, pages } */
export function fetchAdminTripShares(params, options) {
  return apiGet(withQuery('/admin/trip-shares', params), options)
}

/** DELETE /api/admin/trip-shares/:id (204). */
export function deleteAdminTripShare(id) {
  return apiDelete(`/admin/trip-shares/${id}`)
}
