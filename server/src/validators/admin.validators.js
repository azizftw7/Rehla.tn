import { z } from 'zod';
import { PROVIDER_APPROVALS, ROLES, SERVICE_TYPES, USER_STATUSES } from '../models/index.js';
import { paginationQuery } from '../utils/pagination.js';
import { OBJECT_ID_REGEX } from './services.validators.js';

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalEnum = (values, message) =>
  z.preprocess(emptyToUndefined, z.enum(values, { error: message }).optional());

export const userIdSchema = z.object({
  id: z.string().trim().regex(OBJECT_ID_REGEX, "Identifiant d'utilisateur invalide."),
});

// GET /api/admin/users : tous les filtres sont facultatifs (un filtre vide est ignoré).
export const listUsersQuerySchema = z.object({
  role: optionalEnum(ROLES, 'Rôle invalide : choisissez voyageur, prestataire ou admin.'),
  status: optionalEnum(USER_STATUSES, 'Statut invalide : choisissez actif ou suspendu.'),
  approval: optionalEnum(
    PROVIDER_APPROVALS,
    'Validation invalide : choisissez en_attente, approuve ou refuse.',
  ),
  search: z.preprocess(
    emptyToUndefined,
    z
      .string({ error: 'La recherche doit être un texte.' })
      .trim()
      .max(100, 'La recherche ne peut pas dépasser 100 caractères.')
      .optional(),
  ),
  ...paginationQuery,
});

export const statusSchema = z.object({
  status: z.enum(USER_STATUSES, {
    error: (issue) =>
      issue.input === undefined
        ? 'Le statut est obligatoire (actif ou suspendu).'
        : 'Statut invalide : choisissez actif ou suspendu.',
  }),
});

export const validationSchema = z.object({
  decision: z.enum(['approuve', 'refuse'], {
    error: (issue) =>
      issue.input === undefined
        ? 'La décision est obligatoire (approuve ou refuse).'
        : 'Décision invalide : choisissez approuve ou refuse.',
  }),
  // Motif facultatif, conservé seulement en cas de refus.
  reason: z.preprocess(
    emptyToUndefined,
    z
      .string({ error: 'Le motif doit être un texte.' })
      .trim()
      .max(300, 'Le motif ne peut pas dépasser 300 caractères.')
      .optional(),
  ),
});

// ---------- US7.2 : modération des contenus ----------

const objectId = (message) => z.object({ id: z.string().trim().regex(OBJECT_ID_REGEX, message) });

export const reviewIdSchema = objectId("Identifiant d'avis invalide.");
export const serviceIdSchema = objectId('Identifiant de service invalide.');
export const tripShareIdSchema = objectId('Identifiant de partage invalide.');

const search = z.preprocess(
  emptyToUndefined,
  z
    .string({ error: 'La recherche doit être un texte.' })
    .trim()
    .max(100, 'La recherche ne peut pas dépasser 100 caractères.')
    .optional(),
);

// GET /api/admin/reviews et /api/admin/trip-shares : recherche facultative.
export const moderationQuerySchema = z.object({ search, ...paginationQuery });

// GET /api/admin/services : recherche, type et visibilité facultatifs.
export const adminServicesQuerySchema = z.object({
  search,
  type: optionalEnum(SERVICE_TYPES, 'Type de service invalide.'),
  hidden: z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false'], { error: 'Le filtre « masqué » doit être vrai ou faux.' })
      .transform((value) => value === 'true')
      .optional(),
  ),
  ...paginationQuery,
});
