import { Router } from 'express';
import { changePassword, getMe, updateMe } from '../controllers/users.controller.js';
import { protect } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { changePasswordSchema, updateMeSchema } from '../validators/users.validators.js';

const router = Router();

router.use(protect);

router.get('/me', getMe);
router.put('/me', validate({ body: updateMeSchema }), updateMe);
router.put('/me/password', validate({ body: changePasswordSchema }), changePassword);

export default router;
