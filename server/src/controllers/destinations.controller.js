import { Destination, Service, Transport } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex, normalizeText } from '../utils/text.js';

/**
 * Identifiants des destinations qui proposent au moins un des types demandés :
 * un service visible de ce type, ou un transport pour « transport ».
 */
async function destinationIdsOffering(types) {
  const serviceTypes = types.filter((type) => type !== 'transport');
  const [fromServices, fromTransports] = await Promise.all([
    serviceTypes.length > 0
      ? Service.distinct('destination', { hidden: false, type: { $in: serviceTypes } })
      : [],
    types.includes('transport')
      ? Transport.distinct('destination', { destination: { $ne: null } })
      : [],
  ]);
  return [...fromServices, ...fromTransports];
}

/**
 * GET /api/destinations?search=&types=&page=&limit=
 * Recherche par nom partiel, insensible à la casse et aux accents (« ain » trouve « Aïn Draham »).
 * types (facultatif) : ne garde que les destinations qui proposent au moins un de ces types.
 */
export async function listDestinations(req, res) {
  const { search, types, page, limit } = req.validated.query;

  const filter = {};
  const term = normalizeText(search);
  if (term) {
    filter.nameNormalized = { $regex: escapeRegex(term) };
  }
  if (types?.length) {
    filter._id = { $in: await destinationIdsOffering(types) };
  }

  res.json(await paginate(Destination, filter, { page, limit, sort: { nameNormalized: 1 } }));
}

/** GET /api/destinations/:slug */
export async function getDestination(req, res) {
  const destination = await Destination.findOne({ slug: req.validated.params.slug });
  if (!destination) {
    throw ApiError.notFound('Destination introuvable.');
  }
  res.json({ destination });
}
