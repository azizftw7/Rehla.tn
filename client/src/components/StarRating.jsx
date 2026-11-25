import { Star } from 'lucide-react'
import { useState } from 'react'
import { formatRating } from '../lib/reviewsApi.js'
import Icon from './Icon.jsx'
import './StarRating.css'

const STARS = [1, 2, 3, 4, 5]
const STAR_LABELS = ['1 étoile', '2 étoiles', '3 étoiles', '4 étoiles', '5 étoiles']

/** Note en étoiles, en lecture seule (US3.5). La moyenne est arrondie à l'étoile la plus proche. */
export default function StarRating({ value = 0, size = 16, className = '' }) {
  const filled = Math.round(Number(value) || 0)
  const text = Number.isInteger(Number(value)) ? String(value) : formatRating(value)
  return (
    <span
      className={`star-rating ${className}`.trim()}
      role="img"
      aria-label={`Note : ${text} sur 5`}
    >
      {STARS.map((star) => (
        <Icon
          key={star}
          icon={Star}
          size={size}
          className={
            star <= filled ? 'star-rating__star star-rating__star--on' : 'star-rating__star'
          }
        />
      ))}
    </span>
  )
}

/**
 * Choix d'une note de 1 à 5 : boutons radio natifs (flèches du clavier, lecteurs d'écran),
 * affichés comme des étoiles. value : nombre ou null ; onChange(note).
 */
export function StarRatingInput({ name, value, onChange, legend, error, errorId, required }) {
  const [hovered, setHovered] = useState(null)
  const shown = hovered ?? value ?? 0

  return (
    <fieldset
      className="star-input"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      onMouseLeave={() => setHovered(null)}
    >
      <legend className="label star-input__legend">
        {legend}
        {required && <span aria-hidden="true"> *</span>}
      </legend>
      <div className="star-input__stars">
        {STARS.map((star) => (
          <label
            key={star}
            className={star <= shown ? 'star-input__star star-input__star--on' : 'star-input__star'}
            onMouseEnter={() => setHovered(star)}
          >
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="visually-hidden"
            />
            <Icon icon={Star} size={28} />
            <span className="visually-hidden">{STAR_LABELS[star - 1]}</span>
          </label>
        ))}
        <span className="star-input__value texte-s" aria-hidden="true">
          {value ? STAR_LABELS[value - 1] : 'Aucune note'}
        </span>
      </div>
    </fieldset>
  )
}
