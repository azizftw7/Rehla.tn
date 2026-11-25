import {
  Destination,
  Favorite,
  NOT_PUBLIC_FILTER,
  Offer,
  Review,
  Service,
  TripShare,
  User,
} from '../models/index.js';
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

/**
 * GET /api/admin/stats : comptes par rôle, comptes suspendus, demandes prestataire en attente,
 * et (US7.2) nombre d'avis, de partages de voyage actifs et de services (dont masqués).
 */
export async function getStats(_req, res) {
  const [
    byRole,
    suspended,
    pendingProviders,
    reviews,
    tripShares,
    services,
    hiddenServices,
    hiddenByAdmin,
  ] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ status: 'suspendu' }),
    User.countDocuments({
      role: 'prestataire',
      'provider.approval': approvalQuery('en_attente'),
    }),
    Review.countDocuments(),
    TripShare.countDocuments({ expiresAt: { $gt: new Date() } }),
    Service.countDocuments(),
    Service.countDocuments(NOT_PUBLIC_FILTER),
    Service.countDocuments({ hiddenByAdmin: true }),
  ]);

  const users = { voyageur: 0, prestataire: 0, admin: 0 };
  for (const { _id, count } of byRole) users[_id] = count;

  res.json({
    users: { ...users, total: users.voyageur + users.prestataire + users.admin },
    suspended,
    pendingProviders,
    reviews,
    tripShares,
    // hidden : services non publics (masqués par le prestataire ou par l'administrateur).
    services: { total: services, hidden: hiddenServices, hiddenByAdmin },
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

// ---------- US7.2 : modération des contenus ----------

const searchPattern = (search) => new RegExp(escapeRegex(search), 'i');

/** Identifiants des utilisateurs dont le nom, l'e-mail ou le nom commercial correspond. */
const matchingUserIds = (pattern) =>
  User.distinct('_id', {
    $or: [{ name: pattern }, { email: pattern }, { 'provider.businessName': pattern }],
  });

/**
 * GET /api/admin/reviews?search=&page=&limit= : tous les avis, plus récents d'abord.
 * La recherche porte sur le commentaire, l'auteur (nom, e-mail) et le nom du service.
 */
export async function listReviews(req, res) {
  const { search, page, limit } = req.validated.query;
  const filter = {};
  if (search) {
    const pattern = searchPattern(search);
    const [authors, services] = await Promise.all([
      matchingUserIds(pattern),
      Service.distinct('_id', { name: pattern }),
    ]);
    filter.$or = [
      { comment: pattern },
      { author: { $in: authors } },
      { service: { $in: services } },
    ];
  }
  const result = await paginate(Review, filter, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
    populate: [
      { path: 'author', select: 'name email' },
      { path: 'service', select: 'name type hidden hiddenByAdmin' },
    ],
  });
  res.json(result);
}

/** DELETE /api/admin/reviews/:id → 204. La note du service est recalculée. */
export async function deleteReview(req, res) {
  const review = await Review.findById(req.validated.params.id);
  if (!review) throw ApiError.notFound('Avis introuvable.');
  // deleteOne() sur le document : le hook de Review.js recalcule ratingAverage et ratingCount.
  await review.deleteOne();
  res.status(204).end();
}

async function findService(req) {
  const service = await Service.findById(req.validated.params.id);
  if (!service) throw ApiError.notFound('Service introuvable.');
  return service;
}

/**
 * GET /api/admin/services?search=&type=&hidden=&page=&limit= : tous les services (masqués compris),
 * plus récents d'abord. La recherche porte sur le nom du service et sur le prestataire.
 * hidden=true : services non publics (masqués par le prestataire ou par l'administrateur) ;
 * hidden=false : services publics.
 */
export async function listAdminServices(req, res) {
  const { search, type, hidden, page, limit } = req.validated.query;
  const filter = {};
  const conditions = [];
  if (type) filter.type = type;
  if (hidden === true) conditions.push(NOT_PUBLIC_FILTER);
  if (hidden === false) Object.assign(filter, { hidden: false, hiddenByAdmin: { $ne: true } });
  if (search) {
    const pattern = searchPattern(search);
    conditions.push({
      $or: [{ name: pattern }, { provider: { $in: await matchingUserIds(pattern) } }],
    });
  }
  if (conditions.length > 0) filter.$and = conditions;
  const result = await paginate(Service, filter, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
    select:
      'type name destination provider hidden hiddenByAdmin ratingAverage ratingCount createdAt',
    populate: [
      { path: 'destination', select: 'name slug' },
      { path: 'provider', select: 'name email provider.businessName' },
    ],
  });
  res.json(result);
}

/**
 * PATCH /api/admin/services/:id/visibilite { hidden } : masque ou réaffiche un service par la
 * modération (hiddenByAdmin). Le choix du prestataire (hidden) n'est pas modifié : un service
 * qu'il avait lui-même masqué reste masqué après la levée de la modération.
 */
export async function setAdminServiceVisibility(req, res) {
  const service = await findService(req);
  service.hiddenByAdmin = req.validated.body.hidden;
  await service.save();
  await service.populate([
    { path: 'destination', select: 'name slug' },
    { path: 'provider', select: 'name email provider.businessName' },
  ]);
  res.json({ service });
}

/** DELETE /api/admin/services/:id : supprime le service, ses photos, offres, avis et favoris. */
export async function deleteAdminService(req, res) {
  const service = await findService(req);
  await service.deleteOne();
  await Promise.all([
    Offer.deleteMany({ service: service._id }),
    Review.deleteMany({ service: service._id }),
    Favorite.deleteMany({ service: service._id }),
  ]);
  await deleteImages(service.photos);
  res.status(204).end();
}

/**
 * GET /api/admin/trip-shares?search=&page=&limit= : partages de voyage, du plus proche au plus
 * lointain. La recherche porte sur le voyageur, la destination et le message.
 */
export async function listAdminTripShares(req, res) {
  const { search, page, limit } = req.validated.query;
  const filter = {};
  if (search) {
    const pattern = searchPattern(search);
    const [users, destinations] = await Promise.all([
      matchingUserIds(pattern),
      Destination.distinct('_id', { $or: [{ name: pattern }, { slug: pattern }] }),
    ]);
    filter.$or = [
      { message: pattern },
      { user: { $in: users } },
      { destination: { $in: destinations } },
    ];
  }
  const result = await paginate(TripShare, filter, {
    page,
    limit,
    sort: { startDate: 1, _id: 1 },
    populate: [
      { path: 'user', select: 'name email' },
      { path: 'destination', select: 'name slug' },
    ],
  });
  res.json(result);
}

/** DELETE /api/admin/trip-shares/:id → 204. */
export async function deleteAdminTripShare(req, res) {
  const share = await TripShare.findById(req.validated.params.id);
  if (!share) throw ApiError.notFound('Partage introuvable.');
  await share.deleteOne();
  res.status(204).end();
}
