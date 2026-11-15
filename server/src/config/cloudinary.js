import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

// Les clés viennent de server/.env (vérifiées au démarrage par assertEnv dans server.js).
// En test, Cloudinary est simulé avec vi.mock : aucune clé n'est nécessaire.
cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

export const isCloudinaryConfigured = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

export { cloudinary };
