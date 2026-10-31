import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/index.js';
import { authHeader, createUser, TEST_PASSWORD } from './helpers.js';

const login = (body) => request(app).post('/api/auth/login').send(body);

describe('US1.3 — POST /api/auth/login', () => {
  it('connecte l’utilisateur et renvoie un token contenant id et rôle', async () => {
    const user = await createUser({ email: 'amel@example.com', role: 'prestataire' });

    const res = await login({ email: '  AMEL@example.com ', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'amel@example.com', role: 'prestataire' });
    expect(res.body.user).not.toHaveProperty('password');
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: user._id.toString(), role: 'prestataire' });
  });

  it('refuse un mauvais mot de passe avec un message générique (401)', async () => {
    await createUser({ email: 'amel@example.com' });

    const res = await login({ email: 'amel@example.com', password: 'mauvais-mdp' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'E-mail ou mot de passe incorrect.', details: [] });
    expect(res.body).not.toHaveProperty('token');
  });

  it('renvoie le même message pour un e-mail inconnu', async () => {
    const res = await login({ email: 'inconnu@example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou mot de passe incorrect.');
  });

  it('refuse la connexion d’un compte suspendu (403)', async () => {
    await createUser({ email: 'amel@example.com', status: 'suspendu' });

    const res = await login({ email: 'amel@example.com', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Votre compte est suspendu. Contactez l'administrateur.");
    expect(res.body).not.toHaveProperty('token');
  });

  it('ne révèle pas la suspension si le mot de passe est faux', async () => {
    await createUser({ email: 'amel@example.com', status: 'suspendu' });

    const res = await login({ email: 'amel@example.com', password: 'mauvais-mdp' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou mot de passe incorrect.');
  });

  it('signale les champs manquants (400)', async () => {
    const res = await login({});

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'email', message: "L'adresse e-mail est obligatoire." },
      { field: 'password', message: 'Le mot de passe est obligatoire.' },
    ]);
  });
});

describe('US1.3 — middleware protect (GET /api/users/me)', () => {
  const me = () => request(app).get('/api/users/me');

  it('refuse l’accès sans token (401)', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authentification requise. Connectez-vous.');
  });

  it('refuse un en-tête Authorization qui n’est pas « Bearer »', async () => {
    const user = await createUser();
    const token = authHeader(user).Authorization.replace('Bearer', 'Token');

    const res = await me().set('Authorization', token);

    expect(res.status).toBe(401);
  });

  it('refuse un token invalide (401)', async () => {
    const res = await me().set('Authorization', 'Bearer pas.un.token');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Session invalide. Reconnectez-vous.');
  });

  it('refuse un token signé avec une autre clé', async () => {
    const user = await createUser();
    const forged = jwt.sign({ id: user._id.toString(), role: 'admin' }, 'autre-cle');

    const res = await me().set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('refuse un token expiré avec un message dédié', async () => {
    const user = await createUser();
    const expired = jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: -10,
    });

    const res = await me().set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Votre session a expiré. Reconnectez-vous.');
  });

  it('donne accès avec un token valide et renvoie l’utilisateur courant', async () => {
    const user = await createUser({ name: 'Amel' });

    const res = await me().set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ _id: user._id.toString(), name: 'Amel' });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('refuse l’accès si le compte a été supprimé depuis la connexion', async () => {
    const user = await createUser();
    const headers = authHeader(user);
    await User.deleteOne({ _id: user._id });

    const res = await me().set(headers);

    expect(res.status).toBe(401);
  });

  it('refuse l’accès si le compte a été suspendu depuis la connexion (403)', async () => {
    const user = await createUser();
    const headers = authHeader(user);
    await User.updateOne({ _id: user._id }, { status: 'suspendu' });

    const res = await me().set(headers);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Votre compte est suspendu. Contactez l'administrateur.");
  });
});
