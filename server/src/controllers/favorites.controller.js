import { Favorite, Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';

// Champs d'un service affichés sur la page « Mes favoris » (comme sur ServiceCard).
const SERVICE_FIELDS =
  'type name description destination photos price free cuisine activityCategory ' +
  'accommodationType event languages ratingAverage ratingCount';

/**
 * Services favoris de l'utilisateur encore visibles : un service masqué par son prestataire
 * ou par l'administrateur n'apparaît plus (le favori revient s'il est réaffiché).
 */
async function visibleFavoriteServiceIds(userId) {
  const ids = await Favorite.distinct('service', { user: userId });
  if (ids.length === 0) return [];
  return Service.distinct('_id', { _id: { $in: ids }, hidden: false });
}

/** GET /api/favorites?page=&limit= (voyageur) : plus récents d'abord. → { items, total, page, pages } */
export async function listFavorites(req, res) {
  const { page, limit } = req.validated.query;
  const visibleIds = await visibleFavoriteServiceIds(req.user._id);

  const result = await paginate(
    Favorite,
    { user: req.user._id, service: { $in: visibleIds } },
    {
      page,
      limit,
      sort: { createdAt: -1, _id: -1 },
      populate: {
        path: 'service',
        select: SERVICE_FIELDS,
        populate: { path: 'destination', select: 'name slug region' },
      },
    },
  );
  res.json(result);
}

/** GET /api/favorites/ids (voyageur) → { ids } : pour afficher les cœurs déjà cochés. */
export async function listFavoriteIds(req, res) {
  const ids = await visibleFavoriteServiceIds(req.user._id);
  res.json({ ids });
}

/** POST /api/favorites { serviceId } (voyageur) → 201 { favorite }. 409 si déjà en favori. */
export async function addFavorite(req, res) {
  const { serviceId } = req.validated.body;
  if (!(await Service.exists({ _id: serviceId, hidden: false }))) {
    throw ApiError.notFound('Service introuvable.');
  }
  // L'index unique (user, service) refuse un doublon, même envoyé deux fois en même temps :
  // errorHandler répond 409 « Ce service est déjà dans vos favoris. »
  const favorite = await Favorite.create({ user: req.user._id, service: serviceId });
  res.status(201).json({ favorite });
}

/** DELETE /api/favorites/:serviceId (voyageur) → 204. 404 si le service n'est pas en favori. */
export async function removeFavorite(req, res) {
  const deleted = await Favorite.findOneAndDelete({
    user: req.user._id,
    service: req.validated.params.serviceId,
  });
  if (!deleted) {
    throw ApiError.notFound("Ce service n'est pas dans vos favoris.");
  }
  res.status(204).end();
}
