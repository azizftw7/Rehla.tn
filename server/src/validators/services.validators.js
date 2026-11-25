import { z } from 'zod';
import { ACCOMMODATION_TYPES, SERVICE_TYPES } from '../models/Service.js';
import { paginationQuery } from '../utils/pagination.js';

export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date ISO (« 2026-12-01 » ou « 2026-12-01T18:00:00Z ») convertie en Date.
 * Une date seule vaut le début du jour (from) ou la fin du jour (to), en UTC.
 */
export const isoDate = (label, endOfDay) =>
  z
    .string({ error: `${label} doit être un texte.` })
    .trim()
    .refine(
      (value) => z.iso.date().safeParse(value).success || z.iso.datetime().safeParse(value).success,
      {
        error: `${label} doit être une date au format AAAA-MM-JJ.`,
      },
    )
    .transform((value) => {
      if (DATE_ONLY_REGEX.test(value)) {
        return new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
      }
      return new Date(value);
    });

/**
 * Liste de valeurs séparées par des virgules (« hebergement,restaurant ») ou paramètre répété
 * (?types=a&types=b), convertie en tableau sans doublons ni valeurs vides.
 * Chaque valeur doit appartenir à `allowed` (message d'erreur `error`, sur le champ lui-même).
 */
export const csvEnum = (allowed, { label, error }) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.join(',') : value),
    z
      .string({ error: `${label} doivent être un texte.` })
      .max(200, `${label} ne peuvent pas dépasser 200 caractères.`)
      .transform((value) => [
        ...new Set(
          value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ])
      .refine((items) => items.every((item) => allowed.includes(item)), { error }),
  );

const listServicesObject = z.object({
  type: z.enum(SERVICE_TYPES, { error: 'Type de service invalide.' }).optional(),
  // Plusieurs types à la fois (US2.3) : « types=hebergement,restaurant ».
  types: csvEnum(SERVICE_TYPES, {
    label: 'Les types',
    error: `Type de service invalide (valeurs possibles : ${SERVICE_TYPES.join(', ')}).`,
  }).optional(),
  destination: z
    .string({ error: 'La destination doit être un texte.' })
    .trim()
    .max(100, 'La destination ne peut pas dépasser 100 caractères.')
    .optional(),
  search: z
    .string({ error: 'La recherche doit être un texte.' })
    .trim()
    .max(100, 'La recherche ne peut pas dépasser 100 caractères.')
    .optional(),
  cuisine: z
    .string({ error: 'Le type de cuisine doit être un texte.' })
    .trim()
    .max(60, 'Le type de cuisine ne peut pas dépasser 60 caractères.')
    .optional(),
  activityCategory: z
    .string({ error: 'La catégorie doit être un texte.' })
    .trim()
    .max(60, 'La catégorie ne peut pas dépasser 60 caractères.')
    .optional(),
  accommodationType: z
    .enum(ACCOMMODATION_TYPES, {
      error: "Type d'hébergement invalide (hotel, maison-hotes, dar, appartement ou camping).",
    })
    .optional(),
  free: z
    .enum(['true', 'false'], { error: 'Le filtre gratuit doit être vrai ou faux.' })
    .transform((val) => val === 'true')
    .optional(),
  eventType: z
    .string({ error: "Le type d'événement doit être un texte." })
    .trim()
    .max(60, "Le type d'événement ne peut pas dépasser 60 caractères.")
    .optional(),
  from: isoDate('La date de début', false).optional(),
  to: isoDate('La date de fin', true).optional(),
  // US4.2 : langue parlée par un guide (insensible à la casse et aux accents).
  language: z
    .string({ error: 'La langue doit être un texte.' })
    .trim()
    .min(1, 'La langue ne peut pas être vide.')
    .max(40, 'La langue ne peut pas dépasser 40 caractères.')
    .optional(),
  maxPrice: z.coerce
    .number({ error: 'Le prix maximum doit être un nombre.' })
    .min(0, 'Le prix maximum ne peut pas être négatif.')
    .optional(),
  minRating: z.coerce
    .number({ error: 'La note minimale doit être un nombre.' })
    .min(1, 'La note minimale doit être comprise entre 1 et 5.')
    .max(5, 'La note minimale doit être comprise entre 1 et 5.')
    .optional(),
  ...paginationQuery,
});

export const listServicesSchema = listServicesObject.refine(
  (query) => !query.from || !query.to || query.from <= query.to,
  { path: ['to'], error: 'La date de fin doit être postérieure ou égale à la date de début.' },
);

export const serviceIdSchema = z.object({
  id: z.string().trim().regex(OBJECT_ID_REGEX, 'Identifiant de service invalide.'),
});
