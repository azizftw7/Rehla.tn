import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ACCOUNT_SUSPENDED } from '../utils/messages.js';

function readBearerToken(req) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Exige un token valide (en-tête « Authorization: Bearer <token> »)
 * et place l'utilisateur courant dans req.user.
 */
export async function protect(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) {
    throw ApiError.unauthorized('Authentification requise. Connectez-vous.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(
      err instanceof jwt.TokenExpiredError
        ? 'Votre session a expiré. Reconnectez-vous.'
        : 'Session invalide. Reconnectez-vous.',
    );
  }

  // Le rôle et le statut sont relus en base : un changement prend effet immédiatement.
  const user = await User.findById(payload.id);
  if (!user) {
    throw ApiError.unauthorized("Ce compte n'existe plus. Reconnectez-vous.");
  }
  if (user.status === 'suspendu') {
    throw ApiError.forbidden(ACCOUNT_SUSPENDED);
  }

  req.user = user;
  next();
}
