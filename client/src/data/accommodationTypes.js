/** Types d'hébergement (valeurs de Service.accommodationType) et leur libellé affiché. */
export const ACCOMMODATION_TYPES = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'maison-hotes', label: 'Maison d’hôtes' },
  { value: 'dar', label: 'Dar' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'camping', label: 'Camping' },
]

const LABELS = Object.fromEntries(ACCOMMODATION_TYPES.map((item) => [item.value, item.label]))

/** Libellé d'un type d'hébergement (null si absent ou inconnu). */
export function getAccommodationLabel(value) {
  return LABELS[value] || null
}
