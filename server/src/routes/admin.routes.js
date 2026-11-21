import { Router } from 'express';
import {
  deleteUser,
  getStats,
  getUser,
  listUsers,
  reviewProvider,
  setUserStatus,
} from '../controllers/admin.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  listUsersQuerySchema,
  statusSchema,
  userIdSchema,
  validationSchema,
} from '../validators/admin.validators.js';

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

export default router;
