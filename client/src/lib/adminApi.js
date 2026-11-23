import { apiDelete, apiGet, apiPatch } from './api.js'

// Appels de l'espace administrateur (/api/admin). Réservés aux comptes admin.

export const ROLE_LABELS = {
  voyageur: 'Voyageur',
  prestataire: 'Prestataire',
  admin: 'Administrateur',
}

/** { users: { voyageur, prestataire, admin, total }, suspended, pendingProviders } */
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
