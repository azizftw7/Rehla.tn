import { Destination, Offer, Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { escapeRegex, normalizeText } from '../utils/text.js';

// Variantes accentuées des voyelles et du c : « francais » trouve « Français ».
const ACCENT_CLASSES = {
  a: '[aàâä]',
  c: '[cç]',
  e: '[eéèêë]',
  i: '[iîï]',
  o: '[oôö]',
  u: '[uùûü]',
};

/** Expression exacte, insensible à la casse et aux accents (ex. une langue). */
export function accentInsensitiveExact(value) {
  const pattern = [...normalizeText(value)]
    .map((char) => ACCENT_CLASSES[char] ?? escapeRegex(char))
    .join('');
  return new RegExp(`^${pattern}$`, 'i');
}

/** « français » → « Français ». */
const capitalize = (value) => value.charAt(0).toLocaleUpperCase('fr') + value.slice(1);

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Un filtre propre à un type (type d'hébergement, catégorie d'activité, période…) ne restreint
 * que ce type : avec « hébergements + restaurants » et le type « dar », on voit les dars et
 * tous les restaurants (US2.3).
 */
function onlyForType(serviceType, criteria) {
  return { $or: [{ type: { $ne: serviceType } }, { type: serviceType, ...criteria }] };
}

/** Critères des événements : type d'événement et chevauchement de la période [from, to]. */
function eventCriteria({ eventType, from, to }) {
  const criteria = {};
  if (eventType) {
    criteria['event.eventType'] = { $regex: `^${escapeRegex(eventType)}$`, $options: 'i' };
  }
  // Un événement correspond à la période s'il la chevauche :
  // début <= to ET fin (ou début si pas de fin) >= from.
  if (to) {
    criteria['event.startDate'] = { $lte: to };
  }
  if (from) {
    criteria.$or = [
      { 'event.endDate': { $gte: from } },
      { 'event.endDate': null, 'event.startDate': { $gte: from } },
    ];
  }
  return criteria;
}

/**
 * GET /api/services?type=|types=a,b&destination=&search=&cuisine=&activityCategory=
 *   &accommodationType=&eventType=&from=&to=&free=&maxPrice=&minRating=&language=&page=&limit=
 */
export async function listServices(req, res) {
  const {
    type,
    types,
    destination,
    search,
    cuisine,
    activityCategory,
    accommodationType,
    eventType,
    from,
    to,
    free,
    maxPrice,
    minRating,
    language,
    page,
    limit,
  } = req.validated.query;

  const filter = { hidden: false };
  const conditions = [];

  // « type » (un seul) reste accepté : il s'ajoute aux « types ».
  const selectedTypes = [...new Set([...(types ?? []), ...(type ? [type] : [])])];
  if (selectedTypes.length === 1) {
    [filter.type] = selectedTypes;
  } else if (selectedTypes.length > 1) {
    filter.type = { $in: selectedTypes };
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
    conditions.push(
      onlyForType('restaurant', { cuisine: { $regex: escapeRegex(cuisine), $options: 'i' } }),
    );
  }

  if (activityCategory) {
    conditions.push(
      onlyForType('activite', {
        activityCategory: { $regex: escapeRegex(activityCategory), $options: 'i' },
      }),
    );
  }

  if (accommodationType) {
    conditions.push(onlyForType('hebergement', { accommodationType }));
  }

  // US4.2 : la langue ne restreint que les guides ; « anglais » trouve « Anglais ».
  if (language) {
    conditions.push(onlyForType('guide', { languages: accentInsensitiveExact(language) }));
  }

  if (eventType || from || to) {
    conditions.push(onlyForType('evenement', eventCriteria({ eventType, from, to })));
  }

  if (free === true) {
    filter.free = true;
  } else if (maxPrice !== undefined) {
    conditions.push({ $or: [{ free: true }, { 'price.amount': { $lte: maxPrice } }] });
  }

  if (minRating !== undefined) {
    filter.ratingAverage = { $gte: minRating };
  }

  if (conditions.length > 0) {
    filter.$and = conditions;
  }

  const result = await paginate(Service, filter, {
    page,
    limit,
    // Les événements seuls s'affichent dans l'ordre chronologique.
    sort:
      selectedTypes.length === 1 && selectedTypes[0] === 'evenement'
        ? { 'event.startDate': 1, _id: 1 }
        : { ratingAverage: -1, createdAt: -1 },
    populate: { path: 'destination', select: 'name slug region' },
  });

  res.json(result);
}

/**
 * GET /api/services/languages (public, US4.2) : langues parlées par les guides visibles,
 * sans doublon (« français » et « Français » ne comptent qu'une fois), triées. → { languages }
 */
export async function listGuideLanguages(_req, res) {
  const values = await Service.distinct('languages', { type: 'guide', hidden: false });
  const byKey = new Map();
  for (const value of values) {
    const key = normalizeText(value);
    if (key && !byKey.has(key)) byKey.set(key, capitalize(value.trim()));
  }
  const languages = [...byKey.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  res.json({ languages });
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

  // Offres en cours : startDate <= maintenant <= endDate.
  const now = new Date();
  const offers = await Offer.find({
    service: service._id,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .select('title discountPercent discountedPrice startDate endDate')
    .sort({ endDate: 1 });

  res.json({ service, offers });
}
