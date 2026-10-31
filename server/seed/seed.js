// Remplit la base avec des données de démonstration : npm run seed
// ATTENTION : vide d'abord toutes les collections de la base indiquée par MONGODB_URI.
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { assertEnv, env, isProduction } from '../src/config/env.js';
import {
  Destination,
  Favorite,
  Offer,
  Review,
  Service,
  Transport,
  TripShare,
  User,
} from '../src/models/index.js';
import * as data from './data.js';

const MODELS = [User, Destination, Service, Offer, Review, Favorite, TripShare, Transport];

function pick(map, key, kind) {
  const value = map.get(key);
  if (!value) throw new Error(`Seed : ${kind} « ${key} » introuvable dans seed/data.js.`);
  return value;
}

async function seed() {
  if (isProduction()) {
    throw new Error('Le seed est réservé au développement (NODE_ENV=production détecté).');
  }
  assertEnv(['MONGODB_URI', 'SEED_DEMO_PASSWORD']);
  const password = process.env.SEED_DEMO_PASSWORD;
  if (password.length < 8) {
    throw new Error('SEED_DEMO_PASSWORD doit contenir au moins 8 caractères.');
  }

  await connectDB(env.mongodbUri).catch((err) => {
    err.alreadyLogged = true;
    throw err;
  });

  await Promise.all(MODELS.map((Model) => Model.deleteMany({})));
  await Promise.all(MODELS.map((Model) => Model.syncIndexes()));

  const users = new Map();
  for (const { key, ...user } of data.users) {
    // create() (et non insertMany) pour passer par le hachage du mot de passe.
    users.set(key, await User.create({ ...user, password }));
  }

  const destinations = new Map();
  for (const { key, ...destination } of data.destinations) {
    destinations.set(key, await Destination.create(destination));
  }

  const services = new Map();
  for (const { key, destination, provider, ...service } of data.services) {
    services.set(
      key,
      await Service.create({
        ...service,
        destination: pick(destinations, destination, 'destination')._id,
        provider: pick(users, provider, 'utilisateur')._id,
      }),
    );
  }

  await Offer.create(
    data.offers.map((offer) => ({
      ...offer,
      service: pick(services, offer.service, 'service')._id,
    })),
  );

  // Un par un : le hook post('save') recalcule la note moyenne de chaque service.
  for (const review of data.reviews) {
    await Review.create({
      ...review,
      service: pick(services, review.service, 'service')._id,
      author: pick(users, review.author, 'utilisateur')._id,
      providerReply: review.providerReply && { ...review.providerReply, repliedAt: new Date() },
    });
  }

  await Transport.create(
    data.transports.map((transport) => ({
      ...transport,
      destination: pick(destinations, transport.destination, 'destination')._id,
      sourceUpdatedAt: new Date(),
    })),
  );

  console.log(
    [
      'Seed terminé :',
      `- ${users.size} comptes (mot de passe : valeur de SEED_DEMO_PASSWORD)`,
      `- ${destinations.size} destinations`,
      `- ${services.size} services, ${data.offers.length} offres, ${data.reviews.length} avis`,
      `- ${data.transports.length} transports`,
      '',
      'Comptes de démo :',
      ...data.users.map((user) => `  ${user.role.padEnd(12)} ${user.email}`),
    ].join('\n'),
  );
}

try {
  await seed();
} catch (err) {
  if (!err.alreadyLogged) console.error(`Échec du seed : ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
