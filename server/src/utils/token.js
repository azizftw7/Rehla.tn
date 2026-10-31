import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Token JWT contenant l'id et le rôle de l'utilisateur. */
export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}
