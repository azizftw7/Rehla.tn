import { Router } from 'express';
import mongoose from 'mongoose';
import { authorize, protect } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import providerRoutes from './provider.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/users', usersRoutes);
router.use('/provider', protect, authorize('prestataire'), providerRoutes);
router.use('/admin', protect, authorize('admin'), adminRoutes);

router.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connectée' : 'déconnectée',
  });
});

export default router;
