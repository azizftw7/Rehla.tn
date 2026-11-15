import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';
import { Destination, Favorite, Offer, Review, Service } from '../src/models/index.js';
import { publicIdFromUrl } from '../src/utils/upload.js';
import { authHeader, createUser } from './helpers.js';

// Cloudinary simulé : aucun appel réseau, aucune clé nécessaire.
const { uploadStream, destroy } = vi.hoisted(() => ({ uploadStream: vi.fn(), destroy: vi.fn() }));
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  cloudinary: { uploader: { upload_stream: uploadStream, destroy } },
}));

const URL = '/api/provider/services';
const CLOUD = 'https://res.cloudinary.com/demo/image/upload';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const OLD_PHOTOS = [
  `${CLOUD}/v1/rehla/services/ancienne-1.png`,
  `${CLOUD}/v1/rehla/services/ancienne-2.png`,
  'https://images.example.com/seed.jpg',
];

let destination;
let otherDestination;
let owner;
let otherProvider;
let service;
let uploadCount;

beforeEach(async () => {
  uploadCount = 0;
  uploadStream.mockReset();
  uploadStream.mockImplementation((options, callback) => ({
    end: () => {
      uploadCount += 1;
      callback(null, { secure_url: `${CLOUD}/v2/${options.folder}/nouvelle-${uploadCount}.png` });
    },
  }));
  destroy.mockReset();
  destroy.mockResolvedValue({ result: 'ok' });

  [destination, otherDestination] = await Destination.create([
    {
      name: 'Djerba',
      region: 'Médenine',
      location: { type: 'Point', coordinates: [10.86, 33.88] },
    },
    { name: 'Tozeur', region: 'Tozeur', location: { type: 'Point', coordinates: [8.13, 33.92] } },
  ]);
  owner = await createUser({ role: 'prestataire' });
  otherProvider = await createUser({ role: 'prestataire' });
  service = await Service.create({
    type: 'restaurant',
    name: 'Le Jasmin Bleu',
    destination: destination._id,
    provider: owner._id,
    location: { type: 'Point', coordinates: [10.858, 33.876] },
    price: { amount: 40, unit: 'repas' },
    cuisine: 'Tunisienne',
    photos: OLD_PHOTOS,
  });
});

const serviceUrl = (id = service._id) => `${URL}/${id}`;

/** PUT multipart (les tableaux deviennent des champs répétés). */
function put(user, fields = {}, files = [], id = service._id) {
  let req = request(app).put(serviceUrl(id));
  if (user) req = req.set(authHeader(user));
  for (const [key, value] of Object.entries(fields)) {
    for (const item of [].concat(value)) req = req.field(key, String(item));
  }
  for (const filename of files) {
    req = req.attach('photos', PNG, { filename, contentType: 'image/png' });
  }
  return req;
}

const restaurantFields = () => ({
  type: 'restaurant',
  name: 'Le Jasmin Bleu — terrasse',
  description: 'Nouvelle carte.',
  destination: destination._id.toString(),
  latitude: '33.877',
  longitude: '10.859',
  price: '45',
  priceUnit: 'repas',
  cuisine: 'Fruits de mer',
  keptPhotos: OLD_PHOTOS,
});

const fieldsOf = (res) => res.body.details.map((d) => d.field);

describe('US6.2 — accès aux services du prestataire', () => {
  it.each([
    ['GET', ''],
    ['GET', '/:id'],
    ['PUT', '/:id'],
    ['PATCH', '/:id/visibilite'],
    ['DELETE', '/:id'],
  ])('%s %s exige d’être connecté (401) et refuse un voyageur (403)', async (method, path) => {
    const voyageur = await createUser({ role: 'voyageur' });
    const url = `${URL}${path.replace(':id', service._id)}`;
    const verb = method.toLowerCase();

    const anonymous = await request(app)[verb](url);
    const traveller = await request(app)[verb](url).set(authHeader(voyageur));

    expect(anonymous.status).toBe(401);
    expect(traveller.status).toBe(403);
    expect(traveller.body.message).toBe('Accès réservé aux prestataires.');
  });

  it('répond 404 (et non 403) quand un prestataire vise le service d’un autre', async () => {
    const auth = authHeader(otherProvider);

    const responses = await Promise.all([
      request(app).get(serviceUrl()).set(auth),
      put(otherProvider, restaurantFields()),
      request(app).patch(`${serviceUrl()}/visibilite`).set(auth).send({ hidden: true }),
      request(app).delete(serviceUrl()).set(auth),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Service introuvable.');
    }
    const unchanged = await Service.findById(service._id);
    expect(unchanged).toMatchObject({ name: 'Le Jasmin Bleu', hidden: false });
    expect(uploadStream).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('répond 404 pour un service inexistant et 400 pour un identifiant invalide', async () => {
    const missing = await request(app)
      .get(serviceUrl('64b000000000000000000000'))
      .set(authHeader(owner));
    const invalid = await request(app).get(serviceUrl('abc')).set(authHeader(owner));

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
    expect(invalid.body.details).toEqual([
      { field: 'id', message: 'Identifiant de service invalide.' },
    ]);
  });
});

describe('US6.2 — GET /api/provider/services', () => {
  it('liste uniquement ses services, masqués compris, du plus récent au plus ancien', async () => {
    const hidden = await Service.create({
      type: 'activite',
      name: 'Balade en felouque',
      destination: destination._id,
      provider: owner._id,
      location: { type: 'Point', coordinates: [10.85, 33.87] },
      free: true,
      activityCategory: 'Plage',
      hidden: true,
    });
    await Service.create({
      type: 'activite',
      name: 'Service d’un autre',
      destination: destination._id,
      provider: otherProvider._id,
      location: { type: 'Point', coordinates: [10.85, 33.87] },
      free: true,
    });

    const res = await request(app).get(URL).set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 1, pages: 1 });
    expect(res.body.items.map((item) => item.name)).toEqual([hidden.name, service.name]);
    expect(res.body.items[0]).toMatchObject({ hidden: true, destination: { name: 'Djerba' } });
  });

  it('pagine avec ?page et ?limit, et valide ces paramètres', async () => {
    const res = await request(app).get(`${URL}?page=2&limit=1`).set(authHeader(owner));
    const invalid = await request(app).get(`${URL}?limit=500`).set(authHeader(owner));

    expect(res.body).toMatchObject({ items: [], total: 1, page: 2, pages: 1 });
    expect(invalid.status).toBe(400);
    expect(fieldsOf(invalid)).toEqual(['limit']);
  });
});

describe('US6.2 — GET /api/provider/services/:id', () => {
  it('renvoie son service, même masqué, avec la destination', async () => {
    await Service.updateOne({ _id: service._id }, { hidden: true });

    const res = await request(app).get(serviceUrl()).set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({
      name: 'Le Jasmin Bleu',
      hidden: true,
      photos: OLD_PHOTOS,
      destination: { _id: destination._id.toString(), name: 'Djerba' },
    });
  });
});

describe('US6.2 — PUT /api/provider/services/:id', () => {
  it('met à jour la fiche et garde les photos envoyées par le front', async () => {
    const res = await put(owner, restaurantFields());

    expect(res.status).toBe(200);
    expect(res.body.service).toMatchObject({
      name: 'Le Jasmin Bleu — terrasse',
      cuisine: 'Fruits de mer',
      price: { amount: 45, unit: 'repas' },
      location: { coordinates: [10.859, 33.877] },
      photos: OLD_PHOTOS,
      provider: owner._id.toString(),
    });
    expect(uploadStream).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('ajoute les nouvelles photos après celles gardées et supprime les retirées sur Cloudinary', async () => {
    const res = await put(
      owner,
      { ...restaurantFields(), keptPhotos: [OLD_PHOTOS[1], OLD_PHOTOS[2]] },
      ['a.png', 'b.png'],
    );

    expect(res.status).toBe(200);
    expect(res.body.service.photos).toEqual([
      OLD_PHOTOS[1],
      OLD_PHOTOS[2],
      `${CLOUD}/v2/rehla/services/nouvelle-1.png`,
      `${CLOUD}/v2/rehla/services/nouvelle-2.png`,
    ]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledWith('rehla/services/ancienne-1', { resource_type: 'image' });
  });

  it('retire toutes les anciennes photos quand keptPhotos est absent', async () => {
    const { keptPhotos: _omit, ...fields } = restaurantFields();

    const res = await put(owner, fields);

    expect(res.status).toBe(200);
    expect(res.body.service.photos).toEqual([]);
    // La photo hébergée ailleurs (seed) n'est pas envoyée à Cloudinary.
    expect(destroy.mock.calls.map(([publicId]) => publicId)).toEqual([
      'rehla/services/ancienne-1',
      'rehla/services/ancienne-2',
    ]);
  });

  it('ignore une photo « gardée » qui n’appartient pas au service', async () => {
    const res = await put(owner, {
      ...restaurantFields(),
      keptPhotos: [OLD_PHOTOS[0], 'https://pirate.example.com/x.png'],
    });

    expect(res.body.service.photos).toEqual([OLD_PHOTOS[0]]);
  });

  it('change de type et efface les champs de l’ancien type', async () => {
    const res = await put(owner, {
      type: 'guide',
      name: 'Slim, guide',
      destination: otherDestination._id.toString(),
      latitude: '33.92',
      longitude: '8.13',
      free: 'true',
      languages: 'français, arabe',
    });

    expect(res.status).toBe(200);
    const saved = await Service.findById(service._id).lean();
    expect(saved).toMatchObject({ type: 'guide', free: true, languages: ['français', 'arabe'] });
    expect(saved.destination.toString()).toBe(otherDestination._id.toString());
    expect(saved.cuisine).toBeUndefined();
    expect(saved.price).toBeUndefined();
  });

  it('conserve l’état masqué et les notes du service', async () => {
    await Service.updateOne({ _id: service._id }, { hidden: true, ratingAverage: 4.5 });

    const res = await put(owner, restaurantFields());

    expect(res.body.service).toMatchObject({ hidden: true, ratingAverage: 4.5 });
  });

  it('applique les mêmes validations que la création (400) sans rien modifier', async () => {
    const res = await put(
      owner,
      { type: 'evenement', name: '', price: '-5', website: 'pas-une-url', latitude: '48.8' },
      ['a.png'],
    );

    expect(res.status).toBe(400);
    expect(fieldsOf(res)).toEqual(
      expect.arrayContaining([
        'name',
        'destination',
        'latitude',
        'longitude',
        'price',
        'website',
        'startDate',
      ]),
    );
    expect(uploadStream).not.toHaveBeenCalled();
    expect((await Service.findById(service._id)).name).toBe('Le Jasmin Bleu');
  });

  it('refuse une destination inexistante', async () => {
    const res = await put(owner, {
      ...restaurantFields(),
      destination: '64b000000000000000000000',
    });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'destination', message: 'Cette destination est introuvable.' },
    ]);
  });

  it('refuse plus de 5 photos au total (gardées + nouvelles)', async () => {
    const res = await put(owner, restaurantFields(), ['a.png', 'b.png', 'c.png']);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'photos', message: 'Un service peut avoir au plus 5 photos.' },
    ]);
    expect(uploadStream).not.toHaveBeenCalled();
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const res = await request(app)
      .put(serviceUrl())
      .set(authHeader(owner))
      .field('name', 'X')
      .attach('photos', Buffer.from('%PDF'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Format de photo non accepté.');
  });

  it('renvoie 503 si Cloudinary est indisponible, sans modifier la fiche', async () => {
    uploadStream.mockImplementation((_options, callback) => ({
      end: () => callback(new Error('timeout')),
    }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await put(owner, restaurantFields(), ['a.png']);

    expect(res.status).toBe(503);
    const unchanged = await Service.findById(service._id);
    expect(unchanged.name).toBe('Le Jasmin Bleu');
    expect(unchanged.photos).toEqual(OLD_PHOTOS);
    spy.mockRestore();
  });

  it('enregistre la fiche même si la suppression d’une ancienne photo échoue', async () => {
    destroy.mockRejectedValue(new Error('timeout'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await put(owner, { ...restaurantFields(), keptPhotos: [] });

    expect(res.status).toBe(200);
    expect(res.body.service.photos).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('US6.2 — PATCH /api/provider/services/:id/visibilite', () => {
  const patch = (user, body) =>
    request(app).patch(`${serviceUrl()}/visibilite`).set(authHeader(user)).send(body);

  it('masque puis réaffiche le service (et le catalogue public suit)', async () => {
    const hiddenRes = await patch(owner, { hidden: true });

    expect(hiddenRes.status).toBe(200);
    expect(hiddenRes.body.service.hidden).toBe(true);
    expect((await request(app).get(`/api/services/${service._id}`)).status).toBe(404);
    expect((await request(app).get('/api/services')).body.total).toBe(0);

    const shownRes = await patch(owner, { hidden: false });

    expect(shownRes.body.service.hidden).toBe(false);
    expect((await request(app).get(`/api/services/${service._id}`)).status).toBe(200);
  });

  it.each([[{}], [{ hidden: 'oui' }]])('refuse un corps invalide %j (400)', async (body) => {
    const res = await patch(owner, body);

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([
      {
        field: 'hidden',
        message: 'Indiquez si le service doit être masqué (true) ou affiché (false).',
      },
    ]);
  });
});

describe('US6.2 — DELETE /api/provider/services/:id', () => {
  it('supprime le service, ses offres, avis, favoris et ses photos Cloudinary (204)', async () => {
    const voyageur = await createUser({ role: 'voyageur' });
    const now = Date.now();
    await Offer.create({
      service: service._id,
      title: 'Menu du jour',
      discountPercent: 10,
      startDate: new Date(now - 86400000),
      endDate: new Date(now + 86400000),
    });
    await Review.create({ service: service._id, author: voyageur._id, rating: 5 });
    await Favorite.create({ service: service._id, user: voyageur._id });

    const res = await request(app).delete(serviceUrl()).set(authHeader(owner));

    expect(res.status).toBe(204);
    expect(await Service.exists({ _id: service._id })).toBeNull();
    expect(await Offer.countDocuments()).toBe(0);
    expect(await Review.countDocuments()).toBe(0);
    expect(await Favorite.countDocuments()).toBe(0);
    expect(destroy.mock.calls.map(([publicId]) => publicId)).toEqual([
      'rehla/services/ancienne-1',
      'rehla/services/ancienne-2',
    ]);

    const again = await request(app).delete(serviceUrl()).set(authHeader(owner));
    expect(again.status).toBe(404);
  });
});

describe('publicIdFromUrl', () => {
  it('extrait l’identifiant des photos Rehla.tn uniquement', () => {
    expect(publicIdFromUrl(`${CLOUD}/v17/rehla/services/abc.jpg`)).toBe('rehla/services/abc');
    expect(publicIdFromUrl(`${CLOUD}/rehla/services/abc.webp`)).toBe('rehla/services/abc');
    expect(publicIdFromUrl(`${CLOUD}/v1/autre-dossier/abc.jpg`)).toBeNull();
    expect(publicIdFromUrl('https://images.example.com/rehla/services/abc.jpg')).toBeNull();
    expect(publicIdFromUrl(undefined)).toBeNull();
  });
});
