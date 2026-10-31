import { z } from 'zod';
import { SERVICE_TYPES, TRAVELER_PROFILES } from '../models/index.js';

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

export const providerShape = {
  businessName: requiredString('Le nom commercial est obligatoire.')
    .trim()
    .min(2, 'Le nom commercial doit contenir au moins 2 caractères.')
    .max(120, 'Le nom commercial ne peut pas dépasser 120 caractères.'),
  activityType: z.enum(SERVICE_TYPES, {
    error: (issue) =>
      issue.input === undefined
        ? "Le type d'activité est obligatoire."
        : `Type d'activité invalide : choisissez ${SERVICE_TYPES.join(', ')}.`,
  }),
  city: requiredString('La ville est obligatoire.')
    .trim()
    .min(2, 'La ville doit contenir au moins 2 caractères.')
    .max(80, 'La ville ne peut pas dépasser 80 caractères.'),
  phone: requiredString('Le numéro de téléphone est obligatoire.')
    .trim()
    .regex(/^\+?[0-9][0-9 .-]{6,18}[0-9]$/, "Le numéro de téléphone n'est pas valide."),
};

export const PROVIDER_NOT_OBJECT = "Les informations sur l'activité doivent être un objet.";

export const providerField = z
  .object(providerShape, { error: PROVIDER_NOT_OBJECT })
  // Si l'objet manque, on valide un objet vide pour lister chaque champ obligatoire.
  .prefault({});

const accountFields = { name: nameField, email: emailField, password: passwordField };

const travelerRegisterSchema = z.object({
  ...accountFields,
  role: z.literal('voyageur'),
  profile: profileField,
});

const providerRegisterSchema = z.object({
  ...accountFields,
  role: z.literal('prestataire'),
  provider: providerField,
});

// Pas de règle de longueur à la connexion : on vérifie seulement que les champs sont remplis.
export const loginSchema = z.object({
  email: emailField,
  password: requiredString('Le mot de passe est obligatoire.').min(
    1,
    'Le mot de passe est obligatoire.',
  ),
});

// Les champs non prévus (status, profile d'un prestataire…) sont ignorés,
// et on ne peut pas s'inscrire comme admin. Sans rôle, l'inscription est celle d'un voyageur.
export const registerSchema = z.preprocess(
  (body) =>
    body && typeof body === 'object' && body.role === undefined
      ? { ...body, role: 'voyageur' }
      : body,
  z.discriminatedUnion('role', [travelerRegisterSchema, providerRegisterSchema], {
    error: 'Rôle invalide : choisissez voyageur ou prestataire.',
  }),
);
