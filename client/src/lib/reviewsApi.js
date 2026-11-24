import { apiDelete, apiGet, apiPatch, apiPost } from './api.js'

// Avis et notes d'un service (US3.5).

export const MAX_COMMENT_LENGTH = 1000
export const REVIEWS_PAGE_SIZE = 5

const reviewsPath = (serviceId) => `/services/${encodeURIComponent(serviceId)}/reviews`

/**
 * GET /api/services/:id/reviews?page&limit (public)
 * → { items, total, page, pages, summary: { average, count, distribution } }
 */
export function fetchServiceReviews(
  serviceId,
  { page = 1, limit = REVIEWS_PAGE_SIZE } = {},
  options = {},
) {
  return apiGet(`${reviewsPath(serviceId)}?page=${page}&limit=${limit}`, options)
}

/** GET /api/services/:id/reviews/me (voyageur connecté) → { review } ou { review: null }. */
export function fetchMyReview(serviceId, options = {}) {
  return apiGet(`${reviewsPath(serviceId)}/me`, options)
}

/** POST /api/services/:id/reviews { rating, comment } → { review } (409 si déjà donné). */
export function createReview(serviceId, body, options = {}) {
  return apiPost(reviewsPath(serviceId), body, options)
}

/** PATCH /api/reviews/:id { rating?, comment? } → { review }. */
export function updateReview(reviewId, body, options = {}) {
  return apiPatch(`/reviews/${encodeURIComponent(reviewId)}`, body, options)
}

/** DELETE /api/reviews/:id (204). */
export function deleteReview(reviewId, options = {}) {
  return apiDelete(`/reviews/${encodeURIComponent(reviewId)}`, options)
}

/** « 12 mars 2026 » (null si la date est absente ou invalide). */
export function formatReviewDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** « 4,5 » : note moyenne avec une décimale et la virgule française. */
export function formatRating(value) {
  return Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/** L'avis a-t-il été modifié après sa publication (plus d'une minute d'écart) ? */
export function isEdited(review) {
  const created = new Date(review?.createdAt).getTime()
  const updated = new Date(review?.updatedAt).getTime()
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 60_000
}
