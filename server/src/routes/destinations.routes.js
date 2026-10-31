import { Router } from 'express';
import { getDestination, listDestinations } from '../controllers/destinations.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  destinationSlugSchema,
  listDestinationsSchema,
} from '../validators/destinations.validators.js';

// Routes publiques : accessibles aux visiteurs non connectés.
const router = Router();

router.get('/', validate({ query: listDestinationsSchema }), listDestinations);
router.get('/:slug', validate({ params: destinationSlugSchema }), getDestination);

export default router;
