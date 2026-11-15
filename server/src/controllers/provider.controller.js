import { Destination, Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadImages } from '../utils/upload.js';
import { toServiceDocument } from '../validators/provider.validators.js';

/** POST /api/provider/services : le prestataire connecté publie une fiche service. */
export async function createService(req, res) {
  const data = req.validated.body;

  const destinationExists = await Destination.exists({ _id: data.destination });
  if (!destinationExists) {
    throw ApiError.badRequest('Données invalides.', [
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  }

  // Le document est validé avant l'envoi des photos : pas d'upload inutile si la fiche est invalide.
  const service = new Service({ ...toServiceDocument(data), provider: req.user._id });
  await service.validate();

  service.photos = await uploadImages(req.files);
  await service.save();
  await service.populate('destination', 'name slug region');

  res.status(201).json({ service });
}
