import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { assertEnv, env } from './config/env.js';

try {
  assertEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

try {
  await connectDB(env.mongodbUri);
} catch {
  // connectDB a déjà affiché la cause.
  process.exit(1);
}

const server = app.listen(env.port, (err) => {
  if (err) {
    console.error(
      err.code === 'EADDRINUSE'
        ? `Le port ${env.port} est déjà utilisé. Change PORT dans server/.env ou arrête l'autre processus.`
        : `Impossible de démarrer le serveur : ${err.message}`,
    );
    process.exit(1);
  }
  console.log(`API Rehla.tn démarrée sur http://localhost:${env.port}/api`);
});

async function shutdown() {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
