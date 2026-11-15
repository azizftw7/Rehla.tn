import { Router } from 'express';
import { createService } from '../controllers/provider.controller.js';
import { uploadPhotos } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { createServiceSchema } from '../validators/provider.validators.js';

// Routes de l'espace prestataire (/api/provider).
// Monté derrière protect + authorize('prestataire') dans routes/index.js :
// toute route ajoutée ici est réservée aux prestataires connectés.
const router = Router();

// multipart/form-data : champs à plat + jusqu'à 5 fichiers dans « photos ».
router.post('/services', uploadPhotos, validate({ body: createServiceSchema }), createService);

export default router;
