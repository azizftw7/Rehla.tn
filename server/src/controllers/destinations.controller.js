import { Destination } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex, normalizeText } from '../utils/text.js';

/**
 * GET /api/destinations?search=&page=&limit=
 * Recherche par nom partiel, insensible à la casse et aux accents (« ain » trouve « Aïn Draham »).
 */
export async function listDestinations(req, res) {
  const { search, page, limit } = req.validated.query;

  const filter = {};
  const term = normalizeText(search);
  if (term) {
    filter.nameNormalized = { $regex: escapeRegex(term) };
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
