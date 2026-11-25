import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Favorite, Service } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const UNKNOWN_ID = '64b7f0c2a1b2c3d4e5f60718';

let amel;
let karim;
let provider;
let admin;
let dar;
let kayak;
let hidden;

beforeEach(async () => {
  const djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  amel = await createUser({ name: 'Amel Ben Salah' });
  karim = await createUser({ name: 'Karim Trabelsi' });
  provider = await createUser({ role: 'prestataire' });
  admin = await createUser({ role: 'admin' });

  const base = {
    destination: djerba._id,
    provider: provider._id,
    location: point(10.86, 33.88),
    price: { amount: 50, unit: 'personne' },
  };
  [dar, kayak, hidden] = await Service.create([
    { ...base, type: 'hebergement', name: 'Dar Yasmine' },
    { ...base, type: 'activite', name: 'Kayak', activityCategory: 'Nautique' },
    { ...base, type: 'restaurant', name: 'Restaurant masqué', cuisine: 'Tunisienne', hidden: true },
  ]);
});

describe('US5.1 — POST /api/favorites', () => {
  it('ajoute un service aux favoris (201)', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .set(authHeader(amel))
      .send({ serviceId: String(dar._id) });

    expect(res.status).toBe(201);
    expect(res.body.favorite).toMatchObject({ service: String(dar._id), user: String(amel._id) });
    expect(await Favorite.countDocuments({ user: amel._id })).toBe(1);
  });

  it('refuse un doublon (409)', async () => {
    await Favorite.create({ user: amel._id, service: dar._id });
    const res = await request(app)
      .post('/api/favorites')
      .set(authHeader(amel))
      .send({ serviceId: String(dar._id) });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Ce service est déjà dans vos favoris.');
  });

  it('renvoie 404 pour un service masqué ou inexistant', async () => {
    for (const id of [hidden._id, UNKNOWN_ID]) {
      const res = await request(app)
        .post('/api/favorites')
        .set(authHeader(amel))
        .send({ serviceId: String(id) });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Service introuvable.');
    }
  });

  it('valide l’identifiant (400, messages en français)', async () => {
    const cases = [
      [{}, 'Indiquez le service à ajouter aux favoris.'],
      [{ serviceId: 'abc' }, 'Identifiant de service invalide.'],
    ];
    for (const [body, message] of cases) {
      const res = await request(app).post('/api/favorites').set(authHeader(amel)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([{ field: 'serviceId', message }]);
    }
  });

  it('est réservé aux voyageurs connectés (401, 403)', async () => {
    const body = { serviceId: String(dar._id) };
    expect((await request(app).post('/api/favorites').send(body)).status).toBe(401);
    for (const user of [provider, admin]) {
      const res = await request(app).post('/api/favorites').set(authHeader(user)).send(body);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Accès réservé aux voyageurs.');
    }
  });
});

describe('US5.1 — GET /api/favorites et /api/favorites/ids', () => {
  beforeEach(async () => {
    // Créés un par un : le plus récent apparaît en premier.
    await Favorite.create({ user: amel._id, service: dar._id });
    await Favorite.create({ user: amel._id, service: kayak._id });
    await Favorite.create({ user: amel._id, service: hidden._id });
    await Favorite.create({ user: karim._id, service: dar._id });
  });

  it('liste ses favoris visibles, plus récents d’abord, avec le service et sa destination', async () => {
    const res = await request(app).get('/api/favorites').set(authHeader(amel));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items.map((f) => f.service.name)).toEqual(['Kayak', 'Dar Yasmine']);
    expect(res.body.items[0].service.destination).toMatchObject({ name: 'Djerba', slug: 'djerba' });
  });

  it('pagine la liste', async () => {
    const res = await request(app)
      .get('/api/favorites')
      .query({ page: 2, limit: 1 })
      .set(authHeader(amel));

    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.items.map((f) => f.service.name)).toEqual(['Dar Yasmine']);
  });

  it('ne montre plus un service masqué puis le montre de nouveau s’il est réaffiché', async () => {
    const before = await request(app).get('/api/favorites/ids').set(authHeader(amel));
    expect(before.body.ids.sort()).toEqual([String(dar._id), String(kayak._id)].sort());

    await Service.updateOne({ _id: hidden._id }, { hidden: false });
    const after = await request(app).get('/api/favorites/ids').set(authHeader(amel));
    expect(after.body.ids).toContain(String(hidden._id));
  });

  it('ne montre plus un service supprimé', async () => {
    await Service.deleteOne({ _id: kayak._id });
    const res = await request(app).get('/api/favorites').set(authHeader(amel));
    expect(res.body.items.map((f) => f.service.name)).toEqual(['Dar Yasmine']);
  });

  it('renvoie une liste vide pour un voyageur sans favori', async () => {
    const other = await createUser();
    const res = await request(app).get('/api/favorites').set(authHeader(other));
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });

  it('valide la pagination (400) et refuse les autres rôles (401, 403)', async () => {
    const invalid = await request(app)
      .get('/api/favorites')
      .query({ page: 0 })
      .set(authHeader(amel));
    expect(invalid.status).toBe(400);
    expect(invalid.body.details[0].field).toBe('page');

    expect((await request(app).get('/api/favorites')).status).toBe(401);
    expect((await request(app).get('/api/favorites/ids')).status).toBe(401);
    expect((await request(app).get('/api/favorites').set(authHeader(provider))).status).toBe(403);
  });
});

describe('US5.1 — DELETE /api/favorites/:serviceId', () => {
  it('retire le service de ses favoris (204), sans toucher à ceux des autres', async () => {
    await Favorite.create({ user: amel._id, service: dar._id });
    await Favorite.create({ user: karim._id, service: dar._id });

    const res = await request(app).delete(`/api/favorites/${dar._id}`).set(authHeader(amel));

    expect(res.status).toBe(204);
    expect(await Favorite.countDocuments({ user: amel._id })).toBe(0);
    expect(await Favorite.countDocuments({ user: karim._id })).toBe(1);
  });

  it('renvoie 404 si le service n’est pas dans ses favoris, 400 si l’identifiant est invalide', async () => {
    await Favorite.create({ user: karim._id, service: dar._id });
    const res = await request(app).delete(`/api/favorites/${dar._id}`).set(authHeader(amel));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Ce service n'est pas dans vos favoris.");

    expect((await request(app).delete('/api/favorites/abc').set(authHeader(amel))).status).toBe(
      400,
    );
  });

  it('refuse sans session (401) ou pour un prestataire (403)', async () => {
    expect((await request(app).delete(`/api/favorites/${dar._id}`)).status).toBe(401);
    const res = await request(app).delete(`/api/favorites/${dar._id}`).set(authHeader(provider));
    expect(res.status).toBe(403);
  });
});
