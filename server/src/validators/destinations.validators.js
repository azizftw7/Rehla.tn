import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';

export const listDestinationsSchema = z.object({
  search: z
    .string({ error: 'La recherche doit être un texte.' })
    .trim()
    .max(100, 'La recherche ne peut pas dépasser 100 caractères.')
    .optional(),
  ...paginationQuery,
});

// Un slug inconnu donne simplement 404.
export const destinationSlugSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
