import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { User } from '../src/models/index.js';

const validProvider = {
  name: 'Nour Ben Salem',
  email: 'nour@example.com',
  password: 'motdepasse1',
  role: 'prestataire',
  provider: {
    businessName: 'Nour Évasions',
    activityType: 'hebergement',
    city: 'Djerba',
    phone: '+216 75 123 456',
  },
};

const register = (body) => request(app).post('/api/auth/register').send(body);

describe('US1.2 — POST /api/auth/register (prestataire)', () => {
  it('crée un compte prestataire avec ses informations d’activité', async () => {
    const res = await register(validProvider);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'Nour Ben Salem',
      email: 'nour@example.com',
      role: 'prestataire',
      status: 'actif',
      provider: validProvider.provider,
    });
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('profile');

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.role).toBe('prestataire');

    const saved = await User.findById(res.body.user._id);
    expect(saved.provider.businessName).toBe('Nour Évasions');
  });

  it('refuse l’inscription si les informations d’activité sont absentes', async () => {
    const { provider, ...withoutProvider } = validProvider;

    const res = await register(withoutProvider);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { field: 'provider.businessName', message: 'Le nom commercial est obligatoire.' },
        { field: 'provider.activityType', message: "Le type d'activité est obligatoire." },
        { field: 'provider.city', message: 'La ville est obligatoire.' },
        { field: 'provider.phone', message: 'Le numéro de téléphone est obligatoire.' },
      ]),
    );
    expect(await User.countDocuments()).toBe(0);
  });

  it.each(['businessName', 'activityType', 'city', 'phone'])(
    'refuse l’inscription si provider.%s manque',
    async (field) => {
      const provider = { ...validProvider.provider };
      delete provider[field];

      const res = await register({ ...validProvider, provider });

      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual([`provider.${field}`]);
    },
  );

  it('refuse des champs vides (espaces uniquement)', async () => {
    const res = await register({
      ...validProvider,
      provider: { ...validProvider.provider, businessName: '   ', city: '' },
    });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['provider.businessName', 'provider.city']));
  });

  it('refuse un type d’activité inconnu et un téléphone invalide', async () => {
    const res = await register({
      ...validProvider,
      provider: { ...validProvider.provider, activityType: 'casino', phone: 'abc' },
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        {
          field: 'provider.activityType',
          message:
            "Type d'activité invalide : choisissez hebergement, restaurant, activite, evenement, guide.",
        },
        { field: 'provider.phone', message: "Le numéro de téléphone n'est pas valide." },
      ]),
    );
  });

  it('refuse un rôle inconnu avec un message clair', async () => {
    const res = await register({ ...validProvider, role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'role', message: 'Rôle invalide : choisissez voyageur ou prestataire.' },
    ]);
  });

  it('applique aussi l’unicité de l’e-mail aux prestataires', async () => {
    await register(validProvider);

    const res = await register({ ...validProvider, email: 'NOUR@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cette adresse e-mail est déjà utilisée.');
  });

  it('n’enregistre pas d’informations prestataire pour un voyageur', async () => {
    const res = await register({
      name: 'Amel',
      email: 'amel@example.com',
      password: 'motdepasse1',
      profile: 'touriste',
      provider: validProvider.provider,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('voyageur');
    expect(res.body.user).not.toHaveProperty('provider');
  });
});

describe('Modèle User — prestataire', () => {
  it('exige les informations d’activité même hors de l’API', async () => {
    const user = new User({
      name: 'X',
      email: 'x@example.com',
      password: 'motdepasse1',
      role: 'prestataire',
    });

    await expect(user.validate()).rejects.toThrow(/nom commercial est obligatoire/);
  });
});
