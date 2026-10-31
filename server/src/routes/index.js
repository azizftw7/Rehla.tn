import { Router } from 'express';
import mongoose from 'mongoose';
import { authLimiter } from '../middlewares/rateLimit.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/users', usersRoutes);

router.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connectée' : 'déconnectée',
  });
});

export default router;
