import { z } from 'zod';
import { TRANSPORT_TYPES } from '../models/Transport.js';
import { paginationQuery } from '../utils/pagination.js';

export const listTransportsSchema = z.object({
  destination: z
    .string({ error: 'La destination doit être un texte.' })
    .trim()
    .min(1, 'La destination ne peut pas être vide.')
    .max(100, 'La destination ne peut pas dépasser 100 caractères.')
    .optional(),
  type: z
    .enum(TRANSPORT_TYPES, {
      error: 'Type de transport invalide (bus, louage, train, ferry ou avion).',
    })
    .optional(),
  from: z
    .string({ error: 'La ville de départ doit être un texte.' })
    .trim()
    .max(60, 'La ville de départ ne peut pas dépasser 60 caractères.')
    .optional(),
  ...paginationQuery,
});
