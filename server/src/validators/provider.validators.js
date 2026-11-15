import { z } from 'zod';
import { ACCOMMODATION_TYPES, SERVICE_TYPES } from '../models/Service.js';
import { isoDate, OBJECT_ID_REGEX } from './services.validators.js';

// Le formulaire est envoyé en multipart/form-data : tous les champs arrivent en texte
// et à plat (latitude, longitude, price, priceUnit, phone…). Un champ vide vaut « absent ».

// Limites approximatives de la Tunisie, avec une petite marge.
export const TUNISIA_BOUNDS = { minLat: 30, maxLat: 38, minLng: 7, maxLng: 12 };

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optional = (schema) => z.preprocess(emptyToUndefined, schema.optional());

const text = (label, max) =>
  z
    .string({ error: `${label} doit être un texte.` })
    .trim()
    .max(max, `${label} ne peut pas dépasser ${max} caractères.`);

const requiredText = (label, max, requiredMessage) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string({ error: requiredMessage })
      .trim()
      .min(1, requiredMessage)
      .max(max, `${label} ne peut pas dépasser ${max} caractères.`),
  );

const httpUrl = (label) =>
  z
    .string({ error: `${label} doit être un texte.` })
    .trim()
    .refine((value) => /^https?:\/\//i.test(value) && z.url().safeParse(value).success, {
      error: `${label} doit être une adresse web valide (https://…).`,
    });

const coordinate = (label, min, max) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: `${label} est obligatoire. Cliquez sur la carte pour placer le service.` })
      .refine(Number.isFinite, { error: `${label} doit être un nombre.` })
      .min(min, 'La position doit se trouver en Tunisie.')
      .max(max, 'La position doit se trouver en Tunisie.'),
  );

// Langues : champ répété (languages=fr&languages=ar) ou liste séparée par des virgules.
const languages = z.preprocess(
  (value) => {
    if (value == null) return undefined;
    const list = (Array.isArray(value) ? value : [value])
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
    return list.length > 0 ? list : undefined;
  },
  z.array(text('Une langue', 40)).max(10, 'Indiquez au plus 10 langues.').optional(),
);

const booleanField = z.preprocess(
  (value) => (value === undefined || value === '' ? 'false' : String(value).toLowerCase()),
  z
    .enum(['true', 'false', 'on'], { error: 'La valeur doit être vrai ou faux.' })
    .transform((value) => value !== 'false'),
);

export const createServiceSchema = z
  .object({
    type: z.enum(SERVICE_TYPES, {
      error: 'Choisissez un type : hébergement, restaurant, activité, événement ou guide.',
    }),
    name: requiredText('Le nom', 120, 'Le nom du service est obligatoire.'),
    description: optional(text('La description', 5000)),
    destination: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'Choisissez une destination.' })
        .trim()
        .regex(OBJECT_ID_REGEX, 'Destination invalide.'),
    ),
    address: optional(text("L'adresse", 250)),
    latitude: coordinate('La latitude', TUNISIA_BOUNDS.minLat, TUNISIA_BOUNDS.maxLat),
    longitude: coordinate('La longitude', TUNISIA_BOUNDS.minLng, TUNISIA_BOUNDS.maxLng),

    free: booleanField,
    price: optional(
      z.coerce
        .number({ error: 'Le prix doit être un nombre.' })
        .refine(Number.isFinite, { error: 'Le prix doit être un nombre.' })
        .min(0, 'Le prix ne peut pas être négatif.')
        .max(1000000, 'Le prix est trop élevé.'),
    ),
    priceUnit: optional(text("L'unité de prix", 30)),

    phone: optional(
      text('Le téléphone', 30).regex(
        /^\+?[0-9 .-]{6,}$/,
        'Le numéro de téléphone ne doit contenir que des chiffres, espaces, points ou tirets.',
      ),
    ),
    website: optional(httpUrl('Le site web')),
    videoUrl: optional(httpUrl('Le lien de la vidéo')),

    // Champs propres au type.
    accommodationType: optional(
      z.enum(ACCOMMODATION_TYPES, { error: "Choisissez un type d'hébergement." }),
    ),
    cuisine: optional(text('Le type de cuisine', 60)),
    activityCategory: optional(text('La catégorie', 60)),
    eventType: optional(text("Le type d'événement", 60)),
    startDate: optional(isoDate('La date de début', false)),
    endDate: optional(isoDate('La date de fin', false)),
    hours: optional(text('Les horaires', 60)),
    languages,
  })
  .superRefine(
    (data, ctx) => {
      const requireField = (field, message) => {
        if (data[field] === undefined) ctx.addIssue({ code: 'custom', path: [field], message });
      };

      if (!data.free) requireField('price', 'Indiquez un prix ou cochez « Gratuit ».');

      switch (data.type) {
        case 'hebergement':
          requireField('accommodationType', "Choisissez un type d'hébergement.");
          break;
        case 'restaurant':
          requireField('cuisine', 'Indiquez le type de cuisine.');
          break;
        case 'activite':
          requireField('activityCategory', "Indiquez la catégorie d'activité.");
          break;
        case 'evenement':
          requireField('startDate', "La date de début de l'événement est obligatoire.");
          if (
            data.startDate instanceof Date &&
            data.endDate instanceof Date &&
            data.endDate < data.startDate
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['endDate'],
              message: 'La date de fin doit être postérieure ou égale à la date de début.',
            });
          }
          break;
        case 'guide':
          requireField('languages', 'Indiquez au moins une langue parlée.');
          break;
        default:
          break;
      }
      // « when » : ces règles s'exécutent même si d'autres champs sont déjà invalides,
      // pour afficher toutes les erreurs du formulaire en une seule fois.
      // (Un champ invalide garde sa valeur : il n'est pas signalé une deuxième fois comme manquant.)
    },
    { when: () => true },
  );

/**
 * Convertit les champs validés (à plat) en document Service.
 * Seuls les champs propres au type choisi sont conservés.
 */
export function toServiceDocument(data) {
  const doc = {
    type: data.type,
    name: data.name,
    description: data.description,
    destination: data.destination,
    address: data.address,
    location: { type: 'Point', coordinates: [data.longitude, data.latitude] },
    free: data.free,
    videoUrl: data.videoUrl,
  };

  if (!data.free) {
    doc.price = { amount: data.price, unit: data.priceUnit };
  }
  if (data.phone || data.website) {
    doc.contact = { phone: data.phone, website: data.website };
  }

  switch (data.type) {
    case 'hebergement':
      doc.accommodationType = data.accommodationType;
      break;
    case 'restaurant':
      doc.cuisine = data.cuisine;
      break;
    case 'activite':
      doc.activityCategory = data.activityCategory;
      break;
    case 'evenement':
      doc.event = {
        eventType: data.eventType,
        startDate: data.startDate,
        endDate: data.endDate,
        hours: data.hours,
      };
      break;
    case 'guide':
      doc.languages = data.languages;
      break;
    default:
      break;
  }

  return doc;
}
