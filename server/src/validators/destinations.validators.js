import { z } from 'zod';
import { SERVICE_TYPES } from '../models/Service.js';
import { paginationQuery } from '../utils/pagination.js';
import { csvEnum } from './services.validators.js';

/** Types acceptés par la recherche de l'accueil : types de service + « transport ». */
export const DESTINATION_FILTER_TYPES = [...SERVICE_TYPES, 'transport'];

export const listDestinationsSchema = z.object({
  search: z
    .string({ error: 'La recherche doit être un texte.' })
    .trim()
    .max(100, 'La recherche ne peut pas dépasser 100 caractères.')
    .optional(),
  // Recherche de l'accueil : « types=hebergement,guide » ne garde que les destinations
  // qui proposent au moins un de ces types (US2.3).
  types: csvEnum(DESTINATION_FILTER_TYPES, {
    label: 'Les types',
    error: `Type invalide (valeurs possibles : ${DESTINATION_FILTER_TYPES.join(', ')}).`,
  }).optional(),
  ...paginationQuery,
});

// Un slug inconnu donne simplement 404.
export const destinationSlugSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
