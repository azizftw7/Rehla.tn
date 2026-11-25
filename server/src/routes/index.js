import { Router } from 'express';
import mongoose from 'mongoose';
import { authorize, protect, requireApprovedProvider } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimit.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import destinationsRoutes from './destinations.routes.js';
import favoritesRoutes from './favorites.routes.js';
import providerRoutes from './provider.routes.js';
import reviewsRoutes from './reviews.routes.js';
import servicesRoutes from './services.routes.js';
import transportsRoutes from './transports.routes.js';
import usersRoutes from './users.routes.js';

const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/users', usersRoutes);
router.use('/favorites', favoritesRoutes);
router.use('/destinations', destinationsRoutes);
router.use('/services', servicesRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/transports', transportsRoutes);
// Un prestataire n'accède à son espace qu'après validation par l'administrateur (US7.1).
router.use('/provider', protect, authorize('prestataire'), requireApprovedProvider, providerRoutes);
router.use('/admin', protect, authorize('admin'), adminRoutes);

router.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    database: connected ? 'connectée' : 'déconnectée',
  });
});

export default router;
