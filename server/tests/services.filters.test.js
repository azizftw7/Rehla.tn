import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Service } from '../src/models/index.js';
import { createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const list = (query) => request(app).get('/api/services').query(query);
const names = (res) => res.body.items.map((s) => s.name).sort();

beforeEach(async () => {
  const djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  const provider = await createUser({ role: 'prestataire' });
  const base = { destination: djerba._id, provider: provider._id, location: point(10.86, 33.88) };

  await Service.create([
    {
      ...base,
      type: 'hebergement',
      name: 'Dar Yasmine',
      accommodationType: 'dar',
      price: { amount: 180, unit: 'nuit' },
      ratingAverage: 4.6,
      ratingCount: 8,
    },
    {
      ...base,
      type: 'hebergement',
      name: 'Hôtel Ulysse',
      accommodationType: 'hotel',
      price: { amount: 120, unit: 'nuit' },
      ratingAverage: 3.9,
      ratingCount: 20,
    },
    {
      ...base,
      type: 'restaurant',
      name: 'Chez Salah',
      cuisine: 'Tunisienne',
      price: { amount: 35, unit: 'repas' },
      ratingAverage: 4.2,
      ratingCount: 5,
    },
    {
      ...base,
      type: 'activite',
      name: 'Plage de Sidi Mahrez',
      activityCategory: 'Plage',
      free: true,
    },
    {
      ...base,
      type: 'activite',
      name: 'Balade en quad',
      activityCategory: 'Aventure',
      price: { amount: 90, unit: 'personne' },
      ratingAverage: 4.8,
      ratingCount: 3,
    },
    {
      ...base,
      type: 'evenement',
      name: 'Festival d’Ulysse',
      event: { eventType: 'Festival', startDate: '2026-07-10', endDate: '2026-07-20' },
      free: true,
      ratingAverage: 4.5,
      ratingCount: 2,
    },
    {
      ...base,
      type: 'evenement',
      name: 'Concert de malouf',
      event: { eventType: 'Concert', startDate: '2026-12-05' },
      price: { amount: 20 },
    },
    { ...base, type: 'restaurant', name: 'Restaurant masqué', free: true, hidden: true },
  ]);
});

describe('US2.3 — GET /api/services : plusieurs types à la fois', () => {
  it('accepte une liste de types séparés par des virgules', async () => {
    const res = await list({ types: 'hebergement,restaurant' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Chez Salah', 'Dar Yasmine', 'Hôtel Ulysse']);
    expect(res.body.total).toBe(3);
  });

  it('accepte aussi le paramètre répété et ignore doublons et espaces', async () => {
    const res = await request(app).get(
      '/api/services?types=restaurant&types=%20activite%20,restaurant',
    );

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Balade en quad', 'Chez Salah', 'Plage de Sidi Mahrez']);
  });

  it('renvoie tous les services visibles sans filtre de type', async () => {
    const res = await list({});

    expect(res.body.total).toBe(7);
    expect(names(res)).not.toContain('Restaurant masqué');
  });

  it('refuse un type inconnu avec un message en français (400)', async () => {
    const res = await list({ types: 'hebergement,plongee' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      {
        field: 'types',
        message:
          'Type de service invalide (valeurs possibles : hebergement, restaurant, activite, evenement, guide).',
      },
    ]);
  });
});

describe('US2.3 — filtres propres à un type', () => {
  it('le type d’hébergement ne restreint que les hébergements', async () => {
    const res = await list({ types: 'hebergement,restaurant', accommodationType: 'dar' });

    expect(names(res)).toEqual(['Chez Salah', 'Dar Yasmine']);
  });

  it('la catégorie d’activité ne restreint que les activités', async () => {
    const res = await list({ types: 'activite,restaurant', activityCategory: 'plage' });

    expect(names(res)).toEqual(['Chez Salah', 'Plage de Sidi Mahrez']);
  });

  it('la période ne restreint que les événements', async () => {
    const res = await list({ types: 'evenement,restaurant', from: '2026-12-01', to: '2026-12-31' });

    expect(names(res)).toEqual(['Chez Salah', 'Concert de malouf']);
  });

  it('garde le comportement d’un seul type (événements triés par date)', async () => {
    const res = await list({ types: 'evenement' });

    expect(res.body.items.map((s) => s.name)).toEqual(['Festival d’Ulysse', 'Concert de malouf']);
  });
});

describe('US2.3 — prix et note minimale', () => {
  it('prix maximum : garde les services moins chers et les gratuits', async () => {
    const res = await list({ maxPrice: 40 });

    expect(names(res)).toEqual([
      'Chez Salah',
      'Concert de malouf',
      'Festival d’Ulysse',
      'Plage de Sidi Mahrez',
    ]);
  });

  it('gratuit uniquement', async () => {
    const res = await list({ types: 'activite,evenement', free: 'true' });

    expect(names(res)).toEqual(['Festival d’Ulysse', 'Plage de Sidi Mahrez']);
  });

  it('note minimale : exclut les services moins bien notés ou sans avis', async () => {
    const res = await list({ minRating: 4.5 });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Balade en quad', 'Dar Yasmine', 'Festival d’Ulysse']);
  });

  it('combine plusieurs critères', async () => {
    const res = await list({ types: 'hebergement,activite', maxPrice: 150, minRating: 3 });

    expect(names(res)).toEqual(['Balade en quad', 'Hôtel Ulysse']);
  });

  it('valide la note minimale et le prix (400)', async () => {
    const res = await list({ minRating: 6, maxPrice: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'maxPrice', message: 'Le prix maximum doit être un nombre.' },
      { field: 'minRating', message: 'La note minimale doit être comprise entre 1 et 5.' },
    ]);
  });
});
