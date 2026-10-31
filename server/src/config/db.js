import mongoose from 'mongoose';

/**
 * Connexion à MongoDB (local ou Atlas : seule l'URI change).
 * En cas d'échec, affiche un message qui aide à trouver la cause puis relance l'erreur.
 */
export async function connectDB(uri) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB connecté (${mongoose.connection.host}/${mongoose.connection.name})`);
  } catch (err) {
    console.error(
      [
        'Impossible de se connecter à MongoDB.',
        '- Vérifie MONGODB_URI dans server/.env.',
        '- MongoDB local : le service MongoDB est-il démarré ?',
        '- MongoDB Atlas : ton adresse IP est-elle autorisée (Network Access) ? Identifiants corrects ?',
        `Détail : ${err.message}`,
      ].join('\n'),
    );
    throw err;
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
