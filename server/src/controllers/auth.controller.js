import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ACCOUNT_SUSPENDED, EMAIL_TAKEN, INVALID_CREDENTIALS } from '../utils/messages.js';
import { signToken } from '../utils/token.js';

// Comparé quand l'e-mail est inconnu, pour que la réponse prenne le même temps
// et ne révèle pas si un compte existe.
const DUMMY_HASH = bcrypt.hashSync('rehla-dummy-password', 10);

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

/** POST /api/auth/login */
export async function login(req, res) {
  const { email, password } = req.validated.body;

  const user = await User.findOne({ email }).select('+password');
  const passwordOk = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  // Indiqué seulement après un mot de passe correct, pour ne rien révéler à un tiers.
  if (user.status === 'suspendu') {
    throw ApiError.forbidden(ACCOUNT_SUSPENDED);
  }

  res.json({ token: signToken(user), user });
}
