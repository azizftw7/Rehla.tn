import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { Destination, Favorite, Offer, Review, Service, TripShare } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

// Cloudinary simulé : aucun appel réseau, aucune clé nécessaire.
const { destroy } = vi.hoisted(() => ({ destroy: vi.fn() }));
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: { uploader: { upload_stream: vi.fn(), destroy } },
}));

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const UNKNOWN_ID = '64b7f0c2a1b2c3d4e5f60718';
const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days) => new Date(Date.now() + days * DAY_MS);
const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/rehla/services/dar.jpg';

let admin;
let amel;
let karim;
let provider;
let djerba;
let dar;

let amelReview;
let karimReview;
let share;

const get = (url, user = admin) => request(app).get(url).set(authHeader(user));
const patch = (url, body, user = admin) => request(app).patch(url).set(authHeader(user)).send(body);
const del = (url, user = admin) => request(app).delete(url).set(authHeader(user));

beforeEach(async () => {
  destroy.mockReset().mockResolvedValue({ result: 'ok' });
  admin = await createUser({ role: 'admin' });
  amel = await createUser({ name: 'Amel Trabelsi', email: 'amel@example.com' });
  karim = await createUser({ name: 'Karim Haddad', email: 'karim@example.com' });
  provider = await createUser({
    role: 'prestataire',
    name: 'Nour Ben Salem',
    provider: {
      businessName: 'Nour Évasions',
      activityType: 'hebergement',
      city: 'Djerba',
      phone: '+216 70 000 101',
      approval: 'approuve',
    },
  });
  djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  const base = {
    destination: djerba._id,
    provider: provider._id,
    location: point(10.86, 33.88),
    price: { amount: 100, unit: 'nuit' },
  };
  [dar] = await Service.create([
    { ...base, type: 'hebergement', name: 'Dar Yasmine', photos: [PHOTO] },
    { ...base, type: 'activite', name: 'Kayak', activityCategory: 'Nautique', hidden: true },
  ]);
  amelReview = await Review.create({
    service: dar._id,
    author: amel._id,
    rating: 5,
    comment: 'Superbe patio.',
  });
  karimReview = await Review.create({
    service: dar._id,
    author: karim._id,
    rating: 1,
    comment: 'Contenu insultant à modérer',
  });
  share = await TripShare.create({
    user: amel._id,
    destination: djerba._id,
    startDate: inDays(5),
    endDate: inDays(8),
    message: 'Un louage depuis Tunis ?',
  });
});

describe('US7.2 — accès réservé à l’administrateur', () => {
  const routes = [
    ['get', '/api/admin/reviews'],
    ['delete', `/api/admin/reviews/${UNKNOWN_ID}`],
    ['get', '/api/admin/services'],
    ['patch', `/api/admin/services/${UNKNOWN_ID}/visibilite`],
    ['delete', `/api/admin/services/${UNKNOWN_ID}`],
    ['get', '/api/admin/trip-shares'],
    ['delete', `/api/admin/trip-shares/${UNKNOWN_ID}`],
  ];

  it.each(routes)('%s %s : 401 sans session', async (method, url) => {
    expect((await request(app)[method](url)).status).toBe(401);
  });

  it.each(routes)('%s %s : 403 pour un voyageur ou un prestataire', async (method, url) => {
    for (const user of [amel, provider]) {
      const res = await request(app)[method](url).set(authHeader(user)).send({ hidden: true });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Accès réservé aux administrateurs.');
    }
  });
});

describe('US7.2 — GET /api/admin/stats', () => {
  it('compte aussi les avis, les partages actifs et les services masqués', async () => {
    // Partage terminé : il n'est plus compté (l'index TTL le supprimera).
    await TripShare.create({
      user: karim._id,
      destination: djerba._id,
      startDate: inDays(-9),
      endDate: inDays(-3),
    });
    const res = await get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      reviews: 2,
      tripShares: 1,
      services: { total: 2, hidden: 1, hiddenByAdmin: 0 },
    });
  });
});

describe('US7.2 — avis', () => {
  it('liste tous les avis, plus récents d’abord, avec l’auteur et le service', async () => {
    const res = await get('/api/admin/reviews');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items[0]).toMatchObject({
      _id: String(karimReview._id),
      rating: 1,
      author: { name: 'Karim Haddad', email: 'karim@example.com' },
      service: { name: 'Dar Yasmine', type: 'hebergement', hidden: false },
    });
  });

  it('cherche dans le commentaire, l’auteur et le nom du service', async () => {
    const ids = async (search) =>
      (await get(`/api/admin/reviews?search=${encodeURIComponent(search)}`)).body.items.map(
        (r) => r._id,
      );
    expect(await ids('insultant')).toEqual([String(karimReview._id)]);
    expect(await ids('amel@')).toEqual([String(amelReview._id)]);
    expect((await ids('dar yasmine')).sort()).toEqual(
      [String(amelReview._id), String(karimReview._id)].sort(),
    );
    expect(await ids('(')).toEqual([]);
  });

  it('pagine et valide la recherche (400)', async () => {
    const res = await get('/api/admin/reviews?limit=1&page=2');
    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.items).toHaveLength(1);

    const invalid = await get(`/api/admin/reviews?search=${'a'.repeat(101)}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.details).toEqual([
      { field: 'search', message: 'La recherche ne peut pas dépasser 100 caractères.' },
    ]);
  });

  it('supprime un avis et recalcule la note du service', async () => {
    expect((await Service.findById(dar._id)).ratingAverage).toBe(3);

    const res = await del(`/api/admin/reviews/${karimReview._id}`);
    expect(res.status).toBe(204);
    expect(await Review.exists({ _id: karimReview._id })).toBeNull();
    const updated = await Service.findById(dar._id);
    expect(updated.ratingAverage).toBe(5);
    expect(updated.ratingCount).toBe(1);
  });

  it('renvoie 404 pour un avis inconnu et 400 pour un identifiant invalide', async () => {
    const unknown = await del(`/api/admin/reviews/${UNKNOWN_ID}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Avis introuvable.');
    expect((await del('/api/admin/reviews/abc')).status).toBe(400);
  });
});

describe('US7.2 — services', () => {
  it('liste tous les services, masqués compris, avec le prestataire', async () => {
    const res = await get('/api/admin/services');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const item = res.body.items.find((s) => s.name === 'Dar Yasmine');
    expect(item).toMatchObject({
      hidden: false,
      destination: { name: 'Djerba' },
      provider: { name: 'Nour Ben Salem', provider: { businessName: 'Nour Évasions' } },
    });
  });

  it('filtre par visibilité, type et recherche (nom ou prestataire)', async () => {
    const names = async (query) =>
      (await get(`/api/admin/services?${query}`)).body.items.map((s) => s.name).sort();
    expect(await names('hidden=true')).toEqual(['Kayak']);
    expect(await names('type=hebergement')).toEqual(['Dar Yasmine']);
    expect(await names('search=kay')).toEqual(['Kayak']);
    expect(await names('search=évasions')).toEqual(['Dar Yasmine', 'Kayak']);

    const invalid = await get('/api/admin/services?hidden=peut-etre&type=bateau');
    expect(invalid.status).toBe(400);
    expect(invalid.body.details.map((d) => d.field).sort()).toEqual(['hidden', 'type']);
  });

  it('masque puis réaffiche un service', async () => {
    const hide = await patch(`/api/admin/services/${dar._id}/visibilite`, { hidden: true });
    expect(hide.status).toBe(200);
    // La modération utilise son propre champ : le choix du prestataire (hidden) ne change pas.
    expect(hide.body.service).toMatchObject({
      hidden: false,
      hiddenByAdmin: true,
      name: 'Dar Yasmine',
    });
    expect((await request(app).get(`/api/services/${dar._id}`)).status).toBe(404);

    const show = await patch(`/api/admin/services/${dar._id}/visibilite`, { hidden: false });
    expect(show.body.service.hiddenByAdmin).toBe(false);
    expect((await request(app).get(`/api/services/${dar._id}`)).status).toBe(200);
  });

  it('valide la visibilité (400) et renvoie 404 pour un service inconnu', async () => {
    const invalid = await patch(`/api/admin/services/${dar._id}/visibilite`, {});
    expect(invalid.status).toBe(400);
    expect(invalid.body.details[0].field).toBe('hidden');

    const unknown = await patch(`/api/admin/services/${UNKNOWN_ID}/visibilite`, { hidden: true });
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Service introuvable.');
  });

  it('supprime un service avec ses avis, offres, favoris et photos', async () => {
    await Offer.create({
      service: dar._id,
      title: 'Hiver -10 %',
      discountPercent: 10,
      startDate: inDays(-1),
      endDate: inDays(30),
    });
    await Favorite.create({ user: amel._id, service: dar._id });

    const res = await del(`/api/admin/services/${dar._id}`);
    expect(res.status).toBe(204);
    expect(await Service.exists({ _id: dar._id })).toBeNull();
    expect(await Review.countDocuments({ service: dar._id })).toBe(0);
    expect(await Offer.countDocuments({ service: dar._id })).toBe(0);
    expect(await Favorite.countDocuments({ service: dar._id })).toBe(0);
    expect(destroy).toHaveBeenCalledWith('rehla/services/dar', { resource_type: 'image' });

    expect((await del(`/api/admin/services/${dar._id}`)).status).toBe(404);
  });
});

describe('US7.2 — service masqué par la modération (hiddenByAdmin)', () => {
  const providerPatch = (service, hidden) =>
    request(app)
      .patch(`/api/provider/services/${service._id}/visibilite`)
      .set(authHeader(provider))
      .send({ hidden });

  beforeEach(async () => {
    await patch(`/api/admin/services/${dar._id}/visibilite`, { hidden: true });
  });

  it('le prestataire ne peut pas le réafficher (403), mais peut le masquer de son côté', async () => {
    const show = await providerPatch(dar, false);
    expect(show.status).toBe(403);
    expect(show.body.message).toBe(
      "Ce service a été masqué par la modération : seul l'administrateur peut le réafficher.",
    );
    expect(await Service.findById(dar._id)).toMatchObject({ hidden: false, hiddenByAdmin: true });

    const hide = await providerPatch(dar, true);
    expect(hide.status).toBe(200);
    expect(hide.body.service).toMatchObject({ hidden: true, hiddenByAdmin: true });
  });

  it('le prestataire voit le service dans « Mes services » avec hiddenByAdmin', async () => {
    const res = await request(app).get('/api/provider/services').set(authHeader(provider));
    expect(res.body.items.find((s) => s.name === 'Dar Yasmine')).toMatchObject({
      hidden: false,
      hiddenByAdmin: true,
    });
  });

  it('n’est public que si hidden et hiddenByAdmin sont faux', async () => {
    const isPublic = async () =>
      (await request(app).get(`/api/services/${dar._id}`)).status === 200;
    const listed = async () =>
      (await request(app).get('/api/services')).body.items.some((s) => s.name === 'Dar Yasmine');

    expect(await isPublic()).toBe(false);
    expect(await listed()).toBe(false);
    // Les avis d'un service non public ne sont plus consultables.
    expect((await request(app).get(`/api/services/${dar._id}/reviews`)).status).toBe(404);

    // Le prestataire l'avait aussi masqué : la levée de la modération ne le rend pas public.
    await providerPatch(dar, true);
    await patch(`/api/admin/services/${dar._id}/visibilite`, { hidden: false });
    expect(await isPublic()).toBe(false);

    await providerPatch(dar, false);
    expect(await isPublic()).toBe(true);
    expect(await listed()).toBe(true);
  });

  it('les requêtes « hidden: false » des autres modules l’excluent aussi (hook du modèle)', async () => {
    // Mêmes formes de requêtes que les favoris, les destinations et les langues des guides.
    expect(await Service.exists({ _id: dar._id, hidden: false })).toBeNull();
    expect(await Service.distinct('_id', { hidden: false })).toEqual([]);
    expect(await Service.countDocuments({ hidden: false })).toBe(0);
    // Une requête qui précise hiddenByAdmin n'est pas modifiée.
    expect(await Service.countDocuments({ hidden: false, hiddenByAdmin: true })).toBe(1);
  });

  it('l’administration le compte et le filtre comme non public', async () => {
    const stats = await get('/api/admin/stats');
    expect(stats.body.services).toEqual({ total: 2, hidden: 2, hiddenByAdmin: 1 });

    const names = async (query) =>
      (await get(`/api/admin/services?${query}`)).body.items.map((s) => s.name).sort();
    expect(await names('hidden=true')).toEqual(['Dar Yasmine', 'Kayak']);
    expect(await names('hidden=false')).toEqual([]);
    expect(await names('hidden=true&search=dar')).toEqual(['Dar Yasmine']);
  });
});

describe('US7.2 — partages de voyage', () => {
  it('liste les partages avec le voyageur et la destination, et cherche', async () => {
    const res = await get('/api/admin/trip-shares');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, pages: 1 });
    expect(res.body.items[0]).toMatchObject({
      message: 'Un louage depuis Tunis ?',
      user: { name: 'Amel Trabelsi', email: 'amel@example.com' },
      destination: { name: 'Djerba' },
    });

    expect((await get('/api/admin/trip-shares?search=djerba')).body.total).toBe(1);
    expect((await get('/api/admin/trip-shares?search=louage')).body.total).toBe(1);
    expect((await get('/api/admin/trip-shares?search=karim')).body.total).toBe(0);
  });

  it('supprime un partage (204), puis 404', async () => {
    const res = await del(`/api/admin/trip-shares/${share._id}`);
    expect(res.status).toBe(204);
    expect(await TripShare.exists({ _id: share._id })).toBeNull();

    const again = await del(`/api/admin/trip-shares/${share._id}`);
    expect(again.status).toBe(404);
    expect(again.body.message).toBe('Partage introuvable.');
    expect((await del('/api/admin/trip-shares/abc')).status).toBe(400);
  });
});
