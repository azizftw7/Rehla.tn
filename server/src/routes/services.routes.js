import { Router } from 'express';
import {
  createReview,
  getMyReview,
  listServiceReviews,
} from '../controllers/reviews.controller.js';
import { getService, listServices } from '../controllers/services.controller.js';
import { authorize, protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createReviewSchema, listReviewsSchema } from '../validators/reviews.validators.js';
import { listServicesSchema, serviceIdSchema } from '../validators/services.validators.js';

const router = Router();
const byId = { params: serviceIdSchema };

router.get('/', validate({ query: listServicesSchema }), listServices);
router.get('/:id', validate(byId), getService);

// Avis d'un service (US3.5) : liste publique, avis du voyageur connecté, publication.
router.get('/:id/reviews', validate({ ...byId, query: listReviewsSchema }), listServiceReviews);
router.get('/:id/reviews/me', protect, authorize('voyageur'), validate(byId), getMyReview);
router.post(
  '/:id/reviews',
  protect,
  authorize('voyageur'),
  validate({ ...byId, body: createReviewSchema }),
  createReview,
);

export default router;
