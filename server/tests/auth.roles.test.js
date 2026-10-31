import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { authorize, protect } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { authHeader, createUser } from './helpers.js';

// Petite app avec une route par combinaison de rôles, pour tester authorize isolément.
const rolesApp = express();
const ok = (_req, res) => res.json({ ok: true });
rolesApp.get('/voyageur', protect, authorize('voyageur'), ok);
rolesApp.get('/prestataire', protect, authorize('prestataire'), ok);
rolesApp.get('/admin', protect, authorize('admin'), ok);
rolesApp.get('/prestataire-ou-admin', protect, authorize('prestataire', 'admin'), ok);
rolesApp.get('/sans-protect', authorize('admin'), ok);
rolesApp.use(errorHandler);

describe('US1.4 — authorize(...roles)', () => {
  it('un voyageur ne peut pas accéder aux routes prestataire (403)', async () => {
    const voyageur = await createUser({ role: 'voyageur' });

    const res = await request(rolesApp).get('/prestataire').set(authHeader(voyageur));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Accès réservé aux prestataires.', details: [] });
  });

  it('un voyageur ne peut pas accéder aux routes admin (403)', async () => {
    const voyageur = await createUser({ role: 'voyageur' });

    const res = await request(rolesApp).get('/admin').set(authHeader(voyageur));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Accès réservé aux administrateurs.');
  });

  it('un prestataire ne peut pas accéder aux routes admin (403)', async () => {
    const prestataire = await createUser({ role: 'prestataire' });

    const res = await request(rolesApp).get('/admin').set(authHeader(prestataire));

    expect(res.status).toBe(403);
  });

  it.each([
    ['voyageur', '/voyageur'],
    ['prestataire', '/prestataire'],
    ['admin', '/admin'],
    ['prestataire', '/prestataire-ou-admin'],
    ['admin', '/prestataire-ou-admin'],
  ])('autorise le rôle %s sur %s', async (role, path) => {
    const user = await createUser({ role });

    const res = await request(rolesApp).get(path).set(authHeader(user));

    expect(res.status).toBe(200);
  });

  it('liste tous les rôles autorisés dans le message', async () => {
    const voyageur = await createUser({ role: 'voyageur' });

    const res = await request(rolesApp).get('/prestataire-ou-admin').set(authHeader(voyageur));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Accès réservé aux prestataires et administrateurs.');
  });

  it('se fie au rôle en base et non à celui du token', async () => {
    const voyageur = await createUser({ role: 'voyageur' });
    const headers = authHeader(voyageur);
    voyageur.role = 'admin';
    await voyageur.save();

    const res = await request(rolesApp).get('/admin').set(headers);

    expect(res.status).toBe(200);
  });

  it('renvoie 401 si authorize est utilisé sans protect', async () => {
    const res = await request(rolesApp).get('/sans-protect');

    expect(res.status).toBe(401);
  });
});

describe('US1.4 — espaces /api/provider et /api/admin', () => {
  it.each(['/api/provider/services', '/api/admin/users'])(
    'refuse %s à un voyageur (403)',
    async (path) => {
      const voyageur = await createUser({ role: 'voyageur' });

      const res = await request(app).get(path).set(authHeader(voyageur));

      expect(res.status).toBe(403);
    },
  );

  it('refuse /api/admin à un prestataire (403)', async () => {
    const prestataire = await createUser({ role: 'prestataire' });

    const res = await request(app).get('/api/admin/users').set(authHeader(prestataire));

    expect(res.status).toBe(403);
  });

  it('exige d’être connecté (401)', async () => {
    const res = await request(app).get('/api/admin/users');

    expect(res.status).toBe(401);
  });

  it('laisse passer le bon rôle (404 tant que la route n’existe pas)', async () => {
    const admin = await createUser({ role: 'admin' });

    const res = await request(app).get('/api/admin/users').set(authHeader(admin));

    expect(res.status).toBe(404);
  });
});
