import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { describe, expect, inject, it } from 'vitest';

const run = promisify(execFile);
const SEED_DB = 'seed-test';

// Lance le vrai script (comme « npm run seed ») contre la base en mémoire.
function runSeed(extraEnv) {
  const uri = new URL(inject('mongoUri'));
  uri.pathname = `/${SEED_DB}`;
  return run(process.execPath, ['seed/seed.js'], {
    env: { ...process.env, NODE_ENV: 'development', MONGODB_URI: uri.toString(), ...extraEnv },
  });
}

describe('npm run seed', () => {
  it('crée les données de démo valides', async () => {
    const { stdout } = await runSeed({ SEED_DEMO_PASSWORD: 'demo-password-1' });
    expect(stdout).toContain('Seed terminé');

    const db = mongoose.connection.useDb(SEED_DB, { useCache: true });
    const count = (name) => db.collection(name).countDocuments();

    expect(await count('destinations')).toBe(3);
    expect(await count('users')).toBe(6);
    expect(await db.collection('users').countDocuments({ role: 'admin' })).toBe(1);
    expect(await db.collection('users').countDocuments({ role: 'prestataire' })).toBe(2);
    expect(await db.collection('users').countDocuments({ role: 'voyageur' })).toBe(3);
    expect(await db.collection('services').distinct('type')).toEqual(
      expect.arrayContaining(['hebergement', 'restaurant', 'activite', 'evenement', 'guide']),
    );
    expect(await count('offers')).toBeGreaterThan(0);
    expect(await count('reviews')).toBeGreaterThan(0);
    expect(await count('transports')).toBeGreaterThan(0);

    const djerba = await db.collection('destinations').findOne({ slug: 'djerba' });
    expect(djerba.location.coordinates).toEqual([10.8575, 33.8758]);

    const reviewed = await db.collection('services').findOne({ name: 'Menzel des Palmes Bleues' });
    expect(reviewed.ratingCount).toBe(2);
    expect(reviewed.ratingAverage).toBe(4.5);

    const admin = await db.collection('users').findOne({ role: 'admin' });
    expect(admin.password).toMatch(/^\$2[aby]\$/);

    await db.dropDatabase();
  });

  it('refuse de s’exécuter sans SEED_DEMO_PASSWORD', async () => {
    await expect(runSeed({ SEED_DEMO_PASSWORD: '' })).rejects.toMatchObject({
      stderr: expect.stringContaining('SEED_DEMO_PASSWORD'),
    });
  });

  it('refuse de s’exécuter en production', async () => {
    await expect(
      runSeed({ SEED_DEMO_PASSWORD: 'demo-password-1', NODE_ENV: 'production' }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('réservé au développement') });
  });
});
