import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { signToken } from '../utils/token.js';

const EMAIL_TAKEN = 'Cette adresse e-mail est déjà utilisée.';

/** POST /api/auth/register — renvoie un token pour connecter l'utilisateur directement. */
export async function register(req, res) {
  const data = req.validated.body;

  // Vérification explicite pour un message clair ; l'index unique couvre les inscriptions simultanées.
  if (await User.exists({ email: data.email })) {
    throw ApiError.conflict(EMAIL_TAKEN, [{ field: 'email', message: EMAIL_TAKEN }]);
  }

  const user = await User.create(data);
  res.status(201).json({ token: signToken(user), user });
}
