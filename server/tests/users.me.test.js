import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/index.js';
import { authHeader, createUser, TEST_PASSWORD } from './helpers.js';

const updateMe = (user, body) => request(app).put('/api/users/me').set(authHeader(user)).send(body);
const changePassword = (user, body) =>
  request(app).put('/api/users/me/password').set(authHeader(user)).send(body);
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('US1.5 — GET /api/users/me', () => {
  it('renvoie le profil de l’utilisateur connecté, sans mot de passe', async () => {
    const prestataire = await createUser({ role: 'prestataire', name: 'Nour' });

    const res = await request(app).get('/api/users/me').set(authHeader(prestataire));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Nour', role: 'prestataire' });
    expect(res.body.user.provider.businessName).toBe('Maison Test');
    expect(res.body.user).not.toHaveProperty('password');
  });
});

describe('US1.5 — PUT /api/users/me', () => {
  it('met à jour le profil et renvoie l’utilisateur modifié', async () => {
    const user = await createUser({ profile: 'touriste' });

    const res = await updateMe(user, {
      name: '  Amel Trabelsi ',
      email: 'Nouvel.Email@Example.com',
      profile: 'resident',
      avatarUrl: 'https://example.com/amel.png',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Amel Trabelsi',
      email: 'nouvel.email@example.com',
      profile: 'resident',
      avatarUrl: 'https://example.com/amel.png',
    });
    expect(res.body.user).not.toHaveProperty('password');

    const saved = await User.findById(user._id);
    expect(saved.email).toBe('nouvel.email@example.com');
    expect(saved.profile).toBe('resident');
  });

  it('refuse un e-mail déjà pris par un autre compte (409)', async () => {
    await createUser({ email: 'pris@example.com' });
    const user = await createUser({ email: 'moi@example.com' });

    const res = await updateMe(user, { email: 'PRIS@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cette adresse e-mail est déjà utilisée.');
    expect((await User.findById(user._id)).email).toBe('moi@example.com');
  });

  it('accepte de renvoyer son propre e-mail inchangé', async () => {
    const user = await createUser({ email: 'moi@example.com' });

    const res = await updateMe(user, { email: 'moi@example.com', name: 'Moi' });

    expect(res.status).toBe(200);
  });

  it('ne modifie ni le rôle, ni le statut, ni le mot de passe', async () => {
    const user = await createUser({ email: 'moi@example.com' });

    const res = await updateMe(user, {
      name: 'Pirate',
      role: 'admin',
      status: 'suspendu',
      password: 'nouveau-mdp-1',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Pirate', role: 'voyageur', status: 'actif' });
    expect((await login('moi@example.com', TEST_PASSWORD)).status).toBe(200);
  });

  it('supprime la photo avec une chaîne vide', async () => {
    const user = await createUser({ avatarUrl: 'https://example.com/a.png' });

    const res = await updateMe(user, { avatarUrl: '' });

    expect(res.status).toBe(200);
    expect(res.body.user).not.toHaveProperty('avatarUrl');
  });

  it('refuse une URL de photo qui n’est pas en http(s)', async () => {
    const user = await createUser();

    const res = await updateMe(user, { avatarUrl: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      {
        field: 'avatarUrl',
        message: "L'URL de la photo doit commencer par http:// ou https://.",
      },
    ]);
  });

  it('refuse une requête sans modification', async () => {
    const user = await createUser();

    const res = await updateMe(user, {});

    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe('Aucune modification à enregistrer.');
  });

  it('refuse un nom trop court', async () => {
    const user = await createUser();

    const res = await updateMe(user, { name: 'A' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('name');
  });

  it('permet à un prestataire de modifier une partie de son activité', async () => {
    const prestataire = await createUser({ role: 'prestataire' });

    const res = await updateMe(prestataire, { provider: { city: 'Djerba' } });

    expect(res.status).toBe(200);
    expect(res.body.user.provider).toEqual({
      businessName: 'Maison Test',
      activityType: 'hebergement',
      city: 'Djerba',
      phone: '+216 70 000 000',
    });
  });

  it('refuse un profil voyageur sur un compte prestataire, et inversement', async () => {
    const prestataire = await createUser({ role: 'prestataire' });
    const voyageur = await createUser();

    const res1 = await updateMe(prestataire, { profile: 'etudiant' });
    const res2 = await updateMe(voyageur, { provider: { city: 'Djerba' } });

    expect(res1.status).toBe(400);
    expect(res1.body.details[0].field).toBe('profile');
    expect(res2.status).toBe(400);
    expect(res2.body.details[0].field).toBe('provider');
  });

  it('exige d’être connecté (401)', async () => {
    const res = await request(app).put('/api/users/me').send({ name: 'X' });

    expect(res.status).toBe(401);
  });
});

describe('US1.5 — PUT /api/users/me/password', () => {
  it('change le mot de passe quand l’ancien est correct', async () => {
    const user = await createUser({ email: 'moi@example.com' });

    const res = await changePassword(user, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'nouveau-mdp-1',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Votre mot de passe a été modifié.' });
    expect((await login('moi@example.com', 'nouveau-mdp-1')).status).toBe(200);
    expect((await login('moi@example.com', TEST_PASSWORD)).status).toBe(401);
  });

  it('refuse si l’ancien mot de passe est incorrect', async () => {
    const user = await createUser({ email: 'moi@example.com' });

    const res = await changePassword(user, {
      currentPassword: 'mauvais-mdp',
      newPassword: 'nouveau-mdp-1',
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'currentPassword', message: 'Le mot de passe actuel est incorrect.' },
    ]);
    expect((await login('moi@example.com', TEST_PASSWORD)).status).toBe(200);
  });

  it('refuse un nouveau mot de passe trop court ou identique à l’ancien', async () => {
    const user = await createUser();

    const tooShort = await changePassword(user, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'court',
    });
    const same = await changePassword(user, {
      currentPassword: TEST_PASSWORD,
      newPassword: TEST_PASSWORD,
    });

    expect(tooShort.status).toBe(400);
    expect(tooShort.body.details[0]).toEqual({
      field: 'newPassword',
      message: 'Le mot de passe doit contenir au moins 8 caractères.',
    });
    expect(same.status).toBe(400);
    expect(same.body.details[0].message).toBe(
      "Le nouveau mot de passe doit être différent de l'ancien.",
    );
  });

  it('exige d’être connecté (401)', async () => {
    const res = await request(app)
      .put('/api/users/me/password')
      .send({ currentPassword: 'a', newPassword: 'nouveau-mdp-1' });

    expect(res.status).toBe(401);
  });
});
