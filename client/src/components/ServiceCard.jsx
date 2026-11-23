import { CalendarDays, EyeOff, MapPin, Star, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getAccommodationLabel } from '../data/accommodationTypes.js'
import { CATEGORIES } from '../data/categories.js'
import { formatEventPeriod, formatServicePrice } from '../lib/servicesApi.js'
import Icon from './Icon.jsx'
import './ServiceCard.css'

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))

/**
- Carte d'un service.
- - to : cible du lien (par défaut la fiche publique) ;
- - children : actions affichées en bas de la carte (ex. « Mes services » du prestataire) ;
- - un service masqué (hidden) porte le badge « Masqué ».
 */
export default function ServiceCard({ service, to, children }) {
  const {
    _id,
    type,
    name,
    description,
    destination,
    photos,
    cuisine,
    activityCategory,
    accommodationType,
    event,
    free,
    ratingAverage,
    ratingCount,
    hidden,
  } = service

  const [imageFailed, setImageFailed] = useState(false)
  const coverPhoto = photos?.[0]
  const showImage = coverPhoto && !imageFailed
  const category = CATEGORY_MAP[type]
  const CategoryIcon = category?.icon || UtensilsCrossed
  const accentColor = category ? `var(${category.color})` : 'var(--bleu)'
  const specialty =
    cuisine ||
    activityCategory ||
    (type === 'evenement' ? event?.eventType : null) ||
    (type === 'hebergement' ? getAccommodationLabel(accommodationType) : null)
  const eventPeriod = type === 'evenement' ? formatEventPeriod(event) : null
  const priceLabel = formatServicePrice(service)

  return (
    <article
      className={`service-card${hidden ? ' service-card--hidden' : ''}`}
      style={{ '--service-accent': accentColor }}
    >
      <div className="service-card__media arche">
        {showImage ? (
          <img
            src={coverPhoto}
            alt={name}
            loading="lazy"
            width="480"
            height="360"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="service-card__placeholder" aria-hidden="true">
            <Icon icon={CategoryIcon} size={40} />
          </div>
        )}
      </div>

      <span className="service-card__badge legende">
        <Icon icon={CategoryIcon} size={14} />
        {category?.label || type}
      </span>
      {hidden && (
        <span className="service-card__badge service-card__badge--hidden legende">
          <Icon icon={EyeOff} size={14} />
          Masqué
        </span>
      )}

      <div className="service-card__body">
        <div className="service-card__header">
          <h3 className="titre-4">
            <Link to={to || `/services/${_id}`} className="service-card__link">
              {name}
            </Link>
          </h3>
          {ratingCount > 0 && (
            <span className="service-card__rating texte-s" aria-label={`Note ${ratingAverage} sur 5`}>
              <Icon icon={Star} size={15} />
              {Number(ratingAverage).toFixed(1)}
            </span>
          )}
        </div>

        <div className="service-card__meta texte-s">
          {destination?.name && (
            <span className="destination-card__region">
              <Icon icon={MapPin} size={15} />
              {destination.name}
            </span>
          )}
          {specialty && <span className="service-card__tag legende">{specialty}</span>}
          {free && <span className="service-card__free-tag legende">Gratuit</span>}
        </div>

        {eventPeriod && (
          <p className="service-card__dates texte-s">
            <Icon icon={CalendarDays} size={15} />
            {eventPeriod}
          </p>
        )}

        {description && <p className="service-card__description texte-s">{description}</p>}

        <div className="service-card__footer">
          <span className="service-card__price prix">
            {priceLabel.main}{' '}
            {priceLabel.unit && <span className="service-card__unit texte-s">{priceLabel.unit}</span>}
          </span>
          {ratingCount > 0 && (
            <span className="legende" style={{ color: 'var(--encre-2)' }}>
              ({ratingCount} avis)
            </span>
          )}
        </div>

        {children && <div className="service-card__actions">{children}</div>}
      </div>
    </article>
  )
}

export function ServiceCardSkeleton() {
  return (
    <div className="service-card service-card--skeleton" aria-hidden="true">
      <div className="service-card__media arche skeleton" />
      <div className="service-card__body">
        <div className="skeleton skeleton--line" style={{ width: '65%' }} />
        <div className="skeleton skeleton--line" style={{ width: '40%' }} />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line" style={{ width: '30%', marginTop: 'var(--space-2)' }} />
      </div>
    </div>
  )
}