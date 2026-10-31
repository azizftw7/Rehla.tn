import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { User } from '../src/models/index.js';
import { ApiError } from '../src/utils/ApiError.js';

/** Petite app qui lève l'erreur donnée, pour tester le middleware d'erreurs isolément. */
function appThrowing(makeError) {
  const testApp = express();
  testApp.get('/boom', async () => {
    throw await makeError();
  });
  testApp.use(errorHandler);
  return testApp;
}

describe('US7.3 — route 404 en JSON', () => {
  it('renvoie 404 et un message JSON pour une route inconnue', async () => {
    const res = await request(app).get('/api/route-inexistante');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      message: 'Route introuvable : GET /api/route-inexistante',
      details: [],
    });
  });

  it('renvoie aussi 404 en JSON hors du préfixe /api', async () => {
    const res = await request(app).post('/nimporte-quoi');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Route introuvable/);
  });
});

describe('US7.3 — middleware global d’erreurs', () => {
  const originalNodeEnv = env.nodeEnv;
  afterEach(() => {
    env.nodeEnv = originalNodeEnv;
  });

  it('renvoie 400 si le corps JSON est mal formé', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Le corps de la requête n'est pas un JSON valide.");
  });

  it('transmet le code et les détails d’une ApiError', async () => {
    const res = await request(
      appThrowing(() => ApiError.badRequest('Données invalides.', [{ field: 'x', message: 'y' }])),
    ).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Données invalides.',
      details: [{ field: 'x', message: 'y' }],
    });
  });

  it('convertit une erreur de validation Mongoose en 400 avec les champs en cause', async () => {
    const res = await request(appThrowing(() => new User({}).validate().catch((e) => e))).get(
      '/boom',
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Données invalides.');
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    expect(res.body.details.find((d) => d.field === 'email').message).toBe(
      "L'adresse e-mail est obligatoire.",
    );
  });

  it('convertit un identifiant mal formé en 400', async () => {
    const res = await request(appThrowing(() => User.findById('pas-un-id').catch((e) => e))).get(
      '/boom',
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Identifiant ou valeur invalide.');
  });

  it('convertit un doublon d’e-mail en 409 avec un message clair', async () => {
    const data = { name: 'Amel', email: 'amel@example.com', password: 'motdepasse1' };
    await User.create(data);

    const res = await request(appThrowing(() => User.create(data).catch((e) => e))).get('/boom');

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cette adresse e-mail est déjà utilisée.');
  });

  it('renvoie 503 quand la base de données est indisponible', async () => {
    const res = await request(
      appThrowing(() => new mongoose.Error.MongooseServerSelectionError('connect ECONNREFUSED')),
    ).get('/boom');

    expect(res.status).toBe(503);
    expect(res.body.message).toBe(
      'Le service est momentanément indisponible. Réessayez dans quelques instants.',
    );
  });

  it('renvoie 500 avec un message générique, sans le détail interne', async () => {
    const res = await request(appThrowing(() => new Error('secret interne'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Une erreur interne est survenue. Réessayez plus tard.');
  });

  it('n’expose pas la stack trace en production, mais journalise l’erreur côté serveur', async () => {
    env.nodeEnv = 'production';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThrowing(() => new Error('secret interne'))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: 'Une erreur interne est survenue. Réessayez plus tard.',
      details: [],
    });
    expect(log).toHaveBeenCalledWith(
      '[GET /boom]',
      expect.objectContaining({ message: 'secret interne' }),
    );
    log.mockRestore();
  });

  it('inclut la stack trace en développement pour faciliter le débogage', async () => {
    env.nodeEnv = 'development';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(appThrowing(() => new Error('secret interne'))).get('/boom');

    expect(res.body.stack).toContain('secret interne');
    log.mockRestore();
  });
});
