import { Router } from 'express';
import { listTransports } from '../controllers/transports.controller.js';
import { validate } from '../middlewares/validate.js';
import { listTransportsSchema } from '../validators/transports.validators.js';

// Route publique : accessible aux visiteurs non connectés.
const router = Router();

router.get('/', validate({ query: listTransportsSchema }), listTransports);

export default router;
