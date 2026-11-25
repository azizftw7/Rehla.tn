import { Router } from 'express';
import {
  createService,
  deleteService,
  getOwnService,
  listOwnServices,
  setServiceVisibility,
  updateService,
} from '../controllers/provider.controller.js';
import {
  createReply,
  deleteReply,
  listReceivedReviews,
  updateReply,
} from '../controllers/reviews.controller.js';
import { uploadPhotos } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import {
  createServiceSchema,
  providerServicesQuerySchema,
  updateServiceSchema,
  visibilitySchema,
} from '../validators/provider.validators.js';
import {
  providerReviewsQuerySchema,
  replySchema,
  reviewIdSchema,
} from '../validators/reviews.validators.js';
import { serviceIdSchema } from '../validators/services.validators.js';

// Routes de l'espace prestataire (/api/provider).
// Monté derrière protect + authorize('prestataire') dans routes/index.js :
// toute route ajoutée ici est réservée aux prestataires connectés.
// Un prestataire n'atteint que ses propres services (sinon 404).
const router = Router();
const byId = { params: serviceIdSchema };

router.get('/services', validate({ query: providerServicesQuerySchema }), listOwnServices);
// multipart/form-data : champs à plat + jusqu'à 5 fichiers dans « photos ».
router.post('/services', uploadPhotos, validate({ body: createServiceSchema }), createService);

router.get('/services/:id', validate(byId), getOwnService);
// multipart/form-data : mêmes champs que la création + keptPhotos (anciennes photos gardées).
router.put(
  '/services/:id',
  uploadPhotos,
  validate({ ...byId, body: updateServiceSchema }),
  updateService,
);
router.patch(
  '/services/:id/visibilite',
  validate({ ...byId, body: visibilitySchema }),
  setServiceVisibility,
);
router.delete('/services/:id', validate(byId), deleteService);

// Avis reçus sur ses services et réponse du prestataire (US6.4) : une seule réponse par avis.
const byReviewId = { params: reviewIdSchema };
router.get('/reviews', validate({ query: providerReviewsQuerySchema }), listReceivedReviews);
router.post('/reviews/:id/reply', validate({ ...byReviewId, body: replySchema }), createReply);
router.patch('/reviews/:id/reply', validate({ ...byReviewId, body: replySchema }), updateReply);
router.delete('/reviews/:id/reply', validate(byReviewId), deleteReply);

export default router;
