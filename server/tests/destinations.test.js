import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination } from '../src/models/index.js';

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
