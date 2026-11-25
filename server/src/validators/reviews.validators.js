import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { OBJECT_ID_REGEX } from './services.validators.js';

export const MAX_COMMENT_LENGTH = 1000;

const rating = z
  .number({ error: 'La note doit être un nombre entre 1 et 5.' })
  .int('La note doit être un nombre entier.')
  .min(1, 'La note doit être comprise entre 1 et 5.')
  .max(5, 'La note doit être comprise entre 1 et 5.');

// Un commentaire vide est accepté : il efface le commentaire (l'avis garde sa note).
const comment = z
  .string({ error: 'Le commentaire doit être un texte.' })
  .trim()
  .max(MAX_COMMENT_LENGTH, `Le commentaire ne peut pas dépasser ${MAX_COMMENT_LENGTH} caractères.`);

export const createReviewSchema = z.object({
  rating: z
    .number({ error: 'Choisissez une note de 1 à 5 étoiles.' })
    .int('La note doit être un nombre entier.')
    .min(1, 'La note doit être comprise entre 1 et 5.')
    .max(5, 'La note doit être comprise entre 1 et 5.'),
  comment: comment.optional(),
});

export const updateReviewSchema = z
  .object({ rating: rating.optional(), comment: comment.optional() })
  .refine((body) => body.rating !== undefined || body.comment !== undefined, {
    error: 'Indiquez la note ou le commentaire à modifier.',
  });

export const reviewIdSchema = z.object({
  id: z.string().trim().regex(OBJECT_ID_REGEX, "Identifiant d'avis invalide."),
});

export const listReviewsSchema = z.object({ ...paginationQuery });

// ---------- US6.4 : réponse du prestataire ----------

export const MAX_REPLY_LENGTH = 1000;

export const replySchema = z.object({
  text: z
    .string({ error: 'Écrivez votre réponse.' })
    .trim()
    .min(1, 'Écrivez votre réponse.')
    .max(MAX_REPLY_LENGTH, `La réponse ne peut pas dépasser ${MAX_REPLY_LENGTH} caractères.`),
});

const emptyToUndefined = (value) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// GET /api/provider/reviews : avis reçus, filtrables par service et « sans réponse ».
export const providerReviewsQuerySchema = z.object({
  service: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(OBJECT_ID_REGEX, 'Identifiant de service invalide.').optional(),
  ),
  unanswered: z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false'], { error: 'Le filtre « sans réponse » doit être vrai ou faux.' })
      .transform((value) => value === 'true')
      .optional(),
  ),
  ...paginationQuery,
});
