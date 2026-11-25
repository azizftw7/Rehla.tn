import { Router } from 'express';
import {
  deleteAdminService,
  deleteAdminTripShare,
  deleteReview,
  deleteUser,
  getStats,
  getUser,
  listAdminServices,
  listAdminTripShares,
  listReviews,
  listUsers,
  reviewProvider,
  setAdminServiceVisibility,
  setUserStatus,
} from '../controllers/admin.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  adminServicesQuerySchema,
  listUsersQuerySchema,
  moderationQuerySchema,
  reviewIdSchema,
  serviceIdSchema,
  statusSchema,
  tripShareIdSchema,
  userIdSchema,
  validationSchema,
} from '../validators/admin.validators.js';
import { visibilitySchema } from '../validators/provider.validators.js';

// Routes d'administration (/api/admin).
// Monté derrière protect + authorize('admin') dans routes/index.js :
// toute route ajoutée ici est réservée aux administrateurs connectés.
const router = Router();
const byId = { params: userIdSchema };

router.get('/stats', getStats);

router.get('/users', validate({ query: listUsersQuerySchema }), listUsers);
router.get('/users/:id', validate(byId), getUser);
router.patch('/users/:id/statut', validate({ ...byId, body: statusSchema }), setUserStatus);
router.patch(
  '/users/:id/validation',
  validate({ ...byId, body: validationSchema }),
  reviewProvider,
);
router.delete('/users/:id', validate(byId), deleteUser);

// Modération des contenus (US7.2).
router.get('/reviews', validate({ query: moderationQuerySchema }), listReviews);
router.delete('/reviews/:id', validate({ params: reviewIdSchema }), deleteReview);

router.get('/services', validate({ query: adminServicesQuerySchema }), listAdminServices);
router.patch(
  '/services/:id/visibilite',
  validate({ params: serviceIdSchema, body: visibilitySchema }),
  setAdminServiceVisibility,
);
router.delete('/services/:id', validate({ params: serviceIdSchema }), deleteAdminService);

router.get('/trip-shares', validate({ query: moderationQuerySchema }), listAdminTripShares);
router.delete('/trip-shares/:id', validate({ params: tripShareIdSchema }), deleteAdminTripShare);

export default router;
