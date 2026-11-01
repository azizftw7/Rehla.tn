import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import './DestinationCard.css'

/** Carte d'une destination (réponse de GET /api/destinations). Toute la carte est cliquable. */
export default function DestinationCard({ destination }) {
  const { name, slug, region, description, coverImage } = destination
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = coverImage && !imageFailed

  return (
    <article className="destination-card">
      <div className="destination-card__media arche">
        {showImage ? (
          <img
            src={coverImage}
            alt={`Vue de ${name}`}
            loading="lazy"
            width="480"
            height="360"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="destination-card__placeholder" aria-hidden="true">
            <Icon icon={MapPin} size={40} />
          </div>
        )}
      </div>
      <div className="destination-card__body">
        <h3 className="titre-4">
          <Link to={`/destinations/${slug}`} className="destination-card__link">
            {name}
          </Link>
        </h3>
        <p className="destination-card__region texte-s">
          <Icon icon={MapPin} size={16} />
          {region}
        </p>
        {description && <p className="destination-card__description texte-s">{description}</p>}
      </div>
    </article>
  )
}

/** Version « squelette » affichée pendant le chargement. */
export function DestinationCardSkeleton() {
  return (
    <div className="destination-card destination-card--skeleton" aria-hidden="true">
      <div className="destination-card__media arche skeleton" />
      <div className="destination-card__body">
        <div className="skeleton skeleton--line" style={{ width: '50%' }} />
        <div className="skeleton skeleton--line" style={{ width: '35%' }} />
        <div className="skeleton skeleton--line" />
      </div>
    </div>
  )
}
