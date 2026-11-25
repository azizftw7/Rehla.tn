import { Destination, TRIP_SHARE_PUBLIC_USER_FIELDS, TripShare } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { normalizeText, publicName } from '../utils/text.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DESTINATION_FIELDS = 'name slug region';

// Un partage est actif tant que sa date d'expiration (lendemain du retour) n'est pas passée.
// L'index TTL le supprime ensuite (MongoDB passe environ une fois par minute).
const activeFilter = () => ({ expiresAt: { $gt: new Date() } });

/** Partages actifs des autres voyageurs, sur la même destination, aux dates qui se chevauchent. */
function overlappingFilter(share) {
  return {
    ...activeFilter(),
    destination: share.destination._id ?? share.destination,
    user: { $ne: share.user._id ?? share.user },
    startDate: { $lte: share.endDate },
    endDate: { $gte: share.startDate },
  };
}

/** Nombre de jours passés ensemble sur place (jours d'aller et de retour compris). */
export function overlapDays(a, b) {
  const start = Math.max(a.startDate.getTime(), b.startDate.getTime());
  const end = Math.min(a.endDate.getTime(), b.endDate.getTime());
  return end < start ? 0 : Math.round((end - start) / DAY_MS) + 1;
}

/**
 * Partage tel que le voient les co-voyageurs : prénom et initiale, puis seulement ce que
 * le voyageur a coché. Jamais d'e-mail ni de téléphone (TRIP_SHARE_PUBLIC_USER_FIELDS).
 */
export function toPublicTripShare(share, mine) {
  const { visible = {}, user } = share;
  return {
    _id: share._id,
    name: publicName(user?.name) || 'Voyageur',
    profile: visible.profile ? user?.profile : undefined,
    avatarUrl: visible.photo ? user?.avatarUrl || undefined : undefined,
    city: visible.city ? share.city : undefined,
    languages: visible.languages ? share.languages : undefined,
    startDate: share.startDate,
    endDate: share.endDate,
    message: share.message,
    overlapDays: overlapDays(share, mine),
  };
}

/**
 * Partage de l'utilisateur connecté (404 s'il n'existe pas, 403 s'il est à un autre).
 * forbidden : message du refus (403).
 */
async function findOwnShare(req, forbidden) {
  const share = await TripShare.findById(req.validated.params.id);
  if (!share) {
    throw ApiError.notFound('Partage introuvable.');
  }
  if (!share.user.equals(req.user._id)) {
    throw ApiError.forbidden(forbidden);
  }
  return share;
}

async function assertDestinationExists(id) {
  if (!(await Destination.exists({ _id: id }))) {
    throw ApiError.badRequest('Données invalides.', [
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  }
}

/** Un seul partage par voyageur sur une même destination et des dates qui se chevauchent (409). */
async function assertNoOverlap(req, data, excludeId) {
  const clash = await TripShare.exists({
    ...activeFilter(),
    user: req.user._id,
    destination: data.destination,
    startDate: { $lte: data.endDate },
    endDate: { $gte: data.startDate },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (clash) {
    throw ApiError.conflict('Vous partagez déjà un séjour à cette destination sur ces dates.', [
      { field: 'startDate', message: 'Ces dates chevauchent un de vos partages.' },
    ]);
  }
}

/** Champs du formulaire appliqués au document (les cases non envoyées valent leur défaut). */
function applyForm(share, data) {
  share.set({
    destination: data.destination,
    startDate: data.startDate,
    endDate: data.endDate,
    message: data.message,
    city: data.city,
    languages: data.languages?.length ? data.languages : undefined,
    visible: {
      profile: data.visible?.profile ?? true,
      city: data.visible?.city ?? false,
      languages: data.visible?.languages ?? false,
      photo: data.visible?.photo ?? false,
    },
  });
}

/** Son partage, avec la destination et le nombre de voyageurs qui le voient. */
async function toOwnTripShare(share) {
  await share.populate('destination', DESTINATION_FIELDS);
  const travelersCount = await TripShare.countDocuments(overlappingFilter(share));
  return { ...share.toJSON(), travelersCount };
}

/** GET /api/trip-shares/me?page=&limit= (voyageur) : ses partages actifs, du plus proche au plus lointain. */
export async function listMyTripShares(req, res) {
  const { page, limit } = req.validated.query;
  const result = await paginate(
    TripShare,
    { ...activeFilter(), user: req.user._id },
    { page, limit, sort: { startDate: 1, _id: 1 } },
  );
  res.json({ ...result, items: await Promise.all(result.items.map(toOwnTripShare)) });
}

/** POST /api/trip-shares (voyageur) → 201 { tripShare }. */
export async function createTripShare(req, res) {
  const data = req.validated.body;
  await assertDestinationExists(data.destination);
  await assertNoOverlap(req, data);

  const share = new TripShare({ user: req.user._id });
  applyForm(share, data);
  // save() : le hook pre('validate') calcule expiresAt (suppression automatique après le retour).
  await share.save();
  res.status(201).json({ tripShare: await toOwnTripShare(share) });
}

/** PUT /api/trip-shares/:id (auteur) → { tripShare } : remplace le partage. */
export async function updateTripShare(req, res) {
  const share = await findOwnShare(req, 'Vous ne pouvez modifier que vos propres partages.');
  const data = req.validated.body;
  await assertDestinationExists(data.destination);
  await assertNoOverlap(req, data, share._id);

  applyForm(share, data);
  await share.save();
  res.json({ tripShare: await toOwnTripShare(share) });
}

/** DELETE /api/trip-shares/:id (auteur) → 204. */
export async function deleteTripShare(req, res) {
  const share = await findOwnShare(req, 'Vous ne pouvez supprimer que vos propres partages.');
  await share.deleteOne();
  res.status(204).end();
}

/**
 * GET /api/trip-shares/:id/co-voyageurs?profile=&language=&minDays=&page=&limit= (auteur)
 * Voyageurs qui partagent la même destination à des dates qui chevauchent ce partage.
 * On ne voit les autres qu'à travers son propre partage actif : 403 sinon.
 * Les filtres ne portent que sur ce que chacun a rendu visible.
 * → { items, total, page, pages, destination, languages } (languages : langues proposées au filtre)
 */
export async function listCoTravelers(req, res) {
  const share = await findOwnShare(
    req,
    'Les co-voyageurs ne sont visibles qu’à travers vos propres partages.',
  );
  if (share.expiresAt <= new Date()) {
    throw ApiError.forbidden(
      'Ce partage est terminé : publiez un nouveau séjour pour voir les co-voyageurs.',
    );
  }
  await share.populate('destination', DESTINATION_FIELDS);
  const { profile, language, minDays, page, limit } = req.validated.query;

  const others = await TripShare.find(overlappingFilter(share))
    .sort({ startDate: 1, _id: 1 })
    .populate('user', TRIP_SHARE_PUBLIC_USER_FIELDS);
  const cards = others
    .filter((other) => other.user)
    .map((other) => toPublicTripShare(other, share));

  const languages = [...new Set(cards.flatMap((card) => card.languages ?? []))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );
  const wanted = language && normalizeText(language);
  const filtered = cards.filter(
    (card) =>
      (!profile || card.profile === profile) &&
      (!wanted || (card.languages ?? []).some((item) => normalizeText(item) === wanted)) &&
      (!minDays || card.overlapDays >= minDays),
  );

  const start = (page - 1) * limit;
  res.json({
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    pages: Math.ceil(filtered.length / limit),
    destination: share.destination,
    languages,
  });
}
