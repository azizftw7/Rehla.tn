import { Send } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { FormAlert } from '../pages/auth/AuthLayout.jsx'
import { splitApiError } from '../pages/auth/authForm.js'
import { MAX_COMMENT_LENGTH } from '../lib/reviewsApi.js'
import Button from './Button.jsx'
import { StarRatingInput } from './StarRating.jsx'
import './ReviewForm.css'

const FIELDS = ['rating', 'comment']

/**
 * Formulaire d'avis (US3.5) : note obligatoire de 1 à 5, commentaire facultatif (1000 caractères).
 * - initial : { rating, comment } pour modifier un avis existant
 * - onSubmit({ rating, comment }) : promesse ; une erreur de l'API s'affiche sous le champ concerné
 * - onCancel : affiche un bouton « Annuler » (modification)
 */
export default function ReviewForm({
  title,
  initial,
  submitLabel = 'Publier mon avis',
  busyLabel = 'Publication…',
  onSubmit,
  onCancel,
}) {
  const id = useId()
  const formRef = useRef(null)
  const [rating, setRating] = useState(initial?.rating ?? null)
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [errors, setErrors] = useState({})
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)

  const ids = {
    rating: `${id}-note`,
    ratingError: `${id}-note-erreur`,
    comment: `${id}-commentaire`,
    commentError: `${id}-commentaire-erreur`,
    counter: `${id}-commentaire-compteur`,
    alert: `${id}-alerte`,
  }

  // Place le focus sur le premier champ en erreur.
  const focusFirstError = (fieldErrors) => {
    if (fieldErrors.rating) formRef.current?.querySelector('input[type="radio"]')?.focus()
    else if (fieldErrors.comment) formRef.current?.querySelector('textarea')?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const fieldErrors = {}
    if (!rating) fieldErrors.rating = 'Choisissez une note de 1 à 5 étoiles.'
    if (comment.trim().length > MAX_COMMENT_LENGTH) {
      fieldErrors.comment = `Le commentaire ne peut pas dépasser ${MAX_COMMENT_LENGTH} caractères.`
    }
    setErrors(fieldErrors)
    setGeneral(null)
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstError(fieldErrors)
      return
    }

    setBusy(true)
    try {
      await onSubmit({ rating, comment: comment.trim() })
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      setErrors(split.fieldErrors)
      setGeneral(split.general)
      focusFirstError(split.fieldErrors)
      setBusy(false)
    }
  }

  const length = comment.trim().length

  return (
    <form ref={formRef} className="review-form" onSubmit={handleSubmit} noValidate>
      {title && <h3 className="titre-4 review-form__title">{title}</h3>}

      <FormAlert id={ids.alert}>{general}</FormAlert>

      <div className="review-form__field">
        <StarRatingInput
          name={ids.rating}
          legend="Votre note"
          required
          value={rating}
          onChange={(value) => {
            setRating(value)
            setErrors((prev) => ({ ...prev, rating: undefined }))
          }}
          error={errors.rating}
          errorId={ids.ratingError}
        />
        {errors.rating && (
          <p id={ids.ratingError} className="services-page__field-error legende">
            {errors.rating}
          </p>
        )}
      </div>

      <div className="review-form__field">
        <label htmlFor={ids.comment} className="label">
          Votre commentaire <span className="legende review-form__optional">(facultatif)</span>
        </label>
        <textarea
          id={ids.comment}
          className="services-page__input texte-s review-form__textarea"
          rows={4}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Accueil, propreté, rapport qualité-prix… Qu’avez-vous apprécié ?"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={[ids.counter, errors.comment && ids.commentError]
            .filter(Boolean)
            .join(' ')}
        />
        <p id={ids.counter} className="legende review-form__counter">
          {length} / {MAX_COMMENT_LENGTH} caractères
        </p>
        {errors.comment && (
          <p id={ids.commentError} className="services-page__field-error legende">
            {errors.comment}
          </p>
        )}
      </div>

      <div className="review-form__actions">
        <Button type="submit" variant="primary" icon={Send} disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  )
}
