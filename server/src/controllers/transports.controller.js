import { Destination, Transport } from '../models/index.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * GET /api/transports?destination=<slug ou id>&type=&from=&page=&limit=
 * Moyens de transport pour rejoindre une destination, du moins cher au plus cher.
 */
export async function listTransports(req, res) {
  const { destination, type, from, page, limit } = req.validated.query;

  const filter = {};

  if (destination) {
    if (OBJECT_ID_REGEX.test(destination)) {
      filter.destination = destination;
    } else {
      const destDoc = await Destination.findOne({ slug: destination.toLowerCase() }).select('_id');
      if (!destDoc) {
        return res.json({ items: [], total: 0, page, pages: 0 });
      }
      filter.destination = destDoc._id;
    }
  }

  if (type) {
    filter.type = type;
  }

  // Ville de départ : recherche partielle, insensible à la casse (« tunis » trouve « Tunis Marine »).
  if (from) {
    filter.from = { $regex: escapeRegex(from), $options: 'i' };
  }

  const result = await paginate(Transport, filter, {
    page,
    limit,
    sort: { price: 1, duration: 1, _id: 1 },
    populate: { path: 'destination', select: 'name slug region' },
  });

  res.json(result);
}
