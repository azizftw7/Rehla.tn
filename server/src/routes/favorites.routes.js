import { Router } from 'express';
import {
  addFavorite,
  listFavoriteIds,
  listFavorites,
  removeFavorite,
} from '../controllers/favorites.controller.js';
import { authorize, protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  addFavoriteSchema,
  favoriteServiceIdSchema,
  listFavoritesSchema,
} from '../validators/favorites.validators.js';

// Favoris (/api/favorites, US5.1) : réservés aux voyageurs connectés, chacun ne voit que les siens.
const router = Router();

router.use(protect, authorize('voyageur'));

router.get('/', validate({ query: listFavoritesSchema }), listFavorites);
router.get('/ids', listFavoriteIds);
router.post('/', validate({ body: addFavoriteSchema }), addFavorite);
router.delete('/:serviceId', validate({ params: favoriteServiceIdSchema }), removeFavorite);

export default router;
