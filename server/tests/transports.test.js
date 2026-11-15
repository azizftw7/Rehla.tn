import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { Destination, Transport } from '../src/models/index.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const list = (query) => request(app).get('/api/transports').query(query);
const types = (res) => res.body.items.map((t) => t.type);

let djerba;
let tozeur;

beforeEach(async () => {
  [djerba, tozeur] = await Destination.create([
    { name: 'Djerba', region: 'Médenine', location: point(10.8575, 33.8758) },
    { name: 'Tozeur', region: 'Tozeur', location: point(8.1335, 33.9197) },
  ]);

  await Transport.create([
    {
      type: 'avion',
      from: 'Tunis',
      to: 'Djerba',
      destination: djerba._id,
      price: 150,
      duration: 60,
      schedule: 'Plusieurs vols par jour',
      operator: 'Compagnie aérienne (démo)',
      source: 'Démo',
      sourceUpdatedAt: new Date('2026-10-01'),
    },
    {
      type: 'louage',
      from: 'Tunis',
      to: 'Djerba',
      destination: djerba._id,
      price: 45,
      duration: 480,
      schedule: 'Départ dès que le louage est complet',
    },
    {
      type: 'ferry',
      from: 'Jorf',
      to: 'Ajim (Djerba)',
      destination: djerba._id,
      price: 1,
      duration: 20,
    },
    {
      type: 'bus',
      from: 'Tunis',
      to: 'Tozeur',
      destination: tozeur._id,
      price: 40,
      duration: 420,
    },
  ]);
});

describe('GET /api/transports', () => {
  it('est public et liste les transports d’une destination (slug), triés par prix', async () => {
    const res = await list({ destination: 'djerba' });

    expect(res.status).toBe(200);
    expect(types(res)).toEqual(['ferry', 'louage', 'avion']);
    expect(res.body).toMatchObject({ total: 3, page: 1, pages: 1 });

    const avion = res.body.items[2];
    expect(avion).toMatchObject({
      from: 'Tunis',
      to: 'Djerba',
      price: 150,
      duration: 60,
      schedule: 'Plusieurs vols par jour',
      operator: 'Compagnie aérienne (démo)',
      source: 'Démo',
    });
    expect(avion.sourceUpdatedAt).toBeDefined();
    expect(avion.destination).toMatchObject({ name: 'Djerba', slug: 'djerba' });
    expect(avion).not.toHaveProperty('__v');
  });

  it('accepte aussi l’identifiant de la destination', async () => {
    const res = await list({ destination: tozeur._id.toString() });

    expect(res.status).toBe(200);
    expect(types(res)).toEqual(['bus']);
  });

  it('accepte un slug en majuscules', async () => {
    const res = await list({ destination: 'DJERBA' });
    expect(res.body.total).toBe(3);
  });

  it('renvoie une liste vide pour une destination inconnue', async () => {
    const res = await list({ destination: 'atlantide' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0, page: 1, pages: 0 });
  });

  it('filtre par type', async () => {
    const res = await list({ destination: 'djerba', type: 'louage' });
    expect(types(res)).toEqual(['louage']);
  });

  it('filtre par ville de départ (partiel, insensible à la casse)', async () => {
    const res = await list({ destination: 'djerba', from: 'tun' });
    expect(types(res)).toEqual(['louage', 'avion']);
  });

  it('ne traite pas la ville de départ comme une expression régulière', async () => {
    const res = await list({ from: '.*' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it('liste tous les transports sans filtre et pagine', async () => {
    const res = await list({ limit: 2, page: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, page: 2, pages: 2 });
    expect(types(res)).toEqual(['louage', 'avion']);
  });

  it('refuse un type inconnu avec un message en français', async () => {
    const res = await list({ type: 'trottinette' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Données invalides.');
    expect(res.body.details).toEqual([
      {
        field: 'type',
        message: 'Type de transport invalide (bus, louage, train, ferry ou avion).',
      },
    ]);
  });

  it('refuse une pagination invalide', async () => {
    const res = await list({ limit: 500 });

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toEqual({
      field: 'limit',
      message: 'La limite ne peut pas dépasser 100.',
    });
  });

  it('refuse une destination vide', async () => {
    const res = await list({ destination: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('destination');
  });
});
