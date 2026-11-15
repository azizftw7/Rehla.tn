// Outils partagés par les pages Connexion et Inscription.

const AUTH_PAGES = ['/connexion', '/inscription']

/**
 * Page où renvoyer l'utilisateur après connexion : celle demandée avant la redirection
 * (state.from posé par ProtectedRoute), sinon l'accueil.
 */
export function getRedirectTarget(location) {
  const from = location.state?.from
  if (!from?.pathname || AUTH_PAGES.includes(from.pathname)) return '/'
  return `${from.pathname}${from.search || ''}${from.hash || ''}`
}

/**
 * Répartit une erreur de l'API : les details[] dont le champ est affiché vont sous ce champ,
 * le reste devient un message général.
 */
export function splitApiError(error, fields) {
  const fieldErrors = {}
  for (const detail of error?.details || []) {
    if (fields.includes(detail.field) && !fieldErrors[detail.field]) {
      fieldErrors[detail.field] = detail.message
    }
  }
  const hasFieldError = Object.keys(fieldErrors).length > 0
  const general = hasFieldError
    ? null
    : error?.message || 'Une erreur est survenue. Réessayez plus tard.'
  return { fieldErrors, general }
}

/**
 * Retire les champs vides : le serveur répond alors « … est obligatoire. ».
 * Les valeurs ne sont pas modifiées (le serveur nettoie les espaces ; un mot de passe reste tel quel).
 */
export function withoutEmpty(values) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => !(typeof value === 'string' && value.trim() === ''),
    ),
  )
}

/** Identifiant HTML d'un champ (« provider.city » → « inscription-provider-city »). */
export function fieldId(prefix, field) {
  return `${prefix}-${field.replace('.', '-')}`
}
