import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

/** Limite les tentatives sur /api/auth (inscription, connexion) : 20 requêtes par 15 minutes et par IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest(),
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      message: 'Trop de tentatives. Réessayez dans quelques minutes.',
      details: [],
    });
  },
});
