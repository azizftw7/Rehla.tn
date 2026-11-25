import mongoose from 'mongoose';
import { Review, Service } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginate } from '../utils/pagination.js';
import { publicName } from '../utils/text.js';

// Champs de l'auteur lus en base : jamais l'e-mail ni le téléphone.
const AUTHOR_FIELDS = 'name profile avatarUrl';

/** Avis tel qu'il est montré à tous : l'auteur n'apparaît que par son prénom et son initiale. */
export function toPublicReview(review) {
  const { author, ...rest } = review.toJSON();
  return {
    ...rest,
    author: author?._id
      ? {
          _id: author._id,
          name: publicName(author.name),
          profile: author.profile,
          avatarUrl: author.avatarUrl,
        }
      : null,
  };
}

async function findVisibleService(id) {
  const service = await Service.findOne({ _id: id, hidden: false }).select(
    'ratingAverage ratingCount',
  );
  if (!service) {
    throw ApiError.notFound('Service introuvable.');
  }
  return service;
}

/** Avis de l'utilisateur connecté : 404 s'il n'existe pas, 403 si ce n'est pas le sien. */
async function findOwnReview(req, action) {
  const review = await Review.findById(req.validated.params.id);
  if (!review) {
    throw ApiError.notFound('Avis introuvable.');
  }
  if (!review.author.equals(req.user._id)) {
    throw ApiError.forbidden(`Vous ne pouvez ${action} que vos propres avis.`);
  }
  return review;
}

/** Nombre d'avis par note : { 1: 0, 2: 1, 3: 0, 4: 5, 5: 3 }. */
async function ratingDistribution(serviceId) {
  const groups = await Review.aggregate([
    { $match: { service: new mongoose.Types.ObjectId(String(serviceId)) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  groups.forEach(({ _id, count }) => {
    distribution[_id] = count;
  });
  return distribution;
}

/**
 * GET /api/services/:id/reviews?page=&limit= (public), plus récents d'abord.
 * → { items, total, page, pages, summary: { average, count, distribution } }
 */
export async function listServiceReviews(req, res) {
  const service = await findVisibleService(req.validated.params.id);
  const { page, limit } = req.validated.query;

  const [result, distribution] = await Promise.all([
    paginate(
      Review,
      { service: service._id },
      {
        page,
        limit,
        sort: { createdAt: -1, _id: -1 },
        populate: { path: 'author', select: AUTHOR_FIELDS },
      },
    ),
    ratingDistribution(service._id),
  ]);

  res.json({
    ...result,
    items: result.items.map(toPublicReview),
    summary: { average: service.ratingAverage, count: service.ratingCount, distribution },
  });
}

/** GET /api/services/:id/reviews/me (voyageur) → { review } ou { review: null }. */
export async function getMyReview(req, res) {
  const service = await findVisibleService(req.validated.params.id);
  const review = await Review.findOne({ service: service._id, author: req.user._id }).populate(
    'author',
    AUTHOR_FIELDS,
  );
  res.json({ review: review ? toPublicReview(review) : null });
}

/** POST /api/services/:id/reviews (voyageur) → 201 { review }. Un seul avis par service (409). */
export async function createReview(req, res) {
  const service = await findVisibleService(req.validated.params.id);
  const { rating, comment } = req.validated.body;

  // L'index unique (service, author) refuse un second avis, même envoyé deux fois en même
  // temps : errorHandler répond 409 « Vous avez déjà laissé un avis sur ce service. »
  const review = await Review.create({
    service: service._id,
    author: req.user._id,
    rating,
    comment: comment || undefined,
  });
  await review.populate('author', AUTHOR_FIELDS);

  res.status(201).json({ review: toPublicReview(review) });
}

/** PATCH /api/reviews/:id (auteur) → { review }. La note du service est recalculée. */
export async function updateReview(req, res) {
  const review = await findOwnReview(req, 'modifier');
  const { rating, comment } = req.validated.body;

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment || undefined;
  // save() (et non findOneAndUpdate) : le hook post('save') recalcule ratingAverage et ratingCount.
  await review.save();
  await review.populate('author', AUTHOR_FIELDS);

  res.json({ review: toPublicReview(review) });
}

/** DELETE /api/reviews/:id (auteur) → 204. La note du service est recalculée. */
export async function deleteReview(req, res) {
  const review = await findOwnReview(req, 'supprimer');
  // deleteOne() sur le document : déclenche le hook qui recalcule la note du service.
  await review.deleteOne();
  res.status(204).end();
}

// ---------- US6.4 : le prestataire répond aux avis sur ses services ----------

const NO_REPLY_FILTER = { 'providerReply.text': { $in: [null, ''] } };

/** Avis reçu par le prestataire, avec le service lu à part (le hook de save() attend un id). */
function toProviderReview(review, service) {
  return {
    ...toPublicReview(review),
    // hidden : le service n'est pas public (masqué par le prestataire ou par la modération).
    service: {
      _id: service._id,
      name: service.name,
      hidden: Boolean(service.hidden || service.hiddenByAdmin),
    },
  };
}

/**
 * Avis sur un service du prestataire connecté : 404 si l'avis n'existe pas,
 * 403 si le service appartient à un autre prestataire.
 */
async function findReceivedReview(req) {
  const review = await Review.findById(req.validated.params.id);
  if (!review) {
    throw ApiError.notFound('Avis introuvable.');
  }
  const service = await Service.findById(review.service).select(
    'provider name hidden hiddenByAdmin',
  );
  if (!service?.provider.equals(req.user._id)) {
    throw ApiError.forbidden('Vous ne pouvez répondre qu’aux avis laissés sur vos services.');
  }
  return { review, service };
}

/** Enregistre la réponse sans toucher à updatedAt : l'avis n'apparaît pas « modifié ». */
async function saveReply(review, service, reply) {
  review.providerReply = reply;
  await review.save({ timestamps: false });
  await review.populate('author', AUTHOR_FIELDS);
  return toProviderReview(review, service);
}

/**
 * GET /api/provider/reviews?service=&unanswered=true&page=&limit= (prestataire)
 * Avis laissés sur ses services (masqués compris), plus récents d'abord.
 * → { items, total, page, pages, unansweredCount }
 */
export async function listReceivedReviews(req, res) {
  const { service, unanswered, page, limit } = req.validated.query;

  const services = await Service.find({ provider: req.user._id }).select(
    'name hidden hiddenByAdmin',
  );
  const ownIds = services.map((s) => s._id);
  if (service && !ownIds.some((id) => id.equals(service))) {
    throw ApiError.notFound('Service introuvable.');
  }

  const base = {
    service: service ? new mongoose.Types.ObjectId(String(service)) : { $in: ownIds },
  };
  const filter = unanswered ? { ...base, ...NO_REPLY_FILTER } : base;

  const [result, unansweredCount] = await Promise.all([
    paginate(Review, filter, {
      page,
      limit,
      sort: { createdAt: -1, _id: -1 },
      populate: { path: 'author', select: AUTHOR_FIELDS },
    }),
    Review.countDocuments({ ...base, ...NO_REPLY_FILTER }),
  ]);

  const byId = new Map(services.map((s) => [String(s._id), s]));
  res.json({
    ...result,
    items: result.items.map((review) => toProviderReview(review, byId.get(String(review.service)))),
    unansweredCount,
  });
}

/** POST /api/provider/reviews/:id/reply { text } → 201 { review }. Une seule réponse (409). */
export async function createReply(req, res) {
  const { review, service } = await findReceivedReview(req);
  if (review.providerReply?.text) {
    throw ApiError.conflict('Vous avez déjà répondu à cet avis. Modifiez votre réponse si besoin.');
  }
  const result = await saveReply(review, service, {
    text: req.validated.body.text,
    repliedAt: new Date(),
  });
  res.status(201).json({ review: result });
}

/** PATCH /api/provider/reviews/:id/reply { text } → { review } (404 s'il n'y a pas de réponse). */
export async function updateReply(req, res) {
  const { review, service } = await findReceivedReview(req);
  if (!review.providerReply?.text) {
    throw ApiError.notFound('Vous n’avez pas encore répondu à cet avis.');
  }
  const result = await saveReply(review, service, {
    text: req.validated.body.text,
    repliedAt: new Date(),
  });
  res.json({ review: result });
}

/** DELETE /api/provider/reviews/:id/reply → 204 (404 s'il n'y a pas de réponse). */
export async function deleteReply(req, res) {
  const { review, service } = await findReceivedReview(req);
  if (!review.providerReply?.text) {
    throw ApiError.notFound('Vous n’avez pas encore répondu à cet avis.');
  }
  await saveReply(review, service, undefined);
  res.status(204).end();
}
