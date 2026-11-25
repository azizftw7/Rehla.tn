import { z } from 'zod';
import { TRAVELER_PROFILES } from '../models/index.js';
import { paginationQuery } from '../utils/pagination.js';
import { OBJECT_ID_REGEX } from './services.validators.js';

export const MAX_MESSAGE_LENGTH = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Date du jour « AAAA-MM-JJ » convertie en Date à minuit UTC. */
const dayDate = (requiredMessage, label) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string({ error: requiredMessage })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} doit être au format AAAA-MM-JJ.`)
      .refine((value) => z.iso.date().safeParse(value).success, {
        error: `${label} n'est pas une date valide.`,
      })
      .transform((value) => new Date(`${value}T00:00:00.000Z`)),
  );

/** Minuit UTC du jour courant. */
export function startOfTodayUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const optionalBoolean = z.boolean({ error: 'La valeur doit être vrai ou faux.' }).optional();

/** Formulaire du partage (création et modification complète). */
export const tripShareSchema = z
  .object({
    destination: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'Choisissez une destination.' })
        .trim()
        .regex(OBJECT_ID_REGEX, 'Destination invalide.'),
    ),
    startDate: dayDate("La date d'aller est obligatoire.", "La date d'aller"),
    endDate: dayDate('La date de retour est obligatoire.', 'La date de retour'),
    message: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'Le message doit être un texte.' })
        .trim()
        .max(
          MAX_MESSAGE_LENGTH,
          `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`,
        )
        .optional(),
    ),
    city: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: 'La ville doit être un texte.' })
        .trim()
        .max(80, 'La ville ne peut pas dépasser 80 caractères.')
        .optional(),
    ),
    languages: z
      .array(
        z
          .string({ error: 'Une langue doit être un texte.' })
          .trim()
          .min(1, 'Une langue ne peut pas être vide.')
          .max(40, 'Une langue ne peut pas dépasser 40 caractères.'),
        { error: 'Les langues doivent être une liste.' },
      )
      .max(10, 'Indiquez au plus 10 langues.')
      .optional(),
    visible: z
      .object(
        {
          profile: optionalBoolean,
          city: optionalBoolean,
          languages: optionalBoolean,
          photo: optionalBoolean,
        },
        { error: 'Choix de visibilité invalide.' },
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (data.startDate instanceof Date && data.endDate instanceof Date) {
      if (data.endDate <= data.startDate) {
        issue('endDate', "La date de retour doit être postérieure à la date d'aller.");
      }
    }
    if (data.endDate instanceof Date && data.endDate < startOfTodayUtc()) {
      issue('endDate', 'La date de retour est déjà passée.');
    }
    if (data.startDate instanceof Date && data.startDate - startOfTodayUtc() > 2 * 365 * DAY_MS) {
      issue('startDate', "La date d'aller doit être dans les deux prochaines années.");
    }
    if (data.visible?.city && !data.city) {
      issue('city', 'Indiquez votre ville de départ, ou décochez « Ville de départ ».');
    }
    if (data.visible?.languages && !data.languages?.length) {
      issue('languages', 'Choisissez au moins une langue, ou décochez « Langues parlées ».');
    }
  });

export const tripShareIdSchema = z.object({
  id: z.string().trim().regex(OBJECT_ID_REGEX, 'Identifiant de partage invalide.'),
});

export const myTripSharesQuerySchema = z.object({ ...paginationQuery });

// GET /api/trip-shares/:id/co-voyageurs : filtres facultatifs (un filtre vide est ignoré).
export const coTravelersQuerySchema = z.object({
  profile: z.preprocess(
    emptyToUndefined,
    z
      .enum(TRAVELER_PROFILES, {
        error: 'Profil invalide : choisissez etudiant, resident ou touriste.',
      })
      .optional(),
  ),
  language: z.preprocess(
    emptyToUndefined,
    z
      .string({ error: 'La langue doit être un texte.' })
      .trim()
      .max(40, 'La langue ne peut pas dépasser 40 caractères.')
      .optional(),
  ),
  minDays: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: 'Le nombre de jours doit être un nombre.' })
      .int('Le nombre de jours doit être un nombre entier.')
      .min(1, 'Le nombre de jours doit être au moins 1.')
      .max(365, 'Le nombre de jours ne peut pas dépasser 365.')
      .optional(),
  ),
  ...paginationQuery,
});
