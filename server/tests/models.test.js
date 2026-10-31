import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import {
  Destination,
  Favorite,
  Offer,
  Review,
  Service,
  TripShare,
  User,
} from '../src/models/index.js';

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

async function createFixtures() {
  const provider = await User.create({
    name: 'Prestataire',
    email: 'presta@example.com',
    password: 'motdepasse1',
    role: 'prestataire',
    provider: {
      businessName: 'Maison Test',
      activityType: 'hebergement',
      city: 'Tozeur',
      phone: '+216 70 000 000',
    },
  });
  const traveler = await User.create({
    name: 'Voyageur',
    email: 'voyageur@example.com',
    password: 'motdepasse1',
    profile: 'touriste',
  });
  const destination = await Destination.create({
    name: 'Aïn Draham',
    region: 'Jendouba',
    location: point(8.6869, 36.7792),
  });
  const service = await Service.create({
    type: 'hebergement',
    name: 'Gîte de test',
    destination: destination._id,
    provider: provider._id,
    location: point(8.69, 36.78),
    price: { amount: 120, unit: 'nuit' },
  });
  return { provider, traveler, destination, service };
}

describe('User', () => {
  it('hache le mot de passe, met l’e-mail en minuscules et ne renvoie jamais le mot de passe', async () => {
    const user = await User.create({
      name: 'Sami',
      email: '  Sami@Example.COM ',
      password: 'motdepasse1',
    });

    expect(user.email).toBe('sami@example.com');
    expect(user.role).toBe('voyageur');
    expect(user.status).toBe('actif');
    expect(user.password).not.toBe('motdepasse1');
    expect(user.toJSON()).not.toHaveProperty('password');

    const fromDb = await User.findById(user._id);
    expect(fromDb.password).toBeUndefined();

    const withPassword = await User.findById(user._id).select('+password');
    expect(await withPassword.comparePassword('motdepasse1')).toBe(true);
    expect(await withPassword.comparePassword('mauvais')).toBe(false);
  });

  it('refuse un e-mail déjà utilisé, quelle que soit la casse', async () => {
    await User.create({ name: 'A', email: 'a@example.com', password: 'motdepasse1' });

    await expect(
      User.create({ name: 'B', email: 'A@EXAMPLE.COM', password: 'motdepasse1' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe('Destination', () => {
  it('génère le slug et le nom normalisé sans accents', async () => {
    const destination = await Destination.create({
      name: 'Sidi Bou Saïd',
      region: 'Tunis',
      location: point(10.3417, 36.8687),
    });

    expect(destination.slug).toBe('sidi-bou-said');
    expect(destination.nameNormalized).toBe('sidi bou said');
  });

  it('refuse des coordonnées hors limites', async () => {
    const destination = new Destination({ name: 'X', region: 'Y', location: point(10, 120) });

    await expect(destination.validate()).rejects.toThrow(/Coordonnées invalides/);
  });

  it('déclare un index 2dsphere sur location', async () => {
    const indexes = await Destination.collection.indexes();

    expect(indexes.some((index) => index.key.location === '2dsphere')).toBe(true);
  });
});

describe('Service', () => {
  it('exige un prix ou free = true', async () => {
    const { service } = await createFixtures();
    service.price = undefined;

    await expect(service.validate()).rejects.toThrow(/Indiquez un prix/);

    service.free = true;
    await expect(service.validate()).resolves.toBeUndefined();
  });

  it('exige une date de début pour un événement', async () => {
    const { service } = await createFixtures();
    service.type = 'evenement';

    await expect(service.validate()).rejects.toThrow(/date de début de l'événement/);
  });
});

describe('Offer', () => {
  it('exige soit un pourcentage, soit un prix réduit', async () => {
    const { service } = await createFixtures();
    const base = {
      service: service._id,
      title: 'Promo',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    };

    await expect(new Offer(base).validate()).rejects.toThrow(/pourcentage de réduction/);
    await expect(
      new Offer({ ...base, discountPercent: 10, discountedPrice: 90 }).validate(),
    ).rejects.toThrow(/pas les deux/);
    await expect(new Offer({ ...base, discountPercent: 10 }).validate()).resolves.toBeUndefined();
  });
});

describe('Review', () => {
  it('refuse une note hors de 1 à 5', async () => {
    const { service, traveler } = await createFixtures();

    await expect(
      Review.create({ service: service._id, author: traveler._id, rating: 6 }),
    ).rejects.toThrow(/entre 1 et 5/);
  });

  it('n’autorise qu’un avis par voyageur et par service', async () => {
    const { service, traveler } = await createFixtures();
    await Review.create({ service: service._id, author: traveler._id, rating: 4 });

    await expect(
      Review.create({ service: service._id, author: traveler._id, rating: 5 }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('met à jour la note moyenne et le nombre d’avis du service', async () => {
    const { service, traveler, provider } = await createFixtures();
    await Review.create({ service: service._id, author: traveler._id, rating: 4 });
    const second = await Review.create({ service: service._id, author: provider._id, rating: 5 });

    let updated = await Service.findById(service._id);
    expect(updated.ratingAverage).toBe(4.5);
    expect(updated.ratingCount).toBe(2);

    await second.deleteOne();
    updated = await Service.findById(service._id);
    expect(updated.ratingAverage).toBe(4);
    expect(updated.ratingCount).toBe(1);
  });
});

describe('Favorite', () => {
  it('refuse deux fois le même couple utilisateur / service', async () => {
    const { service, traveler } = await createFixtures();
    await Favorite.create({ user: traveler._id, service: service._id });

    await expect(
      Favorite.create({ user: traveler._id, service: service._id }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe('TripShare', () => {
  it('limite le message à 200 caractères', async () => {
    const { traveler, destination } = await createFixtures();
    const share = new TripShare({
      user: traveler._id,
      destination: destination._id,
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      message: 'a'.repeat(201),
    });

    await expect(share.validate()).rejects.toThrow(/200 caractères/);
  });

  it('expire le lendemain de la date de retour grâce à un index TTL', async () => {
    const { traveler, destination } = await createFixtures();
    const share = await TripShare.create({
      user: traveler._id,
      destination: destination._id,
      startDate: '2026-12-01T00:00:00Z',
      endDate: '2026-12-05T00:00:00Z',
    });

    expect(share.expiresAt.toISOString()).toBe('2026-12-06T00:00:00.000Z');
    expect(share.visible.toObject()).toEqual({
      profile: true,
      city: false,
      languages: false,
      photo: false,
    });

    const indexes = await TripShare.collection.indexes();
    const ttl = indexes.find((index) => index.key.expiresAt === 1);
    expect(ttl.expireAfterSeconds).toBe(0);
  });

  it('refuse une date de retour antérieure au départ', async () => {
    const { traveler, destination } = await createFixtures();
    const share = new TripShare({
      user: traveler._id,
      destination: destination._id,
      startDate: '2026-12-05',
      endDate: '2026-12-01',
    });

    await expect(share.validate()).rejects.toThrow(/postérieure à la date de départ/);
  });
});

describe('Connexion de test', () => {
  it('utilise une base en mémoire', () => {
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/);
    expect(mongoose.connection.name).toMatch(/^test-/);
  });
});
