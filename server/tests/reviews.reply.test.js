import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Review, Service } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const UNKNOWN_ID = '64b7f0c2a1b2c3d4e5f60718';

let provider;
let otherProvider;
let pendingProvider;
let amel;
let karim;
let admin;
let dar;
let felouque;
let otherService;
let amelReview;
let karimReview;
let otherReview;

const replyUrl = (id = amelReview._id) => `/api/provider/reviews/${id}/reply`;

beforeEach(async () => {
  const djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  provider = await createUser({ role: 'prestataire' });
  otherProvider = await createUser({ role: 'prestataire' });
  pendingProvider = await createUser({
    role: 'prestataire',
    provider: {
      businessName: 'En attente',
      activityType: 'hebergement',
      city: 'Sfax',
      phone: '+216 70 000 001',
      approval: 'en_attente',
    },
  });
  amel = await createUser({ name: 'Amel Ben Salah', email: 'amel@example.com' });
  karim = await createUser({ name: 'Karim Trabelsi' });
  admin = await createUser({ role: 'admin' });

  const base = {
    type: 'hebergement',
    destination: djerba._id,
    location: point(10.86, 33.88),
    price: { amount: 120, unit: 'nuit' },
  };
  [dar, felouque, otherService] = await Service.create([
    { ...base, name: 'Dar Yasmine', provider: provider._id },
    { ...base, name: 'Felouque masquée', provider: provider._id, hidden: true },
    { ...base, name: 'Hôtel voisin', provider: otherProvider._id },
  ]);

  amelReview = await Review.create({
    service: dar._id,
    author: amel._id,
    rating: 5,
    comment: 'Superbe.',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
  });
  karimReview = await Review.create({
    service: felouque._id,
    author: karim._id,
    rating: 3,
    providerReply: { text: 'Merci Karim.', repliedAt: new Date('2026-10-05T10:00:00Z') },
  });
  otherReview = await Review.create({ service: otherService._id, author: amel._id, rating: 2 });
});

describe('US6.4 — GET /api/provider/reviews (avis reçus)', () => {
  it('liste les avis de ses services seulement (masqués compris), avec le nom du service', async () => {
    const res = await request(app).get('/api/provider/reviews').set(authHeader(provider));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1, unansweredCount: 1 });
    const names = res.body.items.map((r) => r.service.name).sort();
    expect(names).toEqual(['Dar Yasmine', 'Felouque masquée']);
    expect(res.body.items.map((r) => r._id)).not.toContain(String(otherReview._id));

    const amelItem = res.body.items.find((r) => r._id === String(amelReview._id));
    expect(amelItem.author).toMatchObject({ name: 'Amel B.' });
    expect(JSON.stringify(res.body)).not.toContain('amel@example.com');
  });

  it('filtre les avis sans réponse et par service', async () => {
    const unanswered = await request(app)
      .get('/api/provider/reviews')
      .query({ unanswered: 'true' })
      .set(authHeader(provider));
    expect(unanswered.body.total).toBe(1);
    expect(unanswered.body.items[0]._id).toBe(String(amelReview._id));

    const byService = await request(app)
      .get('/api/provider/reviews')
      .query({ service: String(felouque._id) })
      .set(authHeader(provider));
    expect(byService.body.total).toBe(1);
    expect(byService.body.items[0]._id).toBe(String(karimReview._id));
    expect(byService.body.unansweredCount).toBe(0);
  });

  it('pagine la liste', async () => {
    const res = await request(app)
      .get('/api/provider/reviews')
      .query({ page: 2, limit: 1 })
      .set(authHeader(provider));
    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.items).toHaveLength(1);
  });

  it('renvoie 404 pour le service d’un autre prestataire et 400 pour un filtre invalide', async () => {
    const other = await request(app)
      .get('/api/provider/reviews')
      .query({ service: String(otherService._id) })
      .set(authHeader(provider));
    expect(other.status).toBe(404);

    const invalid = await request(app)
      .get('/api/provider/reviews')
      .query({ unanswered: 'peut-être', service: 'abc' })
      .set(authHeader(provider));
    expect(invalid.status).toBe(400);
    expect(invalid.body.details.map((d) => d.field).sort()).toEqual(['service', 'unanswered']);
  });

  it('est réservé aux prestataires approuvés (401, 403)', async () => {
    expect((await request(app).get('/api/provider/reviews')).status).toBe(401);
    for (const user of [amel, admin, pendingProvider]) {
      const res = await request(app).get('/api/provider/reviews').set(authHeader(user));
      expect(res.status).toBe(403);
    }
  });
});

describe('US6.4 — POST /api/provider/reviews/:id/reply', () => {
  it('enregistre la réponse sans marquer l’avis comme modifié (201)', async () => {
    const res = await request(app)
      .post(replyUrl())
      .set(authHeader(provider))
      .send({ text: '  Merci Amel, à bientôt !  ' });

    expect(res.status).toBe(201);
    expect(res.body.review.providerReply.text).toBe('Merci Amel, à bientôt !');
    expect(res.body.review.providerReply.repliedAt).toBeDefined();
    expect(res.body.review.service).toEqual({
      _id: String(dar._id),
      name: 'Dar Yasmine',
      hidden: false,
    });

    const saved = await Review.findById(amelReview._id);
    expect(saved.updatedAt.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(saved.rating).toBe(5);

    // La réponse est visible sous l'avis, sur la fiche publique du service.
    const list = await request(app).get(`/api/services/${dar._id}/reviews`);
    expect(list.body.items[0].providerReply.text).toBe('Merci Amel, à bientôt !');
    expect(list.body.summary).toMatchObject({ average: 5, count: 1 });
  });

  it('refuse une seconde réponse (409)', async () => {
    const res = await request(app)
      .post(replyUrl(karimReview._id))
      .set(authHeader(provider))
      .send({ text: 'Encore merci.' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      'Vous avez déjà répondu à cet avis. Modifiez votre réponse si besoin.',
    );
  });

  it('valide le texte (400, messages en français)', async () => {
    const cases = [
      [{}, 'Écrivez votre réponse.'],
      [{ text: '   ' }, 'Écrivez votre réponse.'],
      [{ text: 'a'.repeat(1001) }, 'La réponse ne peut pas dépasser 1000 caractères.'],
    ];
    for (const [body, message] of cases) {
      const res = await request(app).post(replyUrl()).set(authHeader(provider)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([{ field: 'text', message }]);
    }
    expect((await request(app).post(replyUrl('abc')).set(authHeader(provider))).status).toBe(400);
  });

  it('refuse de répondre aux avis des services d’un autre prestataire (403)', async () => {
    const res = await request(app)
      .post(replyUrl(otherReview._id))
      .set(authHeader(provider))
      .send({ text: 'Merci.' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Vous ne pouvez répondre qu’aux avis laissés sur vos services.');
  });

  it('renvoie 404 pour un avis inexistant, 401 sans session, 403 pour un voyageur', async () => {
    const unknown = await request(app)
      .post(replyUrl(UNKNOWN_ID))
      .set(authHeader(provider))
      .send({ text: 'Merci.' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Avis introuvable.');

    expect((await request(app).post(replyUrl()).send({ text: 'Merci.' })).status).toBe(401);
    const traveler = await request(app)
      .post(replyUrl())
      .set(authHeader(amel))
      .send({ text: 'Merci.' });
    expect(traveler.status).toBe(403);
  });
});

describe('US6.4 — PATCH et DELETE /api/provider/reviews/:id/reply', () => {
  it('modifie la réponse', async () => {
    const res = await request(app)
      .patch(replyUrl(karimReview._id))
      .set(authHeader(provider))
      .send({ text: 'Merci Karim, nous avons changé la literie.' });

    expect(res.status).toBe(200);
    expect(res.body.review.providerReply.text).toBe('Merci Karim, nous avons changé la literie.');
    expect(new Date(res.body.review.providerReply.repliedAt).getTime()).toBeGreaterThan(
      new Date('2026-10-05T10:00:00Z').getTime(),
    );
  });

  it('supprime la réponse (204) : l’avis redevient « sans réponse »', async () => {
    const res = await request(app).delete(replyUrl(karimReview._id)).set(authHeader(provider));
    expect(res.status).toBe(204);

    const saved = await Review.findById(karimReview._id);
    expect(saved.providerReply?.text).toBeUndefined();
    expect(saved.rating).toBe(3);

    const list = await request(app)
      .get('/api/provider/reviews')
      .query({ unanswered: 'true' })
      .set(authHeader(provider));
    expect(list.body.total).toBe(2);
  });

  it('renvoie 404 s’il n’y a pas encore de réponse', async () => {
    const patch = await request(app)
      .patch(replyUrl())
      .set(authHeader(provider))
      .send({ text: 'Merci.' });
    expect(patch.status).toBe(404);
    expect(patch.body.message).toBe('Vous n’avez pas encore répondu à cet avis.');

    expect((await request(app).delete(replyUrl()).set(authHeader(provider))).status).toBe(404);
  });

  it('refuse à un autre prestataire (403) et valide le texte (400)', async () => {
    const other = await request(app)
      .delete(replyUrl(karimReview._id))
      .set(authHeader(otherProvider));
    expect(other.status).toBe(403);

    const invalid = await request(app)
      .patch(replyUrl(karimReview._id))
      .set(authHeader(provider))
      .send({ text: '' });
    expect(invalid.status).toBe(400);
  });
});
