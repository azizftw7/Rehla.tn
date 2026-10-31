import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProduction, isTest } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { formatZodIssues } from './validate.js';

const UNAVAILABLE_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
]);

// Messages des doublons (code 11000), selon les champs de l'index unique concerné.
const DUPLICATE_MESSAGES = {
  email: 'Cette adresse e-mail est déjà utilisée.',
  slug: 'Une destination porte déjà ce nom.',
  'service,user': 'Ce service est déjà dans vos favoris.',
  'author,service': 'Vous avez déjà laissé un avis sur ce service.',
};

function isServiceUnavailable(err) {
  return (
    UNAVAILABLE_ERRORS.has(err.name) ||
    (err.name === 'MongooseError' && /buffering timed out/i.test(err.message))
  );
}

/** Convertit n'importe quelle erreur en ApiError. */
function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.badRequest('Données invalides.', formatZodIssues(err));
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e instanceof mongoose.Error.CastError ? 'Valeur invalide.' : e.message,
    }));
    return ApiError.badRequest('Données invalides.', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest('Identifiant ou valeur invalide.', [
      { field: err.path, message: 'Valeur invalide.' },
    ]);
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {}).sort();
    const message = DUPLICATE_MESSAGES[fields.join(',')] ?? 'Cette ressource existe déjà.';
    return ApiError.conflict(
      message,
      fields.map((field) => ({ field, message })),
    );
  }

  // Erreurs du parseur JSON d'Express (body-parser).
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest("Le corps de la requête n'est pas un JSON valide.");
  }
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'La requête est trop volumineuse.');
  }

  if (isServiceUnavailable(err)) {
    return new ApiError(
      503,
      'Le service est momentanément indisponible. Réessayez dans quelques instants.',
    );
  }

  return new ApiError(500, 'Une erreur interne est survenue. Réessayez plus tard.');
}

// Express reconnaît un middleware d'erreur à ses 4 paramètres : `_next` doit rester déclaré.
export function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);

  if (apiError.status >= 500 && !isTest()) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  const body = { message: apiError.message, details: apiError.details ?? [] };
  if (apiError.status >= 500 && !isProduction()) {
    body.stack = err.stack;
  }

  res.status(apiError.status).json(body);
}
