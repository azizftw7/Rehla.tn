import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Un seul serveur MongoDB en mémoire pour toute la suite ; chaque fichier de test a sa propre base.
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    env: {
      NODE_ENV: 'test',
      // Secret aléatoire généré à chaque exécution : aucune clé n'est stockée dans le dépôt.
      JWT_SECRET: randomBytes(32).toString('hex'),
      JWT_EXPIRES_IN: '1h',
    },
    // Le premier lancement télécharge le binaire MongoDB.
    hookTimeout: 120000,
    testTimeout: 20000,
  },
});
