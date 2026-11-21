import { apiPut } from './api.js'

// Appels « Mon compte » (/api/users/me…), pour tout utilisateur connecté.

/** Change le mot de passe : le mot de passe actuel est vérifié par le serveur. */
export function changePassword({ currentPassword, newPassword }) {
  return apiPut('/users/me/password', { currentPassword, newPassword })
}
