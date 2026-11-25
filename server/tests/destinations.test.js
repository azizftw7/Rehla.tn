import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Service, Transport } from '../src/models/index.js';
import { createUser } from './helpers.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

const DESTINATIONS = [
  { name: 'Aïn Draham', region: 'Jendouba', location: point(8.6869, 36.7792) },
  { name: 'Djerba', region: 'Médenine', location: point(10.8575, 33.8758) },
  { name: 'Tozeur', region: 'Tozeur', location: point(8.1335, 33.9197) },
  { name: 'Sidi Bou Saïd', region: 'Tunis', location: point(10.3417, 36.8687) },
  { name: 'Gabès', region: 'Gabès', location: point(10.0982, 33.8815) },
];

const search = (query) => request(app).get('/api/destinations').query(query);
const names = (res) => res.body.items.map((d) => d.name);

beforeEach(async () => {
  await Destination.create(DESTINATIONS);
});

describe('US2.1 — GET /api/destinations?search=', () => {
  it('trouve une destination par nom partiel', async () => {
    const res = await search({ search: 'jer' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Djerba']);
    expect(res.body).toMatchObject({ total: 1, page: 1, pages: 1 });
  });

  it('ignore les accents : « ain » trouve « Aïn Draham »', async () => {
    const res = await search({ search: 'ain' });

    expect(names(res)).toEqual(['Aïn Draham']);
  });

  it('ignore la casse et les accents saisis par l’utilisateur', async () => {
    expect(names(await search({ search: 'SAÏD' }))).toEqual(['Sidi Bou Saïd']);
    expect(names(await search({ search: 'gabes' }))).toEqual(['Gabès']);
    expect(names(await search({ search: '  bou s ' }))).toEqual(['Sidi Bou Saïd']);
  });

  it('renvoie une liste vide quand aucune destination ne correspond', async () => {
    const res = await search({ search: 'Paris' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });

  it('traite les caractères spéciaux comme du texte', async () => {
    const res = await search({ search: '.*' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('liste toutes les destinations par ordre alphabétique sans recherche', async () => {
    const res = await search({});

    expect(names(res)).toEqual(['Aïn Draham', 'Djerba', 'Gabès', 'Sidi Bou Saïd', 'Tozeur']);
    expect(res.body.total).toBe(5);
  });

  it('pagine les résultats', async () => {
    const res = await search({ page: 2, limit: 2 });

    expect(res.body).toMatchObject({ total: 5, page: 2, pages: 3 });
    expect(names(res)).toEqual(['Gabès', 'Sidi Bou Saïd']);
  });

  it('renvoie les données utiles à la carte, sans champ technique', async () => {
    const res = await search({ search: 'djerba' });
    const [djerba] = res.body.items;

    expect(djerba).toMatchObject({
      name: 'Djerba',
      slug: 'djerba',
      region: 'Médenine',
      location: { type: 'Point', coordinates: [10.8575, 33.8758] },
    });
    expect(djerba).not.toHaveProperty('nameNormalized');
    expect(djerba).not.toHaveProperty('__v');
  });

  it('valide les paramètres (400)', async () => {
    const res = await search({ search: 'a'.repeat(101), limit: 0 });

    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(['search', 'limit']);
  });

  it('est accessible sans être connecté', async () => {
    const res = await search({ search: 'tozeur' });

    expect(res.status).toBe(200);
  });
});

describe('US2.1 — GET /api/destinations/:slug', () => {
  it('renvoie la destination correspondant au slug', async () => {
    const res = await request(app).get('/api/destinations/sidi-bou-said');

    expect(res.status).toBe(200);
    expect(res.body.destination).toMatchObject({ name: 'Sidi Bou Saïd', region: 'Tunis' });
  });

  it('ignore la casse du slug', async () => {
    const res = await request(app).get('/api/destinations/Djerba');

    expect(res.status).toBe(200);
    expect(res.body.destination.name).toBe('Djerba');
  });

  it('renvoie 404 avec un message clair si la destination n’existe pas', async () => {
    const res = await request(app).get('/api/destinations/atlantide');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Destination introuvable.', details: [] });
  });
});

describe('US2.3 — GET /api/destinations?types= (recherche de l’accueil)', () => {
  beforeEach(async () => {
    const [djerba, tozeur, sidiBouSaid] = await Promise.all(
      ['djerba', 'tozeur', 'sidi-bou-said'].map((slug) => Destination.findOne({ slug })),
    );
    const provider = await createUser({ role: 'prestataire' });
    const base = { provider: provider._id, location: point(10, 34), free: true };

    await Service.create([
      { ...base, type: 'hebergement', name: 'Dar Djerba', destination: djerba._id },
      { ...base, type: 'guide', name: 'Guide de Tozeur', destination: tozeur._id },
      // Un service masqué ne compte pas.
      {
        ...base,
        type: 'restaurant',
        name: 'Masqué',
        destination: sidiBouSaid._id,
        hidden: true,
      },
    ]);
    await Transport.create({ type: 'ferry', from: 'Jorf', to: 'Ajim', destination: djerba._id });
  });

  it('ne garde que les destinations qui proposent un des types demandés', async () => {
    const res = await search({ types: 'hebergement,guide' });

    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Djerba', 'Tozeur']);
    expect(res.body.total).toBe(2);
  });

  it('tient compte des transports et des services masqués', async () => {
    expect(names(await search({ types: 'transport' }))).toEqual(['Djerba']);
    expect(names(await search({ types: 'restaurant' }))).toEqual([]);
  });

  it('se combine avec la recherche par nom', async () => {
    expect(names(await search({ search: 'toz', types: 'hebergement,guide' }))).toEqual(['Tozeur']);
  });

  it('refuse un type inconnu (400)', async () => {
    const res = await search({ types: 'guide,plongee' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('types');
  });
});
