import { Favorite, Offer, Review, Service, TripShare, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';
import { deleteImages } from '../utils/upload.js';

const USER_NOT_FOUND = 'Utilisateur introuvable.';

// Un prestataire inscrit avant l'US7.1 n'a pas encore de champ approval : il est « en attente ».
const approvalQuery = (approval) =>
  approval === 'en_attente' ? { $in: [approval, null] } : approval;

async function findUser(req) {
  const user = await User.findById(req.validated.params.id);
  if (!user) throw ApiError.notFound(USER_NOT_FOUND);
  return user;
}

/**
 * Un administrateur ne peut agir ni sur son propre compte, ni sur celui d'un autre administrateur.
 * action : verbe à l'infinitif (« suspendre », « supprimer »…), pour un message clair.
 */
function assertManageable(req, target, action) {
  if (target._id.equals(req.user._id)) {
    throw ApiError.badRequest(`Vous ne pouvez pas ${action} votre propre compte.`);
  }
  if (target.role === 'admin') {
    throw ApiError.badRequest(`Vous ne pouvez pas ${action} le compte d'un autre administrateur.`);
  }
}

/** GET /api/admin/stats : comptes par rôle, comptes suspendus, demandes prestataire en attente. */
export async function getStats(_req, res) {
  const [byRole, suspended, pendingProviders] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ status: 'suspendu' }),
    User.countDocuments({ role: 'prestataire', 'provider.approval': approvalQuery('en_attente') }),
  ]);

  const users = { voyageur: 0, prestataire: 0, admin: 0 };
  for (const { _id, count } of byRole) users[_id] = count;

  res.json({
    users: { ...users, total: users.voyageur + users.prestataire + users.admin },
    suspended,
    pendingProviders,
  });
}

/** GET /api/admin/users : liste filtrée et paginée, plus récents d'abord. */
export async function listUsers(req, res) {
  const { role, status, approval, search, page, limit } = req.validated.query;

  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  // La validation ne concerne que les prestataires (combinée à un autre rôle : aucun résultat).
  if (approval) {
    filter.role = role ?? 'prestataire';
    filter['provider.approval'] =
      filter.role === 'prestataire' ? approvalQuery(approval) : approval;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { 'provider.businessName': pattern }];
  }

  res.json(await paginate(User, filter, { page, limit, sort: { createdAt: -1, _id: -1 } }));
}

/** GET /api/admin/users/:id */
export async function getUser(req, res) {
  res.json({ user: await findUser(req) });
}

/** PATCH /api/admin/users/:id/statut : suspend ou réactive un compte. */
export async function setUserStatus(req, res) {
  const { status } = req.validated.body;
  const user = await findUser(req);
  assertManageable(req, user, status === 'suspendu' ? 'suspendre' : 'réactiver');

  user.status = status;
  await user.save();
  res.json({ user });
}

/** PATCH /api/admin/users/:id/validation : approuve ou refuse une demande prestataire. */
export async function reviewProvider(req, res) {
  const { decision, reason } = req.validated.body;
  const user = await findUser(req);
  assertManageable(req, user, 'valider');
  if (user.role !== 'prestataire') {
    throw ApiError.badRequest("Ce compte n'est pas un compte prestataire.");
  }

  user.provider.approval = decision;
  user.provider.reviewedAt = new Date();
  user.provider.rejectionReason = decision === 'refuse' ? reason : undefined;
  await user.save();
  res.json({ user });
}

/**
 * DELETE /api/admin/users/:id : supprime le compte et tout ce qui s'y rattache
 * (services avec leurs photos, offres, avis et favoris ; avis, favoris et partages de l'utilisateur).
 */
export async function deleteUser(req, res) {
  const user = await findUser(req);
  assertManageable(req, user, 'supprimer');

  const services = await Service.find({ provider: user._id }).select('photos');
  const serviceIds = services.map((service) => service._id);
  // Services dont la note moyenne change quand les avis de l'utilisateur disparaissent.
  const reviewedServices = await Review.distinct('service', {
    author: user._id,
    service: { $nin: serviceIds },
  });

  await Promise.all([
    Service.deleteMany({ _id: { $in: serviceIds } }),
    Offer.deleteMany({ service: { $in: serviceIds } }),
    Review.deleteMany({ $or: [{ service: { $in: serviceIds } }, { author: user._id }] }),
    Favorite.deleteMany({ $or: [{ service: { $in: serviceIds } }, { user: user._id }] }),
    TripShare.deleteMany({ user: user._id }),
  ]);
  await Promise.all(reviewedServices.map((id) => Review.updateServiceRating(id)));
  await user.deleteOne();
  await deleteImages(services.flatMap((service) => service.photos));

  res.status(204).end();
}
