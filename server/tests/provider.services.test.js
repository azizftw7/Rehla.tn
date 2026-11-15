import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { Destination, Service } from '../src/models/index.js';
import { authHeader, createUser } from './helpers.js';

// Cloudinary simulé : aucun appel réseau, aucune clé nécessaire.
const { uploadStream } = vi.hoisted(() => ({ uploadStream: vi.fn() }));
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: { uploader: { upload_stream: uploadStream } },
}));

const URL = '/api/provider/services';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let destination;
let prestataire;
let uploadCount;

beforeEach(async () => {
  uploadCount = 0;
  uploadStream.mockReset();
  uploadStream.mockImplementation((options, callback) => ({
    end: () => {
      uploadCount += 1;
      callback(null, {
        secure_url: `https://res.cloudinary.com/demo/image/upload/${options.folder}/photo-${uploadCount}.png`,
      });
    },
  }));

  destination = await Destination.create({
    name: 'Djerba',
    region: 'Médenine',
    location: { type: 'Point', coordinates: [10.8575, 33.8758] },
  });
  prestataire = await createUser({ role: 'prestataire' });
});

/** Requête multipart avec les champs donnés (les tableaux deviennent des champs répétés). */
function post(user, fields = {}, files = []) {
  let req = request(app).post(URL);
  if (user) req = req.set(authHeader(user));
  for (const [key, value] of Object.entries(fields)) {
    for (const item of [].concat(value)) req = req.field(key, String(item));
  }
  for (const file of files) {
    req = req.attach('photos', file.buffer ?? PNG, {
      filename: file.filename,
      contentType: file.contentType,
    });
  }
  return req;
}

const restaurant = () => ({
  type: 'restaurant',
  name: 'Le Jasmin Bleu',
  description: 'Cuisine tunisienne en terrasse.',
  destination: destination._id.toString(),
  address: 'Houmt Souk, Djerba',
  latitude: '33.876',
  longitude: '10.858',
  price: '40',
  priceUnit: 'repas',
  phone: '+216 75 000 000',
  website: 'https://example.com/jasmin',
  cuisine: 'Tunisienne',
});

const png = (filename = 'photo.png') => ({ filename, contentType: 'image/png' });
const fieldsOf = (res) => res.body.details.map((d) => d.field);

describe('US6.1 — POST /api/provider/services : accès', () => {
  it('exige d’être connecté (401)', async () => {
    const res = await post(null, restaurant());

    expect(res.status).toBe(401);
    expect(await Service.countDocuments()).toBe(0);
  });

  it('refuse un voyageur (403)', async () => {
    const voyageur = await createUser({ role: 'voyageur' });

    const res = await post(voyageur, restaurant(), [png()]);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Accès réservé aux prestataires.');
    expect(uploadStream).not.toHaveBeenCalled();
  });
});

describe('US6.1 — POST /api/provider/services : création', () => {
  it('crée le service avec ses photos (201)', async () => {
    const res = await post(prestataire, restaurant(), [png('a.png'), png('b.png')]);

    expect(res.status).toBe(201);
    const { service } = res.body;
    expect(service).toMatchObject({
      type: 'restaurant',
      name: 'Le Jasmin Bleu',
      cuisine: 'Tunisienne',
      free: false,
      price: { amount: 40, unit: 'repas' },
      contact: { phone: '+216 75 000 000', website: 'https://example.com/jasmin' },
      location: { type: 'Point', coordinates: [10.858, 33.876] },
      destination: { _id: destination._id.toString(), name: 'Djerba' },
      provider: prestataire._id.toString(),
    });
    expect(service.photos).toEqual([
      'https://res.cloudinary.com/demo/image/upload/rehla/services/photo-1.png',
      'https://res.cloudinary.com/demo/image/upload/rehla/services/photo-2.png',
    ]);
    expect(uploadStream).toHaveBeenCalledTimes(2);
    expect(uploadStream.mock.calls[0][0]).toMatchObject({ folder: 'rehla/services' });

    const saved = await Service.findById(service._id);
    expect(saved.photos).toHaveLength(2);
  });

  it('accepte un service sans photo', async () => {
    const res = await post(prestataire, restaurant());

    expect(res.status).toBe(201);
    expect(res.body.service.photos).toEqual([]);
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it('prend le prestataire dans le token, jamais dans le body', async () => {
    const autre = await createUser({ role: 'prestataire' });

    const res = await post(prestataire, { ...restaurant(), provider: autre._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.service.provider).toBe(prestataire._id.toString());
  });

  it('crée un événement gratuit avec ses dates', async () => {
    const res = await post(prestataire, {
      type: 'evenement',
      name: 'Festival du jasmin',
      destination: destination._id.toString(),
      latitude: '33.87',
      longitude: '10.85',
      free: 'true',
      price: '',
      eventType: 'Festival',
      startDate: '2026-12-12',
      endDate: '2026-12-14',
      hours: '19h – 22h',
      cuisine: 'ignorée',
    });

    expect(res.status).toBe(201);
    const { service } = res.body;
    expect(service.free).toBe(true);
    expect(service.price).toBeUndefined();
    expect(service.cuisine).toBeUndefined();
    expect(service.event).toMatchObject({
      eventType: 'Festival',
      startDate: '2026-12-12T00:00:00.000Z',
      endDate: '2026-12-14T00:00:00.000Z',
      hours: '19h – 22h',
    });
  });

  it('crée un guide avec ses langues (champ répété ou liste à virgules)', async () => {
    const base = {
      type: 'guide',
      name: 'Slim, guide',
      destination: destination._id.toString(),
      latitude: '33.87',
      longitude: '10.85',
      price: '80',
    };

    const repeated = await post(prestataire, { ...base, languages: ['français', 'arabe'] });
    const commas = await post(prestataire, { ...base, languages: 'anglais, italien' });

    expect(repeated.status).toBe(201);
    expect(repeated.body.service.languages).toEqual(['français', 'arabe']);
    expect(commas.body.service.languages).toEqual(['anglais', 'italien']);
  });

  it('crée un hébergement avec son type et une vidéo', async () => {
    const res = await post(prestataire, {
      type: 'hebergement',
      name: 'Dar Yasmine',
      destination: destination._id.toString(),
      latitude: '33.87',
      longitude: '10.85',
      price: '150',
      priceUnit: 'nuit',
      accommodationType: 'dar',
      videoUrl: 'https://www.youtube.com/watch?v=abc',
    });

    expect(res.status).toBe(201);
    expect(res.body.service).toMatchObject({
      accommodationType: 'dar',
      videoUrl: 'https://www.youtube.com/watch?v=abc',
    });
  });
});

describe('US6.1 — POST /api/provider/services : données invalides (400)', () => {
  it('signale chaque champ obligatoire manquant', async () => {
    const res = await post(prestataire, { type: 'restaurant' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Données invalides.');
    expect(fieldsOf(res)).toEqual(
      expect.arrayContaining(['name', 'destination', 'latitude', 'longitude', 'price', 'cuisine']),
    );
    expect(await Service.countDocuments()).toBe(0);
  });

  it('refuse un type inconnu', async () => {
    const res = await post(prestataire, { ...restaurant(), type: 'transport' });

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain('type');
  });

  it.each([
    ['hebergement', 'accommodationType'],
    ['activite', 'activityCategory'],
    ['evenement', 'startDate'],
    ['guide', 'languages'],
  ])('exige les champs propres au type %s', async (type, field) => {
    const res = await post(prestataire, { ...restaurant(), type });

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toContain(field);
  });

  it('refuse une position hors de Tunisie', async () => {
    const res = await post(prestataire, { ...restaurant(), latitude: '48.85', longitude: '2.35' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(
      expect.arrayContaining([
        { field: 'latitude', message: 'La position doit se trouver en Tunisie.' },
      ]),
    );
  });

  it('refuse un prix négatif, une URL invalide et une fin avant le début', async () => {
    const res = await post(prestataire, {
      ...restaurant(),
      type: 'evenement',
      price: '-5',
      website: 'pas-une-url',
      startDate: '2026-12-14',
      endDate: '2026-12-12',
    });

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual(expect.arrayContaining(['price', 'website', 'endDate']));
  });

  it('refuse une destination inexistante', async () => {
    const res = await post(prestataire, {
      ...restaurant(),
      destination: '64b000000000000000000000',
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  });

  it('n’envoie aucune photo à Cloudinary si la fiche est invalide', async () => {
    const res = await post(prestataire, { ...restaurant(), name: '' }, [png()]);

    expect(res.status).toBe(400);
    expect(uploadStream).not.toHaveBeenCalled();
  });
});

describe('US6.1 — POST /api/provider/services : photos refusées (400)', () => {
  it('refuse un fichier qui n’est pas une image JPEG, PNG ou WebP', async () => {
    const res = await post(prestataire, restaurant(), [
      { filename: 'cv.pdf', contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Format de photo non accepté.');
    expect(res.body.details[0].field).toBe('photos');
    expect(await Service.countDocuments()).toBe(0);
  });

  it('refuse plus de 5 photos', async () => {
    const files = Array.from({ length: 6 }, (_, i) => png(`p${i}.png`));

    const res = await post(prestataire, restaurant(), files);

    expect(res.status).toBe(400);
    expect(res.body.details[0]).toMatchObject({ field: 'photos' });
    expect(res.body.message).toMatch(/au plus 5 photos/);
  });

  it('refuse une photo de plus de 5 Mo', async () => {
    const big = {
      filename: 'grande.jpg',
      contentType: 'image/jpeg',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    };

    const res = await post(prestataire, restaurant(), [big]);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Chaque photo doit peser au plus 5 Mo.');
  });
});

describe('US6.1 — POST /api/provider/services : Cloudinary indisponible', () => {
  it('renvoie 503 avec un message clair et ne crée rien', async () => {
    uploadStream.mockImplementation((_options, callback) => ({
      end: () => callback(new Error('timeout')),
    }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post(prestataire, restaurant(), [png()]);

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/envoi des photos est momentanément indisponible/);
    expect(await Service.countDocuments()).toBe(0);
    spy.mockRestore();
  });
});
