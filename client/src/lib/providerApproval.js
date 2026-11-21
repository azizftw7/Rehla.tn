// Validation d'un compte prestataire par l'administrateur (provider.approval).

/** Vrai si le compte prestataire a été validé par l'administrateur. */
export function isApprovedProvider(user) {
  return user?.role === 'prestataire' && user.provider?.approval === 'approuve'
}

/** Vrai si la demande a été refusée (le motif est dans user.provider.rejectionReason). */
export function isRejectedProvider(user) {
  return user?.role === 'prestataire' && user.provider?.approval === 'refuse'
}

/**
 * Le lien « Devenir prestataire » n'a de sens que pour un visiteur ou un voyageur.
 * Masqué pendant la vérification de la session (évite un clignotement).
 */
export function canBecomeProvider({ user, loading }) {
  return !loading && (!user || user.role === 'voyageur')
}
