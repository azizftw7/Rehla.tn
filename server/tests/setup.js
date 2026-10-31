import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import '../src/models/index.js';

beforeAll(async () => {
  // Base dédiée à ce fichier de test : les fichiers s'exécutent en parallèle sans se gêner.
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
