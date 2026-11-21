// Validation d'un compte prestataire par l'administrateur (provider.approval).

/** Vrai si le compte prestataire a été validé par l'administrateur. */
export function isApprovedProvider(user) {
  return user?.role === 'prestataire' && user.provider?.approval === 'approuve'
}

/** Vrai si la demande a été refusée (le motif est dans user.provider.rejectionReason). */
export function isRejectedProvider(user) {
  return user?.role === 'prestataire' && user.provider?.approval === 'refuse'
}
