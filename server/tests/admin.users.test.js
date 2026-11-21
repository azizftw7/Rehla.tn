import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import {
  Destination,
  Favorite,
  Offer,
  Review,
  Service,
  TripShare,
  User,
} from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

// Cloudinary simulé : aucun appel réseau, aucune clé nécessaire.
const { destroy } = vi.hoisted(() => ({ destroy: vi.fn() }));
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: { uploader: { upload_stream: vi.fn(), destroy } },
}));

const PROVIDER_INFO = {
  businessName: 'Dar Yasmine',
  activityType: 'hebergement',
  city: 'Sfax',
  phone: '+216 70 000 303',
};

const pendingProvider = (overrides = {}) =>
  createUser({
    role: 'prestataire',
    provider: { ...PROVIDER_INFO, approval: 'en_attente' },
    ...overrides,
  });

let admin;

beforeEach(async () => {
  destroy.mockReset().mockResolvedValue({ result: 'ok' });
  admin = await createUser({ role: 'admin', name: 'Admin Rehla' });
});

const get = (url, user = admin) => request(app).get(url).set(authHeader(user));
const patch = (url, body, user = admin) => request(app).patch(url).set(authHeader(user)).send(body);
const del = (url, user = admin) => request(app).delete(url).set(authHeader(user));

describe('US7.1 — accès à /api/admin', () => {
  it('401 sans token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it.each(['voyageur', 'prestataire'])('403 pour un compte %s', async (role) => {
    const user = await createUser({ role });
    const res = await get('/api/admin/users', user);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Accès réservé aux administrateurs.');
  });
});

describe('US7.1 — GET /api/admin/stats', () => {
  it('compte les comptes par rôle, les suspendus et les demandes en attente', async () => {
    await createUser({ role: 'voyageur' });
    await createUser({ role: 'voyageur', status: 'suspendu' });
    await createUser({ role: 'prestataire' });
    await pendingProvider();
    await pendingProvider();

    const res = await get('/api/admin/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      users: { voyageur: 2, prestataire: 3, admin: 1, total: 6 },
      suspended: 1,
      pendingProviders: 2,
    });
  });
});

describe('US7.1 — GET /api/admin/users', () => {
  it('liste paginée, plus récents d’abord, sans mot de passe', async () => {
    const first = await createUser({ name: 'Amel Trabelsi' });
    const second = await createUser({ name: 'Youssef Haddad' });

    const res = await get('/api/admin/users?limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 3, page: 1, pages: 2 });
    expect(res.body.items.map((u) => u._id)).toEqual([String(second._id), String(first._id)]);
    expect(res.body.items[0]).not.toHaveProperty('password');
  });

  it('filtre par rôle, statut et validation', async () => {
    const traveler = await createUser({ role: 'voyageur' });
    const suspended = await createUser({ role: 'voyageur', status: 'suspendu' });
    const approved = await createUser({ role: 'prestataire' });
    const pending = await pendingProvider();
    const rejected = await createUser({
      role: 'prestataire',
      provider: { ...PROVIDER_INFO, approval: 'refuse' },
    });

    const ids = async (query) =>
      (await get(`/api/admin/users?${query}`)).body.items.map((u) => u._id).sort();
    const sorted = (...users) => users.map((u) => String(u._id)).sort();

    expect(await ids('role=voyageur')).toEqual(sorted(traveler, suspended));
    expect(await ids('status=suspendu')).toEqual(sorted(suspended));
    expect(await ids('role=prestataire')).toEqual(sorted(approved, pending, rejected));
    expect(await ids('approval=en_attente')).toEqual(sorted(pending));
    expect(await ids('approval=refuse')).toEqual(sorted(rejected));
    expect(await ids('role=voyageur&approval=en_attente')).toEqual([]);
    // Un filtre vide est ignoré.
    expect(await ids('role=&status=')).toHaveLength(6);
  });

  it('compte comme « en attente » un prestataire inscrit avant la validation', async () => {
    const legacy = await pendingProvider();
    await User.collection.updateOne({ _id: legacy._id }, { $unset: { 'provider.approval': '' } });

    const res = await get('/api/admin/users?approval=en_attente');
    expect(res.body.items.map((u) => u._id)).toEqual([String(legacy._id)]);
    expect((await get('/api/admin/stats')).body.pendingProviders).toBe(1);
  });

  it('recherche sur le nom, l’e-mail et le nom commercial (sans tenir compte de la casse)', async () => {
    const amel = await createUser({ name: 'Amel Trabelsi' });
    const claire = await createUser({ email: 'claire.martin@example.com' });
    const dar = await pendingProvider();

    const search = async (term) =>
      (await get(`/api/admin/users?search=${encodeURIComponent(term)}`)).body.items.map(
        (u) => u._id,
      );

    expect(await search('trabelsi')).toEqual([String(amel._id)]);
    expect(await search('CLAIRE.martin')).toEqual([String(claire._id)]);
    expect(await search('yasmine')).toEqual([String(dar._id)]);
    // Les caractères spéciaux sont recherchés tels quels.
    expect(await search('.*')).toEqual([]);
  });

  it('400 pour un filtre invalide', async () => {
    const res = await get('/api/admin/users?role=pirate&approval=peut-etre');
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['role', 'approval']);
  });
});

describe('US7.1 — GET /api/admin/users/:id', () => {
  it('renvoie le détail d’un compte, sans mot de passe', async () => {
    const provider = await pendingProvider({ name: 'Sami Gharbi' });

    const res = await get(`/api/admin/users/${provider._id}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Sami Gharbi',
      role: 'prestataire',
      provider: { ...PROVIDER_INFO, approval: 'en_attente' },
    });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('404 pour un compte inexistant, 400 pour un identifiant invalide', async () => {
    expect((await get('/api/admin/users/64b000000000000000000000')).status).toBe(404);
    const res = await get('/api/admin/users/abc');
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe("Identifiant d'utilisateur invalide.");
  });
});

describe('US7.1 — PATCH /api/admin/users/:id/statut', () => {
  it('suspend un compte : il ne peut plus se connecter ni utiliser son token', async () => {
    const traveler = await createUser({ email: 'amel@example.com' });

    const res = await patch(`/api/admin/users/${traveler._id}/statut`, { status: 'suspendu' });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('suspendu');

    const me = await get('/api/users/me', traveler);
    expect(me.status).toBe(403);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'amel@example.com', password: 'motdepasse1' });
    expect(login.status).toBe(403);
  });

  it('réactive un compte suspendu', async () => {
    const traveler = await createUser({ status: 'suspendu' });

    const res = await patch(`/api/admin/users/${traveler._id}/statut`, { status: 'actif' });

    expect(res.status).toBe(200);
    expect((await User.findById(traveler._id)).status).toBe('actif');
    expect((await get('/api/users/me', traveler)).status).toBe(200);
  });

  it('400 pour un statut absent ou invalide', async () => {
    const traveler = await createUser();
    const missing = await patch(`/api/admin/users/${traveler._id}/statut`, {});
    expect(missing.body.details[0].message).toBe('Le statut est obligatoire (actif ou suspendu).');
    const invalid = await patch(`/api/admin/users/${traveler._id}/statut`, { status: 'banni' });
    expect(invalid.status).toBe(400);
  });
});

describe('US7.1 — validation des prestataires', () => {
  it('l’inscription crée une demande « en attente » (approval envoyé par le client ignoré)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sami Gharbi',
        email: 'sami@example.com',
        password: 'motdepasse1',
        role: 'prestataire',
        provider: { ...PROVIDER_INFO, approval: 'approuve' },
      });

    expect(res.status).toBe(201);
    expect(res.body.user.provider.approval).toBe('en_attente');
  });

  it('un prestataire en attente se connecte mais reçoit 403 sur /api/provider', async () => {
    const provider = await pendingProvider({ email: 'sami@example.com' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sami@example.com', password: 'motdepasse1' });
    expect(login.status).toBe(200);

    const res = await get('/api/provider/services', provider);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Votre compte prestataire est en attente de validation par l'administrateur.",
    );
  });

  it('approuve une demande : l’espace prestataire s’ouvre (200)', async () => {
    const provider = await pendingProvider();

    const res = await patch(`/api/admin/users/${provider._id}/validation`, {
      decision: 'approuve',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.provider.approval).toBe('approuve');
    expect(new Date(res.body.user.provider.reviewedAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect((await get('/api/provider/services', provider)).status).toBe(200);
  });

  it('refuse une demande avec un motif : 403 « refusé » et motif visible par le prestataire', async () => {
    const provider = await pendingProvider();

    const res = await patch(`/api/admin/users/${provider._id}/validation`, {
      decision: 'refuse',
      reason: '  Numéro de téléphone injoignable.  ',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.provider).toMatchObject({
      approval: 'refuse',
      rejectionReason: 'Numéro de téléphone injoignable.',
    });

    const blocked = await get('/api/provider/services', provider);
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe(
      "Votre compte prestataire a été refusé par l'administrateur.",
    );
    const me = await get('/api/users/me', provider);
    expect(me.body.user.provider.rejectionReason).toBe('Numéro de téléphone injoignable.');
  });

  it('refuse sans motif, puis approuve : le motif précédent est effacé', async () => {
    const provider = await pendingProvider();
    const url = `/api/admin/users/${provider._id}/validation`;

    await patch(url, { decision: 'refuse', reason: 'Informations incomplètes.' });
    const res = await patch(url, { decision: 'approuve', reason: 'ignoré' });

    expect(res.body.user.provider.approval).toBe('approuve');
    expect(res.body.user.provider).not.toHaveProperty('rejectionReason');
  });

  it('400 si le compte n’est pas prestataire, ou si la décision / le motif sont invalides', async () => {
    const traveler = await createUser();
    const notProvider = await patch(`/api/admin/users/${traveler._id}/validation`, {
      decision: 'approuve',
    });
    expect(notProvider.status).toBe(400);
    expect(notProvider.body.message).toBe("Ce compte n'est pas un compte prestataire.");

    const provider = await pendingProvider();
    const invalid = await patch(`/api/admin/users/${provider._id}/validation`, {
      decision: 'peut-etre',
      reason: 'x'.repeat(301),
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.details).toEqual([
      { field: 'decision', message: 'Décision invalide : choisissez approuve ou refuse.' },
      { field: 'reason', message: 'Le motif ne peut pas dépasser 300 caractères.' },
    ]);
  });
});

describe('US7.1 — un admin ne touche ni à son compte ni à celui d’un autre admin', () => {
  it.each([
    ['suspendre', (id) => patch(`/api/admin/users/${id}/statut`, { status: 'suspendu' })],
    ['supprimer', (id) => del(`/api/admin/users/${id}`)],
  ])('ne peut pas %s son propre compte', async (action, call) => {
    const res = await call(admin._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Vous ne pouvez pas ${action} votre propre compte.`);
    expect(await User.findById(admin._id)).toMatchObject({ status: 'actif' });
  });

  it.each([
    ['suspendre', (id) => patch(`/api/admin/users/${id}/statut`, { status: 'suspendu' })],
    ['réactiver', (id) => patch(`/api/admin/users/${id}/statut`, { status: 'actif' })],
    ['valider', (id) => patch(`/api/admin/users/${id}/validation`, { decision: 'approuve' })],
    ['supprimer', (id) => del(`/api/admin/users/${id}`)],
  ])('ne peut pas %s le compte d’un autre administrateur', async (action, call) => {
    const other = await createUser({ role: 'admin' });
    const res = await call(other._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      `Vous ne pouvez pas ${action} le compte d'un autre administrateur.`,
    );
    expect(await User.exists({ _id: other._id })).toBeTruthy();
  });
});

describe('US7.1 — DELETE /api/admin/users/:id', () => {
  it('supprime un prestataire avec ses services, photos, offres, avis et favoris', async () => {
    const destination = await Destination.create({
      name: 'Djerba',
      region: 'Médenine',
      location: { type: 'Point', coordinates: [10.8575, 33.8758] },
    });
    const provider = await createUser({ role: 'prestataire' });
    const otherProvider = await createUser({ role: 'prestataire' });
    const traveler = await createUser();
    const serviceData = {
      type: 'restaurant',
      cuisine: 'Tunisienne',
      free: true,
      destination: destination._id,
      location: { type: 'Point', coordinates: [10.86, 33.87] },
    };
    const own = await Service.create({
      ...serviceData,
      name: 'Café des Palmiers',
      provider: provider._id,
      photos: [
        'https://res.cloudinary.com/demo/image/upload/v1/rehla/services/cafe.png',
        'https://images.example.com/seed.jpg',
      ],
    });
    const kept = await Service.create({
      ...serviceData,
      name: 'Autre adresse',
      provider: otherProvider._id,
    });
    const today = new Date();
    await Offer.create({
      service: own._id,
      title: 'Thé offert',
      discountPercent: 10,
      startDate: today,
      endDate: today,
    });
    await Review.create({ service: own._id, author: traveler._id, rating: 5 });
    await Favorite.create({ service: own._id, user: traveler._id });
    await Favorite.create({ service: kept._id, user: traveler._id });

    const res = await del(`/api/admin/users/${provider._id}`);

    expect(res.status).toBe(204);
    expect(await User.exists({ _id: provider._id })).toBeNull();
    expect(await Service.find().distinct('_id')).toEqual([kept._id]);
    expect(await Offer.countDocuments()).toBe(0);
    expect(await Review.countDocuments()).toBe(0);
    expect(await Favorite.find().distinct('service')).toEqual([kept._id]);
    // Seule la photo envoyée sur Cloudinary par Rehla.tn est supprimée.
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledWith('rehla/services/cafe', { resource_type: 'image' });
  });

  it('supprime un voyageur avec ses avis, favoris et partages, et recalcule les notes', async () => {
    const destination = await Destination.create({
      name: 'Tozeur',
      region: 'Tozeur',
      location: { type: 'Point', coordinates: [8.1336, 33.9197] },
    });
    const provider = await createUser({ role: 'prestataire' });
    const service = await Service.create({
      type: 'activite',
      activityCategory: 'Désert',
      free: true,
      name: 'Balade dans les dunes',
      destination: destination._id,
      location: { type: 'Point', coordinates: [8.13, 33.92] },
      provider: provider._id,
    });
    const traveler = await createUser();
    const other = await createUser();
    await Review.create({ service: service._id, author: traveler._id, rating: 1 });
    await Review.create({ service: service._id, author: other._id, rating: 5 });
    await Favorite.create({ service: service._id, user: traveler._id });
    await TripShare.create({
      user: traveler._id,
      destination: destination._id,
      startDate: new Date('2027-07-01'),
      endDate: new Date('2027-07-10'),
    });

    const res = await del(`/api/admin/users/${traveler._id}`);

    expect(res.status).toBe(204);
    expect(await Review.countDocuments()).toBe(1);
    expect(await Favorite.countDocuments()).toBe(0);
    expect(await TripShare.countDocuments()).toBe(0);
    expect(await Service.findById(service._id)).toMatchObject({
      ratingAverage: 5,
      ratingCount: 1,
    });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('404 pour un compte inexistant', async () => {
    const res = await del('/api/admin/users/64b000000000000000000000');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Utilisateur introuvable.');
  });
});
