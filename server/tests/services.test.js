import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Service, User } from '../src/models/index.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const list = (query) => request(app).get('/api/services').query(query);
const names = (res) => res.body.items.map((s) => s.name);

let tunis;
let djerba;
let provider;
let visibleRestaurant;
let hiddenRestaurant;

beforeEach(async () => {
  [tunis, djerba] = await Destination.create([
    { name: 'Sidi Bou Saïd', region: 'Tunis', location: point(10.3417, 36.8687) },
    { name: 'Djerba', region: 'Médenine', location: point(10.8575, 33.8758) },
  ]);

  provider = await User.create({
    name: 'Chef Karim',
    email: 'karim@rehla.tn',
    password: 'Password123!',
    role: 'prestataire',
    provider: {
      businessName: 'Dar Zarrouk',
      activityType: 'restaurant',
      city: 'Tunis',
      phone: '+216 71 000 000',
    },
  });

  [visibleRestaurant, , , , hiddenRestaurant] = await Service.create([
    {
      type: 'restaurant',
      name: 'Dar Zarrouk',
      description: 'Cuisine tunisienne raffinée avec vue sur mer',
      destination: tunis._id,
      provider: provider._id,
      location: point(10.3469, 36.8705),
      address: 'Rue Hédi Zarrouk, Sidi Bou Saïd',
      cuisine: 'Tunisienne',
      price: { amount: 65, unit: 'repas' },
      ratingAverage: 4.8,
      ratingCount: 12,
    },
    {
      type: 'restaurant',
      name: 'Le Pirate',
      description: 'Poissons grillés et fruits de mer frais',
      destination: djerba._id,
      provider: provider._id,
      location: point(10.8591, 33.8812),
      address: 'Port de Houmt Souk, Djerba',
      cuisine: 'Fruits de mer',
      price: { amount: 45, unit: 'repas' },
      ratingAverage: 4.5,
      ratingCount: 8,
    },
    {
      type: 'activite',
      name: 'Balade en quad',
      description: 'Excursion dans les dunes',
      destination: djerba._id,
      provider: provider._id,
      location: point(10.86, 33.88),
      activityCategory: 'Aventure',
      price: { amount: 80, unit: 'personne' },
      ratingAverage: 4.9,
      ratingCount: 20,
    },
    {
      type: 'activite',
      name: 'Plage de Sidi Mahrez',
      description: 'Grande plage de sable fin accessible gratuitement',
      destination: djerba._id,
      provider: provider._id,
      location: point(11.005, 33.854),
      activityCategory: 'Plage',
      free: true,
      ratingAverage: 4.7,
      ratingCount: 15,
    },
    {
      type: 'restaurant',
      name: 'Restaurant Masqué',
      description: 'Ne doit pas apparaître publiquement',
      destination: tunis._id,
      provider: provider._id,
      location: point(10.34, 36.87),
      cuisine: 'Italienne',
      price: { amount: 30, unit: 'repas' },
      hidden: true,
    },
  ]);
});

describe('US3.2 — GET /api/services?type=restaurant', () => {
  it('liste uniquement les restaurants visibles triés par note décroissante', async () => {
    const res = await list({ type: 'restaurant' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Dar Zarrouk', 'Le Pirate']);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items[0].destination).toMatchObject({
      name: 'Sidi Bou Saïd',
      slug: 'sidi-bou-said',
      region: 'Tunis',
    });
  });

  it('filtre par destination via son slug ou son ObjectId', async () => {
    const bySlug = await list({ type: 'restaurant', destination: 'djerba' });
    expect(names(bySlug)).toEqual(['Le Pirate']);

    const byId = await list({ type: 'restaurant', destination: tunis._id.toString() });
    expect(names(byId)).toEqual(['Dar Zarrouk']);
  });

  it('renvoie une liste vide si le slug de destination est inconnu', async () => {
    const res = await list({ type: 'restaurant', destination: 'atlantide' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });

  it('filtre par mot-clé (nom, description ou adresse) et par cuisine', async () => {
    const bySearch = await list({ type: 'restaurant', search: 'poissons' });
    expect(names(bySearch)).toEqual(['Le Pirate']);

    const byCuisine = await list({ type: 'restaurant', cuisine: 'tunisienne' });
    expect(names(byCuisine)).toEqual(['Dar Zarrouk']);
  });

  it('filtre par prix maximum', async () => {
    const res = await list({ type: 'restaurant', maxPrice: 50 });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Le Pirate']);
  });

  it('pagine les résultats', async () => {
    const res = await list({ type: 'restaurant', page: 2, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(names(res)).toEqual(['Le Pirate']);
  });

  it('valide les paramètres de requête (400)', async () => {
    const res = await list({ type: 'inconnu', maxPrice: -5 });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['type', 'maxPrice']);
  });
});

describe('US3.3 — GET /api/services?type=activite', () => {
  it('liste les activités visibles triées par note décroissante', async () => {
    const res = await list({ type: 'activite' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Balade en quad', 'Plage de Sidi Mahrez']);
    expect(res.body.total).toBe(2);
  });

  it('filtre les activités par catégorie (activityCategory)', async () => {
    const res = await list({ type: 'activite', activityCategory: 'plage' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Plage de Sidi Mahrez']);
    expect(res.body.items[0]).toMatchObject({
      activityCategory: 'Plage',
      free: true,
    });
  });

  it('filtre uniquement les activités gratuites avec free=true', async () => {
    const res = await list({ type: 'activite', free: 'true' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Plage de Sidi Mahrez']);
    expect(res.body.items[0].free).toBe(true);
  });
});

describe('US3.2 — GET /api/services/:id', () => {
  it('renvoie la fiche détaillée d’un restaurant avec sa destination et son prestataire', async () => {
    const res = await request(app).get(`/api/services/${visibleRestaurant._id}`);

    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({
      name: 'Dar Zarrouk',
      type: 'restaurant',
      cuisine: 'Tunisienne',
      destination: { name: 'Sidi Bou Saïd', slug: 'sidi-bou-said', region: 'Tunis' },
      provider: { name: 'Chef Karim' },
    });
  });

  it('renvoie 404 si le restaurant est masqué ou inexistant', async () => {
    const hiddenRes = await request(app).get(`/api/services/${hiddenRestaurant._id}`);
    expect(hiddenRes.status).toBe(404);
    expect(hiddenRes.body).toEqual({ message: 'Service introuvable.', details: [] });

    const missingId = new mongoose.Types.ObjectId();
    const missingRes = await request(app).get(`/api/services/${missingId}`);
    expect(missingRes.status).toBe(404);
  });

  it('renvoie 400 si l’identifiant est mal formé', async () => {
    const res = await request(app).get('/api/services/id-invalide');

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('id');
  });
});
describe('US3.4 — GET /api/services?type=evenement', () => {
  beforeEach(async () => {
    const base = { type: 'evenement', provider: provider._id, free: true };
    await Service.create([
      {
        ...base,
        name: 'Festival des palmeraies',
        destination: djerba._id,
        location: point(10.86, 33.87),
        event: { eventType: 'Festival', startDate: '2026-07-12', endDate: '2026-08-20' },
      },
      {
        ...base,
        name: 'Concert de malouf',
        destination: tunis._id,
        location: point(10.34, 36.87),
        event: { eventType: 'Concert', startDate: '2026-12-05', hours: '18h – 20h' },
      },
      {
        ...base,
        name: 'Fête de la pêche',
        destination: djerba._id,
        location: point(10.85, 33.88),
        event: { eventType: 'Fête locale', startDate: '2026-11-28', endDate: '2026-11-30' },
      },
      {
        ...base,
        name: 'Concert masqué',
        destination: tunis._id,
        location: point(10.34, 36.87),
        event: { eventType: 'Concert', startDate: '2026-12-06' },
        hidden: true,
      },
    ]);
  });

  it('liste les événements par date de début croissante', async () => {
    const res = await list({ type: 'evenement' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual([
      'Festival des palmeraies',
      'Fête de la pêche',
      'Concert de malouf',
    ]);
    expect(res.body.items[0].event).toMatchObject({ eventType: 'Festival' });
  });

  it('filtre par type d’événement, sans tenir compte de la casse', async () => {
    const res = await list({ type: 'evenement', eventType: 'concert' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Concert de malouf']);

    const local = await list({ type: 'evenement', eventType: 'Fête locale' });
    expect(names(local)).toEqual(['Fête de la pêche']);
  });

  it('filtre par période (dates de début et de fin incluses)', async () => {
    const res = await list({ type: 'evenement', from: '2026-11-01', to: '2026-12-05' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Fête de la pêche', 'Concert de malouf']);
  });

  it('garde un événement qui chevauche la période sans y être entièrement compris', async () => {
    // Le festival dure du 12 juillet au 20 août : il chevauche la période du 1er au 15 août.
    const during = await list({ type: 'evenement', from: '2026-08-01', to: '2026-08-15' });
    expect(names(during)).toEqual(['Festival des palmeraies']);

    // Il commence avant « from » et finit pendant la période.
    const end = await list({ type: 'evenement', from: '2026-08-20' });
    expect(names(end)).toEqual([
      'Festival des palmeraies',
      'Fête de la pêche',
      'Concert de malouf',
    ]);

    // Sans date de fin, l'événement ne dure que son jour de début.
    const after = await list({ type: 'evenement', from: '2026-12-06' });
    expect(names(after)).toEqual([]);

    const before = await list({ type: 'evenement', to: '2026-07-11' });
    expect(names(before)).toEqual([]);
  });

  it('combine type d’événement, période et destination', async () => {
    const res = await list({
      type: 'evenement',
      destination: 'djerba',
      eventType: 'Festival',
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(names(res)).toEqual(['Festival des palmeraies']);
  });

  it('renvoie 400 si la date de début est postérieure à la date de fin', async () => {
    const res = await list({ type: 'evenement', from: '2026-12-10', to: '2026-12-01' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      {
        field: 'to',
        message: 'La date de fin doit être postérieure ou égale à la date de début.',
      },
    ]);
  });

  it('renvoie 400 si une date est mal formée', async () => {
    const res = await list({ type: 'evenement', from: '12/10/2026', to: '2026-13-45' });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['from', 'to']);
    expect(res.body.details[0].message).toBe(
      'La date de début doit être une date au format AAAA-MM-JJ.',
    );
  });
});
