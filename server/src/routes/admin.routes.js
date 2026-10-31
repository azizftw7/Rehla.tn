import { Router } from 'express';

// Routes d'administration (/api/admin).
// Monté derrière protect + authorize('admin') dans routes/index.js :
// toute route ajoutée ici est réservée aux administrateurs connectés.
const router = Router();

export default router;
