import { z } from 'zod';
import { SERVICE_TYPES } from '../models/Service.js';
import { paginationQuery } from '../utils/pagination.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const listServicesSchema = z.object({
  type: z
    .enum(SERVICE_TYPES, { error: 'Type de service invalide.' })
    .optional(),
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
  free: z
    .enum(['true', 'false'], { error: 'Le filtre gratuit doit être vrai ou faux.' })
    .transform((val) => val === 'true')
    .optional(),
  maxPrice: z.coerce
    .number({ error: 'Le prix maximum doit être un nombre.' })
    .min(0, 'Le prix maximum ne peut pas être négatif.')
    .optional(),
  ...paginationQuery,
});

export const serviceIdSchema = z.object({
  id: z.string().trim().regex(OBJECT_ID_REGEX, 'Identifiant de service invalide.'),
});