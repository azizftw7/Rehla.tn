import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Review, Service } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const UNKNOWN_ID = '64b7f0c2a1b2c3d4e5f60718';

let service;
let hiddenService;
let provider;
let amel;
let karim;
let admin;

const reviewsUrl = (id = service._id) => `/api/services/${id}/reviews`;
const rating = async () => {
  const fresh = await Service.findById(service._id);
  return { average: fresh.ratingAverage, count: fresh.ratingCount };
};

beforeEach(async () => {
  const djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  provider = await createUser({ role: 'prestataire' });
  amel = await createUser({
    name: 'Amel Ben Salah',
    email: 'amel@example.com',
    profile: 'etudiant',
  });
  karim = await createUser({ name: 'Karim Trabelsi', profile: 'touriste' });
  admin = await createUser({ role: 'admin' });

  const base = {
    type: 'hebergement',
    destination: djerba._id,
    provider: provider._id,
    location: point(10.86, 33.88),
    price: { amount: 120, unit: 'nuit' },
  };
  [service, hiddenService] = await Service.create([
    { ...base, name: 'Dar Yasmine' },
    { ...base, name: 'Dar masqué', hidden: true },
  ]);
});

describe('US3.5 — GET /api/services/:id/reviews (liste publique)', () => {
  beforeEach(async () => {
    // Créés un par un : l'ordre de création fixe l'ordre d'affichage (plus récent d'abord).
    await Review.create({ service: service._id, author: amel._id, rating: 5, comment: 'Superbe.' });
    await Review.create({ service: service._id, author: karim._id, rating: 4 });
  });

  it('liste les avis, plus récents d’abord, avec le résumé des notes', async () => {
    const res = await request(app).get(reviewsUrl());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items.map((r) => r.rating)).toEqual([4, 5]);
    expect(res.body.summary).toEqual({
      average: 4.5,
      count: 2,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
  });

  it('n’affiche de l’auteur que son prénom, son initiale et son profil', async () => {
    const res = await request(app).get(reviewsUrl());
    const amelReview = res.body.items.find((r) => r.rating === 5);

    expect(amelReview.author).toEqual({
      _id: String(amel._id),
      name: 'Amel B.',
      profile: 'etudiant',
    });
    expect(JSON.stringify(res.body)).not.toContain('amel@example.com');
    expect(JSON.stringify(res.body)).not.toContain('Ben Salah');
  });

  it('pagine les avis', async () => {
    const res = await request(app).get(reviewsUrl()).query({ page: 2, limit: 1 });

    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].rating).toBe(5);
  });

  it('renvoie 404 pour un service masqué ou inexistant', async () => {
    for (const id of [hiddenService._id, UNKNOWN_ID]) {
      const res = await request(app).get(reviewsUrl(id));
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Service introuvable.');
    }
  });

  it('renvoie 400 si l’identifiant ou la pagination sont invalides', async () => {
    expect((await request(app).get(reviewsUrl('abc'))).status).toBe(400);

    const res = await request(app).get(reviewsUrl()).query({ limit: 500 });
    expect(res.status).toBe(400);
    expect(res.body.details[0]).toEqual({
      field: 'limit',
      message: 'La limite ne peut pas dépasser 100.',
    });
  });
});

describe('US3.5 — POST /api/services/:id/reviews', () => {
  it('publie l’avis du voyageur et recalcule la note du service (201)', async () => {
    const res = await request(app)
      .post(reviewsUrl())
      .set(authHeader(amel))
      .send({ rating: 4, comment: '  Très calme, bon accueil.  ' });

    expect(res.status).toBe(201);
    expect(res.body.review).toMatchObject({
      rating: 4,
      comment: 'Très calme, bon accueil.',
      service: String(service._id),
      author: { name: 'Amel B.', profile: 'etudiant' },
    });
    expect(await rating()).toEqual({ average: 4, count: 1 });

    await request(app).post(reviewsUrl()).set(authHeader(karim)).send({ rating: 3 });
    expect(await rating()).toEqual({ average: 3.5, count: 2 });
  });

  it('accepte un avis sans commentaire', async () => {
    const res = await request(app).post(reviewsUrl()).set(authHeader(amel)).send({ rating: 5 });

    expect(res.status).toBe(201);
    expect(res.body.review.comment).toBeUndefined();
  });

  it('refuse un second avis sur le même service (409)', async () => {
    await request(app).post(reviewsUrl()).set(authHeader(amel)).send({ rating: 5 });
    const res = await request(app).post(reviewsUrl()).set(authHeader(amel)).send({ rating: 1 });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Vous avez déjà laissé un avis sur ce service.');
    expect(await rating()).toEqual({ average: 5, count: 1 });
  });

  it('valide la note et le commentaire (400, messages en français)', async () => {
    const cases = [
      [{}, 'rating', 'Choisissez une note de 1 à 5 étoiles.'],
      [{ rating: 6 }, 'rating', 'La note doit être comprise entre 1 et 5.'],
      [{ rating: 0 }, 'rating', 'La note doit être comprise entre 1 et 5.'],
      [{ rating: 3.5 }, 'rating', 'La note doit être un nombre entier.'],
      [
        { rating: 4, comment: 'a'.repeat(1001) },
        'comment',
        'Le commentaire ne peut pas dépasser 1000 caractères.',
      ],
    ];
    for (const [body, field, message] of cases) {
      const res = await request(app).post(reviewsUrl()).set(authHeader(amel)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.details).toEqual([{ field, message }]);
    }
    expect(await Review.countDocuments()).toBe(0);
  });

  it('exige d’être connecté (401)', async () => {
    const res = await request(app).post(reviewsUrl()).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  it('est réservé aux voyageurs (403 pour un prestataire ou un administrateur)', async () => {
    for (const user of [provider, admin]) {
      const res = await request(app).post(reviewsUrl()).set(authHeader(user)).send({ rating: 5 });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Accès réservé aux voyageurs.');
    }
  });

  it('renvoie 404 pour un service masqué ou inexistant', async () => {
    for (const id of [hiddenService._id, UNKNOWN_ID]) {
      const res = await request(app).post(reviewsUrl(id)).set(authHeader(amel)).send({ rating: 5 });
      expect(res.status).toBe(404);
    }
  });
});

describe('US3.5 — GET /api/services/:id/reviews/me', () => {
  it('renvoie l’avis du voyageur connecté, ou null s’il n’en a pas', async () => {
    await Review.create({ service: service._id, author: amel._id, rating: 5 });

    const mine = await request(app).get(`${reviewsUrl()}/me`).set(authHeader(amel));
    expect(mine.status).toBe(200);
    expect(mine.body.review).toMatchObject({ rating: 5, author: { name: 'Amel B.' } });

    const none = await request(app).get(`${reviewsUrl()}/me`).set(authHeader(karim));
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ review: null });
  });

  it('renvoie 401 sans connexion, 403 pour un prestataire, 404 pour un service masqué', async () => {
    expect((await request(app).get(`${reviewsUrl()}/me`)).status).toBe(401);
    expect((await request(app).get(`${reviewsUrl()}/me`).set(authHeader(provider))).status).toBe(
      403,
    );
    expect(
      (
        await request(app)
          .get(`${reviewsUrl(hiddenService._id)}/me`)
          .set(authHeader(amel))
      ).status,
    ).toBe(404);
  });
});

describe('US3.5 — PATCH et DELETE /api/reviews/:id', () => {
  let review;

  beforeEach(async () => {
    review = await Review.create({
      service: service._id,
      author: amel._id,
      rating: 2,
      comment: 'Bruyant.',
    });
    await Review.create({ service: service._id, author: karim._id, rating: 4 });
  });

  it('modifie la note et le commentaire de son avis, puis recalcule la note', async () => {
    expect(await rating()).toEqual({ average: 3, count: 2 });

    const res = await request(app)
      .patch(`/api/reviews/${review._id}`)
      .set(authHeader(amel))
      .send({ rating: 5, comment: 'Finalement très bien.' });

    expect(res.status).toBe(200);
    expect(res.body.review).toMatchObject({ rating: 5, comment: 'Finalement très bien.' });
    expect(await rating()).toEqual({ average: 4.5, count: 2 });
  });

  it('un commentaire vide efface le commentaire et garde la note', async () => {
    const res = await request(app)
      .patch(`/api/reviews/${review._id}`)
      .set(authHeader(amel))
      .send({ comment: '   ' });

    expect(res.status).toBe(200);
    expect(res.body.review.rating).toBe(2);
    expect(res.body.review.comment).toBeUndefined();
  });

  it('valide la modification (400)', async () => {
    const empty = await request(app)
      .patch(`/api/reviews/${review._id}`)
      .set(authHeader(amel))
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.details).toEqual([
      { field: '', message: 'Indiquez la note ou le commentaire à modifier.' },
    ]);

    const badRating = await request(app)
      .patch(`/api/reviews/${review._id}`)
      .set(authHeader(amel))
      .send({ rating: 9 });
    expect(badRating.body.details).toEqual([
      { field: 'rating', message: 'La note doit être comprise entre 1 et 5.' },
    ]);

    const badId = await request(app)
      .patch('/api/reviews/abc')
      .set(authHeader(amel))
      .send({ rating: 3 });
    expect(badId.status).toBe(400);
    expect(badId.body.details[0].message).toBe("Identifiant d'avis invalide.");
  });

  it('interdit de modifier ou supprimer l’avis d’un autre voyageur (403)', async () => {
    const patch = await request(app)
      .patch(`/api/reviews/${review._id}`)
      .set(authHeader(karim))
      .send({ rating: 1 });
    expect(patch.status).toBe(403);
    expect(patch.body.message).toBe('Vous ne pouvez modifier que vos propres avis.');

    const del = await request(app).delete(`/api/reviews/${review._id}`).set(authHeader(karim));
    expect(del.status).toBe(403);
    expect(del.body.message).toBe('Vous ne pouvez supprimer que vos propres avis.');

    expect(await Review.findById(review._id)).toMatchObject({ rating: 2 });
  });

  it('supprime son avis (204) et recalcule la note', async () => {
    const res = await request(app).delete(`/api/reviews/${review._id}`).set(authHeader(amel));

    expect(res.status).toBe(204);
    expect(await Review.findById(review._id)).toBeNull();
    expect(await rating()).toEqual({ average: 4, count: 1 });
  });

  it('remet la note à zéro quand le dernier avis est supprimé', async () => {
    await Review.deleteMany({ author: karim._id });
    await request(app).delete(`/api/reviews/${review._id}`).set(authHeader(amel));

    expect(await rating()).toEqual({ average: 0, count: 0 });
  });

  it('renvoie 404 pour un avis inexistant et 401 sans connexion', async () => {
    const missing = await request(app).delete(`/api/reviews/${UNKNOWN_ID}`).set(authHeader(amel));
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Avis introuvable.');

    expect(
      (await request(app).patch(`/api/reviews/${review._id}`).send({ rating: 1 })).status,
    ).toBe(401);
    expect((await request(app).delete(`/api/reviews/${review._id}`)).status).toBe(401);
  });

  it('est réservé aux voyageurs (403 pour un prestataire)', async () => {
    const res = await request(app).delete(`/api/reviews/${review._id}`).set(authHeader(provider));

    expect(res.status).toBe(403);
  });
});
