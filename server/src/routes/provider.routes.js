import { Router } from 'express';

// Routes de l'espace prestataire (/api/provider).
// Monté derrière protect + authorize('prestataire') dans routes/index.js :
// toute route ajoutée ici est réservée aux prestataires connectés.
const router = Router();

export default router;
