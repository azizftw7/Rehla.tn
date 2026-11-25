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
    expect(await count('users')).toBe(7);
    expect(await db.collection('users').countDocuments({ role: 'admin' })).toBe(1);
    expect(await db.collection('users').countDocuments({ role: 'prestataire' })).toBe(3);
    // US7.1 : les prestataires qui ont des services sont approuvés, un troisième attend.
    const providers = await db.collection('users').find({ role: 'prestataire' }).toArray();
    const approvals = Object.fromEntries(providers.map((p) => [p.email, p.provider.approval]));
    expect(approvals).toEqual({
      'prestataire1@demo.rehla.tn': 'approuve',
      'prestataire2@demo.rehla.tn': 'approuve',
      'prestataire3@demo.rehla.tn': 'en_attente',
    });
    expect(await db.collection('users').countDocuments({ role: 'voyageur' })).toBe(3);
    expect(await db.collection('services').distinct('type')).toEqual(
      expect.arrayContaining(['hebergement', 'restaurant', 'activite', 'evenement', 'guide']),
    );
    expect(await count('offers')).toBeGreaterThan(0);
    // US4.2 : 5 guides, et au moins un parle espagnol ou allemand.
    expect(await db.collection('services').countDocuments({ type: 'guide' })).toBe(5);
    expect(
      await db.collection('services').countDocuments({ type: 'guide', languages: 'espagnol' }),
    ).toBe(1);
    expect(
      await db.collection('services').countDocuments({ type: 'guide', languages: 'allemand' }),
    ).toBe(2);
    expect(await count('reviews')).toBeGreaterThan(0);
    expect(await count('transports')).toBeGreaterThan(0);
    // Date de relevé des données indicatives, et non la date d'exécution du seed.
    const transportDates = await db.collection('transports').distinct('sourceUpdatedAt');
    expect(transportDates).toEqual([new Date('2026-10-01T00:00:00.000Z')]);

    const djerba = await db.collection('destinations').findOne({ slug: 'djerba' });
    expect(djerba.location.coordinates).toEqual([10.8575, 33.8758]);

    const reviewed = await db.collection('services').findOne({ name: 'Menzel des Palmes Bleues' });
    expect(reviewed.ratingCount).toBe(2);
    expect(reviewed.ratingAverage).toBe(4.5);

    // US3.1 : chaque hébergement a un type, et au moins une offre en cours sur un hébergement.
    const lodgings = await db.collection('services').find({ type: 'hebergement' }).toArray();
    expect(lodgings.every((s) => s.accommodationType)).toBe(true);
    const now = new Date();
    const activeLodgingOffer = await db.collection('offers').findOne({
      service: { $in: lodgings.map((s) => s._id) },
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
    expect(activeLodgingOffer).not.toBeNull();

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
