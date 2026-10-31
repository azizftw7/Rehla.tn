import { Router } from 'express';
import { getMe } from '../controllers/users.controller.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/me', getMe);

export default router;
