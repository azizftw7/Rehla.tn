import { MessageSquareReply } from 'lucide-react'
import { getProfileLabel } from '../data/travelerProfiles.js'
import { formatReviewDate, isEdited } from '../lib/reviewsApi.js'
import Icon from './Icon.jsx'
import StarRating from './StarRating.jsx'
import './ReviewCard.css'

/**
 * Un avis (US3.5) : auteur (prénom et initiale, profil), date, note, commentaire,
 * et la réponse du prestataire s'il y en a une. `actions` : boutons affichés en bas (son avis).
 */
export default function ReviewCard({ review, actions, headingLevel = 3 }) {
  const author = review.author
  const name = author?.name || 'Voyageur'
  const profile = getProfileLabel(author?.profile)
  const date = formatReviewDate(review.createdAt)
  const Heading = `h${headingLevel}`
  const reply = review.providerReply?.text

  return (
    <article className="review-card">
      <header className="review-card__head">
        <span className="review-card__avatar arche" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="review-card__author">
          <Heading className="titre-4 review-card__name">{name}</Heading>
          <p className="legende review-card__meta">
            {profile && <span className="review-card__profile">{profile}</span>}
            {date && (
              <time dateTime={review.createdAt}>
                {date}
                {isEdited(review) && ' · modifié'}
              </time>
            )}
          </p>
        </div>
        <StarRating value={review.rating} className="review-card__stars" />
      </header>

      {review.comment ? (
        <p className="texte-s review-card__comment">{review.comment}</p>
      ) : (
        <p className="texte-s review-card__comment review-card__comment--empty">
          Note sans commentaire.
        </p>
      )}

      {reply && (
        <div className="review-card__reply">
          <p className="legende review-card__reply-title">
            <Icon icon={MessageSquareReply} size={16} />
            Réponse du prestataire
          </p>
          <p className="texte-s">{reply}</p>
        </div>
      )}

      {actions && <div className="review-card__actions">{actions}</div>}
    </article>
  )
}
