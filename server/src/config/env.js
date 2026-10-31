import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
};

export const isProduction = () => env.nodeEnv === 'production';
export const isTest = () => env.nodeEnv === 'test';

/**
 * Vérifie que les variables indispensables au démarrage sont définies.
 * Lève une erreur avec un message explicite sinon.
 */
export function assertEnv(names = ['MONGODB_URI', 'JWT_SECRET']) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(', ')}. ` +
        'Copie server/.env.example vers server/.env puis complète-le.',
    );
  }
}
