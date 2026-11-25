import { ACCOMMODATION_TYPES } from '../data/accommodationTypes.js'
import { CATEGORIES } from '../data/categories.js'

// Filtres de la carte d'une destination (US2.3), synchronisés avec l'URL :
// ?types=hebergement,restaurant&maxPrice=100&minRating=4&accommodationType=dar
//   &activityCategory=Plage&from=2026-12-01&to=2026-12-31&language=Espagnol (US4.2)
// L'onglet Transports reste à part : ?types=transport&mode=bus (l'ancien ?type= est encore lu).

/** Types de service affichables sur la carte (dans l'ordre des catégories). */
export const MAP_SERVICE_TYPES = CATEGORIES.map((cat) => cat.type).filter(
  (type) => type !== 'transport',
)

export const FREE_PRICE = 'gratuit'

export const PRICE_OPTIONS = [
  { value: '', label: 'Tous les prix' },
  { value: FREE_PRICE, label: 'Gratuit uniquement' },
  { value: '20', label: 'Jusqu’à 20 DT' },
  { value: '50', label: 'Jusqu’à 50 DT' },
  { value: '100', label: 'Jusqu’à 100 DT' },
  { value: '200', label: 'Jusqu’à 200 DT' },
]

export const RATING_OPTIONS = [
  { value: '', label: 'Toutes les notes' },
  { value: '3', label: '3 étoiles et plus' },
  { value: '4', label: '4 étoiles et plus' },
  { value: '4.5', label: '4,5 étoiles et plus' },
]

const ACCOMMODATION_VALUES = ACCOMMODATION_TYPES.map((item) => item.value)
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Filtre propre à un type → ce type (le filtre n'a de sens que si le type est affiché).
const TYPE_OF_FILTER = {
  accommodationType: 'hebergement',
  activityCategory: 'activite',
  from: 'evenement',
  to: 'evenement',
  language: 'guide',
}

export const EMPTY_FILTERS = {
  transport: false,
  types: [],
  price: '',
  minRating: '',
  accommodationType: '',
  activityCategory: '',
  from: '',
  to: '',
  language: '',
}

function validDate(value) {
  return DATE_REGEX.test(value || '') ? value : ''
}

/** Le filtre propre à `type` est-il utile avec les types sélectionnés (aucun = tous) ? */
export function appliesTo(filters, type) {
  return filters.types.length === 0 || filters.types.includes(type)
}

/** Lit les filtres dans l'URL ; les valeurs inconnues ou mal formées sont ignorées. */
export function parseMapFilters(searchParams) {
  const raw = (searchParams.get('types') ?? searchParams.get('type') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const types = MAP_SERVICE_TYPES.filter((type) => raw.includes(type))
  // « Transports » seul : onglet des transports. Mélangé à d'autres types, il est ignoré.
  const transport = types.length === 0 && raw.includes('transport')

  const maxPrice = searchParams.get('maxPrice')
  const price =
    searchParams.get('free') === 'true'
      ? FREE_PRICE
      : maxPrice && Number(maxPrice) >= 0
        ? String(Number(maxPrice))
        : ''

  const rating = Number(searchParams.get('minRating'))
  const minRating = rating >= 1 && rating <= 5 ? String(rating) : ''

  const accommodationType = searchParams.get('accommodationType') || ''

  const filters = {
    transport,
    types,
    price,
    minRating,
    accommodationType: ACCOMMODATION_VALUES.includes(accommodationType) ? accommodationType : '',
    activityCategory: (searchParams.get('activityCategory') || '').trim().slice(0, 60),
    from: validDate(searchParams.get('from')),
    to: validDate(searchParams.get('to')),
    language: (searchParams.get('language') || '').trim().slice(0, 40),
  }
  return transport ? { ...EMPTY_FILTERS, transport: true } : filters
}

/** Message si la période est incohérente (fin avant début), sinon null. */
export function getPeriodError(filters) {
  return filters.from && filters.to && filters.to < filters.from
    ? 'La date de fin doit être postérieure ou égale à la date de début.'
    : null
}

/**
 * Nouveaux filtres après un changement de types : les filtres propres à un type
 * qui n'est plus affiché sont effacés (ils ne resteraient pas actifs sans être visibles).
 */
export function withTypes(filters, types) {
  const next = {
    ...filters,
    transport: false,
    types: MAP_SERVICE_TYPES.filter((type) => types.includes(type)),
  }
  Object.entries(TYPE_OF_FILTER).forEach(([key, type]) => {
    if (!appliesTo(next, type)) next[key] = ''
  })
  return next
}

/** Paramètres d'URL (les valeurs vides ne sont pas écrites). */
export function toSearchParams(filters, extra = {}) {
  const params = {}
  if (filters.transport) {
    params.types = 'transport'
  } else {
    if (filters.types.length > 0) params.types = filters.types.join(',')
    if (filters.price === FREE_PRICE) params.free = 'true'
    else if (filters.price) params.maxPrice = filters.price
    ;['minRating', 'accommodationType', 'activityCategory', 'from', 'to', 'language'].forEach(
      (key) => {
        if (filters[key]) params[key] = filters[key]
      },
    )
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params[key] = value
  })
  return params
}

/** Paramètres de GET /api/services (une période incohérente n'est pas envoyée). */
export function toApiParams(filters) {
  const params = toSearchParams(filters)
  if (getPeriodError(filters)) {
    delete params.from
    delete params.to
  }
  return params
}

/** Nombre de filtres actifs en plus des types (pour le bouton « Filtres »). */
export function countActiveFilters(filters) {
  const simple = ['price', 'minRating', 'accommodationType', 'activityCategory', 'language'].filter(
    (key) => filters[key],
  ).length
  // La période compte pour un seul filtre.
  return simple + (filters.from || filters.to ? 1 : 0)
}

/** Les filtres (types compris) réduisent-ils la liste ? */
export function hasAnyFilter(filters) {
  return filters.types.length > 0 || countActiveFilters(filters) > 0
}
