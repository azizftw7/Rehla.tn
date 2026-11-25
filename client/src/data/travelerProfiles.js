/** Profils de voyageur (valeurs de User.profile) et leur libellé affiché. */
export const TRAVELER_PROFILES = [
  { value: 'etudiant', label: 'Étudiant' },
  { value: 'resident', label: 'Résident' },
  { value: 'touriste', label: 'Touriste' },
]

const LABELS = Object.fromEntries(TRAVELER_PROFILES.map((item) => [item.value, item.label]))

/** Libellé d'un profil (null si absent ou inconnu). */
export function getProfileLabel(value) {
  return LABELS[value] || null
}
