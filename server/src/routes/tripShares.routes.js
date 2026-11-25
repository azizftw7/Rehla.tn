import { Router } from 'express';
import {
  createTripShare,
  deleteTripShare,
  listCoTravelers,
  listMyTripShares,
  updateTripShare,
} from '../controllers/tripShares.controller.js';
import { authorize, protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  coTravelersQuerySchema,
  myTripSharesQuerySchema,
  tripShareIdSchema,
  tripShareSchema,
} from '../validators/tripShares.validators.js';

// Partage volontaire de déplacement (/api/trip-shares, US5.3 et US5.4) : réservé aux voyageurs.
// Chacun gère ses partages ; les autres ne se voient qu'à travers son propre partage actif.
const router = Router();
const byId = { params: tripShareIdSchema };

router.use(protect, authorize('voyageur'));

router.get('/me', validate({ query: myTripSharesQuerySchema }), listMyTripShares);
router.post('/', validate({ body: tripShareSchema }), createTripShare);
router.put('/:id', validate({ ...byId, body: tripShareSchema }), updateTripShare);
router.delete('/:id', validate(byId), deleteTripShare);
router.get(
  '/:id/co-voyageurs',
  validate({ ...byId, query: coTravelersQuerySchema }),
  listCoTravelers,
);

export default router;
