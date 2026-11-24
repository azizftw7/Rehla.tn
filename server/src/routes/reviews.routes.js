import { Router } from 'express';
import { deleteReview, updateReview } from '../controllers/reviews.controller.js';
import { authorize, protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { reviewIdSchema, updateReviewSchema } from '../validators/reviews.validators.js';

// Avis (/api/reviews) : chaque voyageur ne modifie ou ne supprime que les siens (US3.5).
// La liste et la publication sont sous /api/services/:id/reviews.
const router = Router();
const byId = { params: reviewIdSchema };

router.patch(
  '/:id',
  protect,
  authorize('voyageur'),
  validate({ ...byId, body: updateReviewSchema }),
  updateReview,
);
router.delete('/:id', protect, authorize('voyageur'), validate(byId), deleteReview);

export default router;
