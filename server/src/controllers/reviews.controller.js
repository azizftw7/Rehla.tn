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
