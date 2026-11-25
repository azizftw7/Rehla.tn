import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { accentInsensitiveExact } from '../src/controllers/services.controller.js';
import { Destination, Service } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

let djerba;
let provider;

beforeEach(async () => {
  djerba = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: point(10.8575, 33.8758),
  });
  provider = await createUser({ role: 'prestataire' });
  const guide = (name, languages, extra = {}) => ({
    type: 'guide',
    name,
    languages,
    destination: djerba._id,
    provider: provider._id,
    location: point(10.86, 33.88),
    price: { amount: 80, unit: 'demi-journée' },
    ...extra,
  });
  await Service.create([
    guide('Slim, guide de l’île', ['français', 'arabe', 'anglais']),
    guide('Yasmine, guide des villages', ['Arabe', 'Espagnol']),
    guide('Guide masqué', ['italien'], { hidden: true }),
    {
      type: 'restaurant',
      name: 'Le Filet',
      cuisine: 'Poisson',
      destination: djerba._id,
      provider: provider._id,
      location: point(10.86, 33.88),
      price: { amount: 40 },
    },
  ]);
});

describe('US4.2 — GET /api/services?type=guide&language=', () => {
  it('liste les guides qui parlent la langue, sans tenir compte de la casse ni des accents', async () => {
    const names = async (query) =>
      (await request(app).get('/api/services').query(query)).body.items.map((s) => s.name).sort();

    expect(await names({ type: 'guide', language: 'arabe' })).toEqual([
      'Slim, guide de l’île',
      'Yasmine, guide des villages',
    ]);
    expect(await names({ type: 'guide', language: 'FRANCAIS' })).toEqual(['Slim, guide de l’île']);
    expect(await names({ type: 'guide', language: 'espagnol' })).toEqual([
      'Yasmine, guide des villages',
    ]);
    // Pas de correspondance partielle, et un guide masqué n'apparaît jamais.
    expect(await names({ type: 'guide', language: 'arab' })).toEqual([]);
    expect(await names({ type: 'guide', language: 'italien' })).toEqual([]);
  });

  it('avec plusieurs types (carte US2.3), la langue ne restreint que les guides', async () => {
    const res = await request(app)
      .get('/api/services')
      .query({ types: 'guide,restaurant', language: 'espagnol' });
    expect(res.status).toBe(200);
    expect(res.body.items.map((s) => s.name).sort()).toEqual([
      'Le Filet',
      'Yasmine, guide des villages',
    ]);
  });

  it('renvoie les langues de chaque guide dans la liste', async () => {
    const res = await request(app)
      .get('/api/services')
      .query({ type: 'guide', destination: 'djerba' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.find((s) => s.name.startsWith('Slim')).languages).toEqual([
      'français',
      'arabe',
      'anglais',
    ]);
  });

  it('valide la langue (400, message en français)', async () => {
    const res = await request(app)
      .get('/api/services')
      .query({ type: 'guide', language: 'a'.repeat(41) });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'language', message: 'La langue ne peut pas dépasser 40 caractères.' },
    ]);
  });
});

describe('US4.2 — GET /api/services/languages', () => {
  it('liste les langues des guides visibles, sans doublon et triées', async () => {
    const res = await request(app).get('/api/services/languages');
    expect(res.status).toBe(200);
    expect(res.body.languages).toEqual(['Anglais', 'Arabe', 'Espagnol', 'Français']);
  });
});

describe('US4.2 — publication d’un guide (formulaire US6.1)', () => {
  it('exige les langues et garde chaque langue une seule fois', async () => {
    const base = {
      type: 'guide',
      name: 'Hédi, guide du Djérid',
      destination: String(djerba._id),
      latitude: '33.92',
      longitude: '8.13',
      price: '90',
    };
    const missing = await request(app)
      .post('/api/provider/services')
      .set(authHeader(provider))
      .field(base);
    expect(missing.status).toBe(400);
    expect(missing.body.details).toContainEqual({
      field: 'languages',
      message: 'Indiquez au moins une langue parlée.',
    });

    const res = await request(app)
      .post('/api/provider/services')
      .set(authHeader(provider))
      .field({ ...base, languages: 'français, Arabe, Français , arabe, allemand' });
    expect(res.status).toBe(201);
    expect(res.body.service.languages).toEqual(['français', 'Arabe', 'allemand']);
  });
});

describe('accentInsensitiveExact', () => {
  it('reconnaît une langue avec ou sans accents', () => {
    const regex = accentInsensitiveExact('Français');
    expect(regex.test('francais')).toBe(true);
    expect(regex.test('FRANÇAIS')).toBe(true);
    expect(regex.test('français courant')).toBe(false);
    expect(accentInsensitiveExact('c++').test('c++')).toBe(true);
  });
});
