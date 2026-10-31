import { z } from 'zod';
import { TRAVELER_PROFILES } from '../models/index.js';

const requiredString = (requiredMessage) =>
  z.string({
    error: (issue) =>
      issue.input === undefined ? requiredMessage : 'Ce champ doit être un texte.',
  });

export const nameField = requiredString('Le nom est obligatoire.')
  .trim()
  .min(2, 'Le nom doit contenir au moins 2 caractères.')
  .max(100, 'Le nom ne peut pas dépasser 100 caractères.');

export const emailField = requiredString("L'adresse e-mail est obligatoire.")
  .trim()
  .toLowerCase()
  .pipe(z.email("L'adresse e-mail n'est pas valide."));

export const passwordField = requiredString('Le mot de passe est obligatoire.')
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.');

export const profileField = z.enum(TRAVELER_PROFILES, {
  error: (issue) =>
    issue.input === undefined
      ? 'Le profil est obligatoire (etudiant, resident ou touriste).'
      : 'Profil invalide : choisissez etudiant, resident ou touriste.',
});

// Les champs non prévus (status, provider…) sont ignorés : on ne peut pas s'inscrire comme admin.
export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  role: z
    .literal('voyageur', { error: 'Rôle invalide : seule l’inscription voyageur est possible.' })
    .default('voyageur'),
  profile: profileField,
});
