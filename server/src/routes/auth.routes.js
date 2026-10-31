import { Router } from 'express';
import { register } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { registerSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', validate({ body: registerSchema }), register);

export default router;
