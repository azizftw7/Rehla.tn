import { z } from 'zod';
import { paginationQuery } from '../utils/pagination.js';
import { OBJECT_ID_REGEX } from './services.validators.js';

const serviceId = (requiredMessage) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .regex(OBJECT_ID_REGEX, 'Identifiant de service invalide.');

export const addFavoriteSchema = z.object({
  serviceId: serviceId('Indiquez le service à ajouter aux favoris.'),
});

export const favoriteServiceIdSchema = z.object({
  serviceId: serviceId('Identifiant de service invalide.'),
});

export const listFavoritesSchema = z.object({ ...paginationQuery });
