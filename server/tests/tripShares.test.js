import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, TripShare } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const UNKNOWN_ID = '64b7f0c2a1b2c3d4e5f60718';
const DAY_MS = 24 * 60 * 60 * 1000;

/** « AAAA-MM-JJ » à `offset` jours d'aujourd'hui (UTC). */
const day = (offset) => new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
const utc = (value) => new Date(`${value}T00:00:00.000Z`);

let djerba;
let tozeur;
let amel;
let karim;
let sofia;
let mehdi;
let provider;
let admin;

const shareBody = (overrides = {}) => ({
  destination: String(djerba._id),
  startDate: day(10),
  endDate: day(16),
  message: 'Quelqu’un pour partager un louage depuis Tunis ?',
  city: 'Tunis',
  languages: ['Français', 'Arabe'],
  visible: { profile: true, city: true, languages: true, photo: false },
  ...overrides,
});

beforeEach(async () => {
  [djerba, tozeur] = await Destination.create([
    { name: 'Djerba', region: 'Médenine', location: point(10.8575, 33.8758) },
    { name: 'Tozeur', region: 'Tozeur', location: point(8.1335, 33.9197) },
  ]);
  amel = await createUser({
    name: 'Amel Ben Salah',
    email: 'amel@example.com',
    profile: 'etudiant',
    avatarUrl: 'https://example.com/amel.png',
  });
  karim = await createUser({
    name: 'Karim Trabelsi',
    email: 'karim@example.com',
    profile: 'resident',
    avatarUrl: 'https://example.com/karim.png',
  });
  sofia = await createUser({ name: 'Sofia Rossi', profile: 'touriste' });
  mehdi = await createUser({ name: 'Mehdi Jaziri', profile: 'etudiant' });
  provider = await createUser({ role: 'prestataire' });
  admin = await createUser({ role: 'admin' });
});

describe('US5.3 — POST /api/trip-shares', () => {
  it('publie un partage avec expiration le lendemain du retour (201)', async () => {
    const res = await request(app).post('/api/trip-shares').set(authHeader(amel)).send(shareBody());

    expect(res.status).toBe(201);
    expect(res.body.tripShare).toMatchObject({
      destination: { name: 'Djerba', slug: 'djerba' },
      startDate: utc(day(10)).toISOString(),
      endDate: utc(day(16)).toISOString(),
      expiresAt: utc(day(17)).toISOString(),
      city: 'Tunis',
      languages: ['Français', 'Arabe'],
      visible: { profile: true, city: true, languages: true, photo: false },
      travelersCount: 0,
    });
  });

  it('applique les choix de visibilité par défaut (profil seulement)', async () => {
    const res = await request(app)
      .post('/api/trip-shares')
      .set(authHeader(amel))
      .send({ destination: String(djerba._id), startDate: day(1), endDate: day(3) });

    expect(res.status).toBe(201);
    expect(res.body.tripShare.visible).toEqual({
      profile: true,
      city: false,
      languages: false,
      photo: false,
    });
  });

  it('valide le formulaire (400, messages en français)', async () => {
    const cases = [
      [{ destination: '' }, 'destination', 'Choisissez une destination.'],
      [{ startDate: undefined }, 'startDate', "La date d'aller est obligatoire."],
      [{ endDate: '12/07/2026' }, 'endDate', 'La date de retour doit être au format AAAA-MM-JJ.'],
      [
        { startDate: day(10), endDate: day(10) },
        'endDate',
        "La date de retour doit être postérieure à la date d'aller.",
      ],
      [{ startDate: day(-10), endDate: day(-2) }, 'endDate', 'La date de retour est déjà passée.'],
      [{ message: 'a'.repeat(201) }, 'message', 'Le message ne peut pas dépasser 200 caractères.'],
      [{ city: '' }, 'city', 'Indiquez votre ville de départ, ou décochez « Ville de départ ».'],
      [
        { languages: [] },
        'languages',
        'Choisissez au moins une langue, ou décochez « Langues parlées ».',
      ],
    ];
    for (const [overrides, field, message] of cases) {
      const res = await request(app)
        .post('/api/trip-shares')
        .set(authHeader(amel))
        .send(shareBody(overrides));
      expect(res.status, field).toBe(400);
      expect(res.body.details).toContainEqual({ field, message });
    }
  });

  it('renvoie 400 pour une destination inconnue', async () => {
    const res = await request(app)
      .post('/api/trip-shares')
      .set(authHeader(amel))
      .send(shareBody({ destination: UNKNOWN_ID }));
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  });

  it('refuse deux partages qui se chevauchent sur la même destination (409)', async () => {
    await request(app).post('/api/trip-shares').set(authHeader(amel)).send(shareBody());
    const clash = await request(app)
      .post('/api/trip-shares')
      .set(authHeader(amel))
      .send(shareBody({ startDate: day(14), endDate: day(20) }));

    expect(clash.status).toBe(409);
    expect(clash.body.message).toBe(
      'Vous partagez déjà un séjour à cette destination sur ces dates.',
    );

    // Autre destination ou autres dates : accepté.
    const other = await request(app)
      .post('/api/trip-shares')
      .set(authHeader(amel))
      .send(shareBody({ destination: String(tozeur._id) }));
    expect(other.status).toBe(201);
  });

  it('est réservé aux voyageurs connectés (401, 403)', async () => {
    expect((await request(app).post('/api/trip-shares').send(shareBody())).status).toBe(401);
    for (const user of [provider, admin]) {
      const res = await request(app)
        .post('/api/trip-shares')
        .set(authHeader(user))
        .send(shareBody());
      expect(res.status).toBe(403);
    }
  });
});

describe('US5.3 — GET /api/trip-shares/me, PUT et DELETE', () => {
  let amelShare;

  beforeEach(async () => {
    amelShare = await TripShare.create({
      user: amel._id,
      destination: djerba._id,
      startDate: utc(day(10)),
      endDate: utc(day(16)),
    });
    await TripShare.create([
      // Karim chevauche le séjour d'Amel ; Sofia part à Tozeur ; le partage terminé d'Amel est ignoré.
      { user: karim._id, destination: djerba._id, startDate: utc(day(12)), endDate: utc(day(20)) },
      { user: sofia._id, destination: tozeur._id, startDate: utc(day(10)), endDate: utc(day(16)) },
      { user: amel._id, destination: tozeur._id, startDate: utc(day(-9)), endDate: utc(day(-3)) },
    ]);
  });

  it('liste ses partages actifs avec le nombre de voyageurs qui les voient', async () => {
    const res = await request(app).get('/api/trip-shares/me').set(authHeader(amel));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(res.body.items[0]).toMatchObject({
      _id: String(amelShare._id),
      destination: { name: 'Djerba' },
      travelersCount: 1,
    });
  });

  it('modifie son partage et recalcule la date de suppression', async () => {
    const res = await request(app)
      .put(`/api/trip-shares/${amelShare._id}`)
      .set(authHeader(amel))
      .send(shareBody({ startDate: day(30), endDate: day(35), message: 'Nouvelles dates' }));

    expect(res.status).toBe(200);
    expect(res.body.tripShare).toMatchObject({
      message: 'Nouvelles dates',
      expiresAt: utc(day(36)).toISOString(),
      travelersCount: 0,
    });
  });

  it('supprime son partage (204)', async () => {
    const res = await request(app)
      .delete(`/api/trip-shares/${amelShare._id}`)
      .set(authHeader(amel));
    expect(res.status).toBe(204);
    expect(await TripShare.exists({ _id: amelShare._id })).toBeNull();
  });

  it('refuse de modifier ou supprimer le partage d’un autre (403) ; 404 et 400 sinon', async () => {
    const put = await request(app)
      .put(`/api/trip-shares/${amelShare._id}`)
      .set(authHeader(karim))
      .send(shareBody());
    expect(put.status).toBe(403);
    expect(put.body.message).toBe('Vous ne pouvez modifier que vos propres partages.');

    const del = await request(app)
      .delete(`/api/trip-shares/${amelShare._id}`)
      .set(authHeader(karim));
    expect(del.status).toBe(403);

    const unknown = await request(app)
      .delete(`/api/trip-shares/${UNKNOWN_ID}`)
      .set(authHeader(amel));
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Partage introuvable.');

    expect((await request(app).delete('/api/trip-shares/abc').set(authHeader(amel))).status).toBe(
      400,
    );
    const invalid = await request(app)
      .put(`/api/trip-shares/${amelShare._id}`)
      .set(authHeader(amel))
      .send(shareBody({ startDate: '' }));
    expect(invalid.status).toBe(400);
  });

  it('exige une session de voyageur (401, 403)', async () => {
    expect((await request(app).get('/api/trip-shares/me')).status).toBe(401);
    expect((await request(app).get('/api/trip-shares/me').set(authHeader(provider))).status).toBe(
      403,
    );
  });
});

describe('US5.4 — GET /api/trip-shares/:id/co-voyageurs', () => {
  let amelShare;

  const coUrl = (share = amelShare) => `/api/trip-shares/${share._id}/co-voyageurs`;

  beforeEach(async () => {
    amelShare = await TripShare.create({
      user: amel._id,
      destination: djerba._id,
      startDate: utc(day(10)),
      endDate: utc(day(16)),
      city: 'Tunis',
    });
    await TripShare.create([
      // Karim : 5 jours en commun (12 → 16), tout est visible sauf rien de caché.
      {
        user: karim._id,
        destination: djerba._id,
        startDate: utc(day(12)),
        endDate: utc(day(20)),
        message: 'Kayak à plusieurs ?',
        city: 'Sfax',
        languages: ['Arabe', 'Anglais'],
        visible: { profile: true, city: true, languages: true, photo: true },
      },
      // Sofia : 1 jour en commun (16), profil caché, ville et langues cachées.
      {
        user: sofia._id,
        destination: djerba._id,
        startDate: utc(day(16)),
        endDate: utc(day(18)),
        city: 'Milan',
        languages: ['Italien'],
        visible: { profile: false, city: false, languages: false, photo: false },
      },
      // Mehdi : autre destination, puis dates sans chevauchement à Djerba.
      { user: mehdi._id, destination: tozeur._id, startDate: utc(day(10)), endDate: utc(day(16)) },
      { user: mehdi._id, destination: djerba._id, startDate: utc(day(17)), endDate: utc(day(19)) },
    ]);
  });

  it('montre les voyageurs de la même destination aux dates qui se chevauchent', async () => {
    const res = await request(app).get(coUrl()).set(authHeader(amel));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 2,
      page: 1,
      pages: 1,
      destination: { name: 'Djerba' },
      languages: ['Anglais', 'Arabe'],
    });
    const [karimCard, sofiaCard] = res.body.items;
    expect(karimCard).toEqual({
      _id: expect.any(String),
      name: 'Karim T.',
      profile: 'resident',
      avatarUrl: 'https://example.com/karim.png',
      city: 'Sfax',
      languages: ['Arabe', 'Anglais'],
      startDate: utc(day(12)).toISOString(),
      endDate: utc(day(20)).toISOString(),
      message: 'Kayak à plusieurs ?',
      overlapDays: 5,
    });
    // Seuls le prénom, l'initiale et les dates sont toujours visibles.
    expect(sofiaCard).toEqual({
      _id: expect.any(String),
      name: 'Sofia R.',
      startDate: utc(day(16)).toISOString(),
      endDate: utc(day(18)).toISOString(),
      overlapDays: 1,
    });
  });

  it('n’expose jamais l’e-mail, le téléphone ni le nom complet', async () => {
    const res = await request(app).get(coUrl()).set(authHeader(amel));
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('karim@example.com');
    expect(body).not.toContain('Trabelsi');
    expect(body).not.toMatch(/email|phone/i);
    expect(body).not.toContain('Milan');
  });

  it('filtre par profil, langue et jours en commun (sur les seuls champs visibles)', async () => {
    const query = async (params) =>
      (await request(app).get(coUrl()).query(params).set(authHeader(amel))).body.items.map(
        (item) => item.name,
      );

    expect(await query({ profile: 'resident' })).toEqual(['Karim T.']);
    // Le profil de Sofia est caché : il ne sert pas au filtre.
    expect(await query({ profile: 'touriste' })).toEqual([]);
    expect(await query({ language: 'anglais' })).toEqual(['Karim T.']);
    expect(await query({ language: 'Italien' })).toEqual([]);
    expect(await query({ minDays: 3 })).toEqual(['Karim T.']);
  });

  it('pagine les résultats', async () => {
    const res = await request(app).get(coUrl()).query({ page: 2, limit: 1 }).set(authHeader(amel));
    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.items.map((item) => item.name)).toEqual(['Sofia R.']);
  });

  it('ne passe que par son propre partage actif (403)', async () => {
    const other = await request(app).get(coUrl()).set(authHeader(karim));
    expect(other.status).toBe(403);
    expect(other.body.message).toBe(
      'Les co-voyageurs ne sont visibles qu’à travers vos propres partages.',
    );

    const ended = await TripShare.create({
      user: amel._id,
      destination: tozeur._id,
      startDate: utc(day(-9)),
      endDate: utc(day(-3)),
    });
    const res = await request(app).get(coUrl(ended)).set(authHeader(amel));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'Ce partage est terminé : publiez un nouveau séjour pour voir les co-voyageurs.',
    );
  });

  it('valide les filtres (400), 404, 401 et 403 selon le cas', async () => {
    const invalid = await request(app)
      .get(coUrl())
      .query({ profile: 'pirate', minDays: 0 })
      .set(authHeader(amel));
    expect(invalid.status).toBe(400);
    expect(invalid.body.details.map((d) => d.field).sort()).toEqual(['minDays', 'profile']);

    const unknown = await request(app)
      .get(`/api/trip-shares/${UNKNOWN_ID}/co-voyageurs`)
      .set(authHeader(amel));
    expect(unknown.status).toBe(404);

    expect((await request(app).get(coUrl())).status).toBe(401);
    expect((await request(app).get(coUrl()).set(authHeader(admin))).status).toBe(403);
  });
});

describe('TripShare — suppression automatique (index TTL)', () => {
  it('expire le lendemain du retour grâce à un index TTL sur expiresAt', async () => {
    const indexes = await TripShare.collection.indexes();
    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    );
    const share = await TripShare.create({
      user: amel._id,
      destination: djerba._id,
      startDate: utc(day(1)),
      endDate: utc(day(4)),
    });
    expect(share.expiresAt.toISOString()).toBe(utc(day(5)).toISOString());
  });
});
