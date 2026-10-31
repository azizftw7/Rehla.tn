import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/index.js';

const validTraveler = {
  name: 'Amel Trabelsi',
  email: 'Amel@Example.com',
  password: 'motdepasse1',
  profile: 'etudiant',
};

const register = (body) => request(app).post('/api/auth/register').send(body);

describe('US1.1 — POST /api/auth/register (voyageur)', () => {
  it('inscrit un voyageur et renvoie un token pour la connexion automatique', async () => {
    const res = await register(validTraveler);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Amel Trabelsi',
      email: 'amel@example.com',
      role: 'voyageur',
      profile: 'etudiant',
      status: 'actif',
    });
    expect(res.body.user).not.toHaveProperty('password');

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: res.body.user._id, role: 'voyageur' });
  });

  it('enregistre le mot de passe haché', async () => {
    await register(validTraveler);

    const user = await User.findOne({ email: 'amel@example.com' }).select('+password');
    expect(user.password).not.toBe(validTraveler.password);
    expect(await user.comparePassword(validTraveler.password)).toBe(true);
  });

  it('refuse un e-mail déjà utilisé (409), quelle que soit la casse', async () => {
    await register(validTraveler);

    const res = await register({ ...validTraveler, email: 'AMEL@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cette adresse e-mail est déjà utilisée.');
    expect(res.body.details).toEqual([
      { field: 'email', message: 'Cette adresse e-mail est déjà utilisée.' },
    ]);
    expect(await User.countDocuments()).toBe(1);
  });

  it('refuse un mot de passe de moins de 8 caractères (400)', async () => {
    const res = await register({ ...validTraveler, password: 'court' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Données invalides.');
    expect(res.body.details).toContainEqual({
      field: 'password',
      message: 'Le mot de passe doit contenir au moins 8 caractères.',
    });
    expect(await User.countDocuments()).toBe(0);
  });

  it('liste tous les champs manquants avec des messages en français', async () => {
    const res = await register({});

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { field: 'name', message: 'Le nom est obligatoire.' },
        { field: 'email', message: "L'adresse e-mail est obligatoire." },
        { field: 'password', message: 'Le mot de passe est obligatoire.' },
        {
          field: 'profile',
          message: 'Le profil est obligatoire (etudiant, resident ou touriste).',
        },
      ]),
    );
  });

  it('refuse un e-mail mal formé et un profil inconnu', async () => {
    const res = await register({ ...validTraveler, email: 'pas-un-email', profile: 'pirate' });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'profile']));
  });

  it('ne permet pas de s’inscrire comme administrateur', async () => {
    const res = await register({ ...validTraveler, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('role');
    expect(await User.countDocuments()).toBe(0);
  });

  it('ignore les champs réservés comme le statut', async () => {
    const res = await register({ ...validTraveler, status: 'suspendu', avatarUrl: 'x' });

    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('actif');
  });
});
