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

  [visibleRestaurant, , , hiddenRestaurant] = await Service.create([
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