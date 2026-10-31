import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { EMAIL_TAKEN } from '../utils/messages.js';

/** GET /api/users/me */
export function getMe(req, res) {
  res.json({ user: req.user });
}

/** PUT /api/users/me — nom, e-mail, photo, profil (voyageur) ou activité (prestataire). */
export async function updateMe(req, res) {
  const user = req.user;
  const { name, email, avatarUrl, profile, provider } = req.validated.body;

  if (profile !== undefined && user.role !== 'voyageur') {
    throw ApiError.badRequest('Données invalides.', [
      { field: 'profile', message: 'Le profil ne concerne que les comptes voyageur.' },
    ]);
  }
  if (provider !== undefined && user.role !== 'prestataire') {
    throw ApiError.badRequest('Données invalides.', [
      { field: 'provider', message: "L'activité ne concerne que les comptes prestataire." },
    ]);
  }

  if (email !== undefined && email !== user.email) {
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      throw ApiError.conflict(EMAIL_TAKEN, [{ field: 'email', message: EMAIL_TAKEN }]);
    }
    user.email = email;
  }
  if (name !== undefined) user.name = name;
  if (profile !== undefined) user.profile = profile;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || undefined;
  if (provider !== undefined) {
    user.provider = { ...user.provider?.toObject(), ...provider };
  }

  await user.save();
  res.json({ user });
}

/** PUT /api/users/me/password — exige le mot de passe actuel. */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.validated.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Le mot de passe actuel est incorrect.', [
      { field: 'currentPassword', message: 'Le mot de passe actuel est incorrect.' },
    ]);
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Votre mot de passe a été modifié.' });
}
