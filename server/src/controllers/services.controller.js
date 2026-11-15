import { Destination, Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export async function listServices(req, res) {
  const {
    type,
    destination,
    search,
    cuisine,
    activityCategory,
    eventType,
    from,
    to,
    free,
    maxPrice,
    page,
    limit,
  } = req.validated.query;

  const filter = { hidden: false };

  if (type) {
    filter.type = type;
  }

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

  if (search) {
    const safeSearch = escapeRegex(search);
    filter.$or = [
      { name: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
      { address: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  if (cuisine) {
    filter.cuisine = { $regex: escapeRegex(cuisine), $options: 'i' };
  }

  if (activityCategory) {
    filter.activityCategory = { $regex: escapeRegex(activityCategory), $options: 'i' };
  }

  if (eventType) {
    filter['event.eventType'] = { $regex: `^${escapeRegex(eventType)}$`, $options: 'i' };
  }

  // Un événement correspond à la période s'il la chevauche :
  // début <= to ET fin (ou début si pas de fin) >= from.
  if (to) {
    filter['event.startDate'] = { $lte: to };
  }
  if (from) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { 'event.endDate': { $gte: from } },
          { 'event.endDate': null, 'event.startDate': { $gte: from } },
        ],
      },
    ];
  }

  if (free === true) {
    filter.free = true;
  } else if (maxPrice !== undefined) {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ free: true }, { 'price.amount': { $lte: maxPrice } }] },
    ];
  }

  const result = await paginate(Service, filter, {
    page,
    limit,
    // Les événements s'affichent dans l'ordre chronologique.
    sort:
      type === 'evenement'
        ? { 'event.startDate': 1, _id: 1 }
        : { ratingAverage: -1, createdAt: -1 },
    populate: { path: 'destination', select: 'name slug region' },
  });

  res.json(result);
}

export async function getService(req, res) {
  const service = await Service.findOne({
    _id: req.validated.params.id,
    hidden: false,
  })
    .populate('destination', 'name slug region location')
    .populate('provider', 'name');

  if (!service) {
    throw ApiError.notFound('Service introuvable.');
  }

  res.json({ service });
}
