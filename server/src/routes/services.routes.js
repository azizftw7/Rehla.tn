import { Router } from 'express';
import { getService, listServices } from '../controllers/services.controller.js';
import { validate } from '../middlewares/validate.js';
import { listServicesSchema, serviceIdSchema } from '../validators/services.validators.js';

const router = Router();

router.get('/', validate({ query: listServicesSchema }), listServices);
router.get('/:id', validate({ params: serviceIdSchema }), getService);

export default router;