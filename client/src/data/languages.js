// Langues parlées par les guides (US4.2). Les prestataires les saisissent librement
// (« français, arabe ») : on les affiche avec une majuscule.

/** « français » → « Français ». */
export function formatLanguage(value = '') {
  const text = String(value).trim()
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1)
}

/**
 * Liste courte pour une carte : « Français, Arabe, Anglais +1 » (null si la liste est vide).
 * max : nombre de langues écrites en entier.
 */
export function formatLanguageList(languages, max = 3) {
  if (!Array.isArray(languages) || languages.length === 0) return null
  const shown = languages.slice(0, max).map(formatLanguage).join(', ')
  const rest = languages.length - max
  return rest > 0 ? `${shown} +${rest}` : shown
}

/** Langues proposées dans le panneau Filtres de la carte (US2.3 + US4.2). */
export const GUIDE_LANGUAGES = [
  'Arabe',
  'Français',
  'Anglais',
  'Italien',
  'Allemand',
  'Espagnol',
  'Russe',
  'Chinois',
]
