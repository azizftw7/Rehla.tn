// Outils du formulaire « Publier un service » (NewServicePage).

export const MAX_PHOTOS = 5
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const ACTIVITY_CATEGORY_SUGGESTIONS = [
  'Plage',
  'Site historique',
  'Sports nautiques',
  'Désert',
  'Culture et artisanat',
  'Randonnée',
]

// Unités de prix proposées selon le type (saisie libre possible).
export const PRICE_UNITS = {
  hebergement: ['nuit', 'semaine'],
  restaurant: ['repas', 'personne'],
  activite: ['personne', 'heure', 'groupe'],
  evenement: ['entrée', 'personne'],
  guide: ['heure', 'demi-journée', 'journée'],
}

// Champs propres à chaque type (noms attendus par l'API).
export const TYPE_FIELDS = {
  hebergement: ['accommodationType'],
  restaurant: ['cuisine'],
  activite: ['activityCategory'],
  evenement: ['eventType', 'startDate', 'endDate', 'hours'],
  guide: ['languages'],
}

export const COMMON_FIELDS = ['name', 'description', 'destination', 'address']
export const CONTACT_FIELDS = ['phone', 'website', 'videoUrl']

// Ordre d'affichage : sert à placer le focus sur le premier champ en erreur.
export const ALL_FIELDS = [
  'type',
  ...COMMON_FIELDS,
  'price',
  'priceUnit',
  ...Object.values(TYPE_FIELDS).flat(),
  ...CONTACT_FIELDS,
  'photos',
  'latitude',
  'longitude',
]

export const EMPTY_VALUES = {
  name: '',
  description: '',
  destination: '',
  address: '',
  price: '',
  priceUnit: '',
  accommodationType: '',
  cuisine: '',
  activityCategory: '',
  eventType: '',
  startDate: '',
  endDate: '',
  hours: '',
  languages: '',
  phone: '',
  website: '',
  videoUrl: '',
  latitude: '',
  longitude: '',
}

/** Vérifie les fichiers choisis (avant l'envoi) : renvoie les fichiers gardés et un message. */
export function checkPhotos(current, files) {
  const kept = []
  let error = null
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      error = `« ${file.name} » n’est pas une image JPEG, PNG ou WebP.`
    } else if (file.size > MAX_PHOTO_SIZE) {
      error = `« ${file.name} » dépasse 5 Mo.`
    } else if (current.length + kept.length >= MAX_PHOTOS) {
      error = `Vous pouvez ajouter au plus ${MAX_PHOTOS} photos.`
    } else {
      kept.push(file)
    }
  }
  return { kept, error }
}

/** Construit le FormData envoyé à l'API (champs vides et champs d'un autre type omis). */
export function buildFormData(type, values, free, photos) {
  const data = new FormData()
  data.append('type', type)
  const fields = [
    ...COMMON_FIELDS,
    ...(free ? [] : ['price', 'priceUnit']),
    ...(TYPE_FIELDS[type] || []),
    ...CONTACT_FIELDS,
    'latitude',
    'longitude',
  ]
  for (const field of fields) {
    const value = String(values[field] ?? '').trim()
    if (value) data.append(field, value)
  }
  data.append('free', free ? 'true' : 'false')
  for (const photo of photos) data.append('photos', photo.file)
  return data
}
