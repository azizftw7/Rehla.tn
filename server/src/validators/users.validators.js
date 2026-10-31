import { z } from 'zod';
import {
  emailField,
  nameField,
  passwordField,
  profileField,
  PROVIDER_NOT_OBJECT,
  providerShape,
} from './auth.validators.js';

const AVATAR_URL_INVALID = "L'URL de la photo doit commencer par http:// ou https://.";

// Chaîne vide = supprimer la photo.
const avatarUrlField = z.union(
  [z.url({ protocol: /^https?$/, error: AVATAR_URL_INVALID }), z.literal('')],
  { error: AVATAR_URL_INVALID },
);

// Tous les champs sont facultatifs ; rôle, statut et mot de passe ne se modifient pas ici.
export const updateMeSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    avatarUrl: avatarUrlField.optional(),
    profile: profileField.optional(),
    provider: z.object(providerShape, { error: PROVIDER_NOT_OBJECT }).partial().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: 'Aucune modification à enregistrer.',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: 'Le mot de passe actuel est obligatoire.' })
      .min(1, 'Le mot de passe actuel est obligatoire.'),
    newPassword: passwordField,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    error: "Le nouveau mot de passe doit être différent de l'ancien.",
    path: ['newPassword'],
  });
