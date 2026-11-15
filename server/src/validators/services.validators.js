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

const listServicesObject = z.object({
  type: z.enum(SERVICE_TYPES, { error: 'Type de service invalide.' }).optional(),
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
  maxPrice: z.coerce
    .number({ error: 'Le prix maximum doit être un nombre.' })
    .min(0, 'Le prix maximum ne peut pas être négatif.')
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
