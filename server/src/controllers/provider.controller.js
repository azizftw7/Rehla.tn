import { Destination, Favorite, Offer, Review, Service } from '../models/index.js';
import { MAX_PHOTOS } from '../middlewares/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { HIDDEN_BY_ADMIN } from '../utils/messages.js';
import { paginate } from '../utils/pagination.js';
import { deleteImages, uploadImages } from '../utils/upload.js';
import { toServiceDocument } from '../validators/provider.validators.js';

// Champs remplacés à chaque modification : un champ absent du nouveau document est effacé
// (ex. la cuisine d'un restaurant devenu activité).
const EDITABLE_FIELDS = [
  'type',
  'name',
  'description',
  'destination',
  'address',
  'location',
  'free',
  'videoUrl',
  'price',
  'contact',
  'accommodationType',
  'cuisine',
  'activityCategory',
  'event',
  'languages',
];

async function assertDestinationExists(id) {
  if (!(await Destination.exists({ _id: id }))) {
    throw ApiError.badRequest('Données invalides.', [
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  }
}

/**
 * Service du prestataire connecté. Le service d'un autre prestataire répond 404, comme
 * un service inexistant : on ne révèle pas qu'il existe.
 */
async function findOwnService(req) {
  const service = await Service.findOne({ _id: req.validated.params.id, provider: req.user._id });
  if (!service) throw ApiError.notFound('Service introuvable.');
  return service;
}

/** POST /api/provider/services : le prestataire connecté publie une fiche service. */
export async function createService(req, res) {
  const data = req.validated.body;
  await assertDestinationExists(data.destination);

  // Le document est validé avant l'envoi des photos : pas d'upload inutile si la fiche est invalide.
  const service = new Service({ ...toServiceDocument(data), provider: req.user._id });
  await service.validate();

  service.photos = await uploadImages(req.files);
  await service.save();
  await service.populate('destination', 'name slug region');

  res.status(201).json({ service });
}

/** GET /api/provider/services : services du prestataire connecté, masqués compris. */
export async function listOwnServices(req, res) {
  const { page, limit } = req.validated.query;
  const result = await paginate(
    Service,
    { provider: req.user._id },
    {
      page,
      limit,
      sort: { createdAt: -1, _id: -1 },
      populate: { path: 'destination', select: 'name slug region' },
    },
  );
  res.json(result);
}

/** GET /api/provider/services/:id : un de ses services (pour préremplir le formulaire). */
export async function getOwnService(req, res) {
  const service = await findOwnService(req);
  await service.populate('destination', 'name slug region location');
  res.json({ service });
}

/**
 * PUT /api/provider/services/:id (multipart) : remplace la fiche.
 * keptPhotos = anciennes photos gardées (dans l'ordre), « photos » = nouveaux fichiers.
 */
export async function updateService(req, res) {
  const { keptPhotos, ...data } = req.validated.body;
  const service = await findOwnService(req);
  await assertDestinationExists(data.destination);

  // Seules les photos de ce service peuvent être gardées (pas d'URL ajoutée à la main).
  const kept = [...new Set(keptPhotos)].filter((url) => service.photos.includes(url));
  const newFiles = req.files ?? [];
  if (kept.length + newFiles.length > MAX_PHOTOS) {
    const message = `Un service peut avoir au plus ${MAX_PHOTOS} photos.`;
    throw ApiError.badRequest(message, [{ field: 'photos', message }]);
  }

  const doc = toServiceDocument(data);
  for (const field of EDITABLE_FIELDS) service.set(field, doc[field]);
  // Validé avant l'envoi des photos : pas d'upload inutile si la fiche est invalide.
  await service.validate();

  const removed = service.photos.filter((url) => !kept.includes(url));
  service.photos = [...kept, ...(await uploadImages(newFiles))];
  await service.save();
  await deleteImages(removed);
  await service.populate('destination', 'name slug region location');

  res.json({ service });
}

/**
 * PATCH /api/provider/services/:id/visibilite : masque ou réaffiche le service.
 * Un service masqué par la modération (hiddenByAdmin) ne peut pas être réaffiché par le
 * prestataire (403) ; il peut seulement le masquer de son côté.
 */
export async function setServiceVisibility(req, res) {
  const service = await findOwnService(req);
  if (service.hiddenByAdmin && req.validated.body.hidden === false) {
    throw ApiError.forbidden(HIDDEN_BY_ADMIN);
  }
  service.hidden = req.validated.body.hidden;
  await service.save();
  await service.populate('destination', 'name slug region');
  res.json({ service });
}

/** DELETE /api/provider/services/:id : supprime le service, ses photos et ce qui s'y rattache. */
export async function deleteService(req, res) {
  const service = await findOwnService(req);
  await service.deleteOne();
  await Promise.all([
    Offer.deleteMany({ service: service._id }),
    Review.deleteMany({ service: service._id }),
    Favorite.deleteMany({ service: service._id }),
  ]);
  await deleteImages(service.photos);
  res.status(204).end();
}
