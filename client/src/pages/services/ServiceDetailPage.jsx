import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Globe,
  Languages,
  MapPin,
  Percent,
  Phone,
  PlayCircle,
  Star,
  Store,
  Tag,
  UtensilsCrossed,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import FavoriteButton from '../../components/FavoriteButton.jsx'
import Icon from '../../components/Icon.jsx'
import { getAccommodationLabel } from '../../data/accommodationTypes.js'
import { CATEGORIES } from '../../data/categories.js'
import { toLatLng } from '../../lib/destinationsApi.js'
import {
  fetchServiceById,
  formatOfferDiscount,
  formatOfferEnd,
  formatServicePrice,
  getYoutubeEmbedUrl,
} from '../../lib/servicesApi.js'
import { formatRating } from '../../lib/reviewsApi.js'
import './ServiceDetailPage.css'
import ServiceReviews from './ServiceReviews.jsx'

// Leaflet n'est chargé que si la fiche a une localisation.
const ServicesMap = lazy(() => import('../../components/ServicesMap.jsx'))

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))

function formatEventDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('fr-TN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getAllServicesLabel(category, type) {
  if (!category) return 'Voir tous les services'
  const title = category.title.toLowerCase()
  return type === 'activite' ? `Voir toutes les ${title}` : `Voir tous les ${title}`
}

function ServiceGallery({ photos, serviceName, CategoryIcon }) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [brokenPhotos, setBrokenPhotos] = useState({})

  const currentPhoto = photos[activePhotoIndex]
  const showPhoto = currentPhoto && !brokenPhotos[activePhotoIndex]

  return (
    <div className="service-detail__gallery">
      <div className="service-detail__hero">
        {showPhoto ? (
          <img
            src={currentPhoto}
            alt={`${serviceName} — photo ${activePhotoIndex + 1}`}
            onError={() =>
              setBrokenPhotos((prev) => ({ ...prev, [activePhotoIndex]: true }))
            }
          />
        ) : (
          <div className="service-detail__placeholder" aria-hidden="true">
            <Icon icon={CategoryIcon} size={56} />
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <div className="service-detail__thumbs" role="group" aria-label="Galerie photos">
          {photos.map((photo, index) => (
            <button
              key={`${photo}-${index}`}
              type="button"
              className="service-detail__thumb"
              aria-pressed={index === activePhotoIndex}
              aria-label={`Afficher la photo ${index + 1}`}
              onClick={() => setActivePhotoIndex(index)}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ServiceOffers({ offers }) {
  return (
    <div className="service-detail__section">
      <h2 className="titre-3">Offres en cours</h2>
      <ul className="service-detail__offers">
        {offers.map((offer) => {
          const discount = formatOfferDiscount(offer)
          const end = formatOfferEnd(offer)
          return (
            <li key={offer._id} className="service-detail__offer">
              <span className="service-detail__offer-icon" aria-hidden="true">
                <Icon icon={Percent} size={18} />
              </span>
              <div className="service-detail__offer-body">
                <p className="service-detail__offer-title texte">{offer.title}</p>
                {end && (
                  <p className="legende" style={{ color: 'var(--encre-2)' }}>
                    {end}
                  </p>
                )}
              </div>
              {discount && (
                <span className="service-detail__offer-discount legende">
                  {offer.discountPercent == null && 'Prix réduit : '}
                  {discount}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ServiceVideo({ videoUrl, serviceName }) {
  const embedUrl = getYoutubeEmbedUrl(videoUrl)
  return (
    <div className="service-detail__section">
      <h2 className="titre-3">Vidéo</h2>
      {embedUrl ? (
        <div className="service-detail__video">
          <iframe
            src={embedUrl}
            title={`Vidéo de présentation — ${serviceName}`}
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <p className="texte">
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="service-detail__video-link"
          >
            <Icon icon={PlayCircle} size={18} />
            Voir la vidéo
          </a>
        </p>
      )}
    </div>
  )
}

function MapPlaceholder() {
  return <div className="service-detail__map-placeholder skeleton" aria-hidden="true" />
}

export default function ServiceDetailPage() {
  const { id } = useParams()
  // Message passé par la page précédente (ex. « … est publié » après la création).
  const notice = useLocation().state?.notice
  const [reload, setReload] = useState(0)
  const [requestState, setRequestState] = useState({
    fetchedKey: null,
    service: null,
    offers: [],
    error: null,
  })
  const requestKey = `${id}:${reload}`
  // Note à jour après la publication, la modification ou la suppression d'un avis (US3.5).
  const [ratingSummary, setRatingSummary] = useState({ id: null, average: 0, count: 0 })

  useEffect(() => {
    const controller = new AbortController()

    fetchServiceById(id, { signal: controller.signal })
      .then((res) => {
        setRequestState({
          fetchedKey: requestKey,
          service: res.service,
          offers: res.offers || [],
          error: null,
        })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRequestState({ fetchedKey: requestKey, service: null, offers: [], error: err })
      })

    return () => controller.abort()
  }, [id, requestKey])

  const loading = requestState.fetchedKey !== requestKey
  const { service, offers, error } = requestState
  // Tableau stable : la mini-carte ne se recadre pas à chaque rendu.
  const mapServices = useMemo(() => (service ? [service] : []), [service])

  if (loading) {
    return (
      <section className="service-detail">
        <div className="container">
          <div className="skeleton skeleton--line" style={{ width: '180px', marginBottom: '24px' }} />
          <div className="service-detail__layout">
            <div>
              <div className="service-detail__hero skeleton" />
              <div className="skeleton skeleton--line" style={{ width: '60%', marginTop: '24px' }} />
              <div className="skeleton skeleton--line" style={{ marginTop: '12px' }} />
            </div>
            <div className="service-detail__card">
              <div className="skeleton skeleton--line" style={{ width: '50%' }} />
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (error || !service) {
    const isNotFound = error?.status === 404 || error?.status === 400
    return (
      <section className="service-detail">
        <div className="container">
          <div className="services-page__state" role="alert">
            <h1 className="titre-2">
              {isNotFound ? 'Service introuvable' : 'Impossible de charger ce service'}
            </h1>
            <p className="texte" style={{ color: 'var(--encre-2)' }}>
              {error?.message || 'Cette adresse n’est plus disponible ou le lien est incorrect.'}
            </p>
            <div className="service-detail__state-actions">
              {!isNotFound && (
                <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
                  Réessayer
                </Button>
              )}
              <Button to="/services" variant={isNotFound ? 'primary' : 'secondary'}>
                Retour au catalogue
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const category = CATEGORY_MAP[service.type]
  const CategoryIcon = category?.icon || UtensilsCrossed
  const accentColor = category ? `var(${category.color})` : 'var(--bleu)'
  const photos = service.photos || []
  const priceLabel = formatServicePrice(service)
  const backUrl = service.type ? `/services?type=${service.type}` : '/services'
  const accommodationLabel =
    service.type === 'hebergement' ? getAccommodationLabel(service.accommodationType) : null
  const position = toLatLng(service.location)
  const rating =
    ratingSummary.id === id
      ? ratingSummary
      : { average: service.ratingAverage, count: service.ratingCount }

  return (
    <section
      className="service-detail"
      style={{ '--service-accent': accentColor }}
      aria-labelledby="service-detail-titre"
    >
      <div className="container">
        {notice && (
          <p className="service-detail__notice texte-s" role="status">
            <Icon icon={CircleCheck} size={18} />
            {notice}
          </p>
        )}

        <Link to={backUrl} className="service-detail__back texte-s">
          <Icon icon={ArrowLeft} size={16} />
          Retour aux {category ? category.title.toLowerCase() : 'services'}
        </Link>

        <div className="service-detail__layout">
          <div>
            <ServiceGallery
              key={id}
              photos={photos}
              serviceName={service.name}
              CategoryIcon={CategoryIcon}
            />

            <header className="service-detail__head">
              <div className="service-detail__badges">
                <span className="service-detail__pill legende">
                  <Icon icon={CategoryIcon} size={14} />
                  {category?.label || service.type}
                </span>
                {service.cuisine && (
                  <span className="service-card__tag legende">{service.cuisine}</span>
                )}
                {accommodationLabel && (
                  <span className="service-card__tag legende">{accommodationLabel}</span>
                )}
                {service.activityCategory && (
                  <span className="service-card__tag legende">{service.activityCategory}</span>
                )}
                {service.type === 'evenement' && service.event?.eventType && (
                  <span className="service-card__tag legende">{service.event.eventType}</span>
                )}
                {service.free && (
                  <span className="service-card__free-tag legende">Gratuit</span>
                )}
              </div>

              <h1 id="service-detail-titre" className="titre-1">
                {service.name}
              </h1>
              <FavoriteButton serviceId={service._id} serviceName={service.name} variant="detail" />

              <div className="service-detail__meta texte-s">
                {service.destination?.name && (
                  <span className="service-detail__meta-item" style={{ color: 'var(--lagune)' }}>
                    <Icon icon={MapPin} size={16} />
                    {service.destination.name}
                    {service.destination.region ? ` — ${service.destination.region}` : ''}
                  </span>
                )}

                <span className="service-detail__meta-item">
                  <Icon icon={Star} size={16} />
                  {rating.count > 0 ? (
                    <a href="#avis-titre" className="service-detail__rating-link">
                      {formatRating(rating.average)} ({rating.count} avis)
                    </a>
                  ) : (
                    'Nouveau — aucun avis pour le moment'
                  )}
                </span>
              </div>
            </header>

            {offers.length > 0 && <ServiceOffers offers={offers} />}

            {service.description && (
              <div className="service-detail__section">
                <h2 className="titre-3">À propos</h2>
                <p className="service-detail__description texte">{service.description}</p>
              </div>
            )}

            {position && (
              <div className="service-detail__section">
                <h2 className="titre-3">Localisation</h2>
                <div className="service-detail__map">
                  <Suspense fallback={<MapPlaceholder />}>
                    <ServicesMap
                      key={service._id}
                      center={position}
                      services={mapServices}
                      label={`Localisation de ${service.name}`}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            {service.videoUrl && (
              <ServiceVideo videoUrl={service.videoUrl} serviceName={service.name} />
            )}

            {service.type === 'evenement' && service.event?.startDate && (
              <div className="service-detail__section">
                <h2 className="titre-3">Dates et horaires</h2>
                <p className="service-detail__meta-item texte">
                  <Icon icon={CalendarDays} size={18} />
                  Du {formatEventDate(service.event.startDate)}
                  {service.event.endDate ? ` au ${formatEventDate(service.event.endDate)}` : ''}
                  {service.event.hours ? ` • ${service.event.hours}` : ''}
                </p>
                {service.event.eventType && (
                  <p className="service-detail__meta-item texte">
                    <Icon icon={Tag} size={18} />
                    Type d’événement : {service.event.eventType}
                  </p>
                )}
              </div>
            )}

            {service.type === 'guide' && service.languages?.length > 0 && (
              <div className="service-detail__section">
                <h2 className="titre-3">Langues parlées</h2>
                <p className="service-detail__meta-item texte">
                  <Icon icon={Languages} size={18} />
                  {service.languages.join(', ')}
                </p>
              </div>
            )}

            <ServiceReviews
              key={service._id}
              serviceId={service._id}
              initialSummary={{ average: service.ratingAverage, count: service.ratingCount }}
              onSummaryChange={(summary) =>
                setRatingSummary({ id, average: summary.average, count: summary.count })
              }
            />
          </div>

          <aside className="service-detail__card" aria-label="Informations pratiques">
            <div className="service-detail__price-box">
              <p className="legende" style={{ color: 'var(--encre-2)' }}>
                Tarif indicatif
              </p>
              <p className="service-detail__price prix">
                {priceLabel.main}{' '}
                {priceLabel.unit && (
                  <span className="service-card__unit texte">{priceLabel.unit}</span>
                )}
              </p>
            </div>

            <div className="service-detail__info-list texte-s">
              {service.provider?.name && (
                <div className="service-detail__info-row">
                  <Icon icon={Store} size={17} />
                  <span>Proposé par {service.provider.name}</span>
                </div>
              )}

              {service.address && (
                <div className="service-detail__info-row">
                  <Icon icon={MapPin} size={17} />
                  <span>{service.address}</span>
                </div>
              )}

              {service.contact?.phone && (
                <div className="service-detail__info-row">
                  <Icon icon={Phone} size={17} />
                  <a href={`tel:${service.contact.phone}`}>{service.contact.phone}</a>
                </div>
              )}

              {service.contact?.website && (
                <div className="service-detail__info-row">
                  <Icon icon={Globe} size={17} />
                  <a href={service.contact.website} target="_blank" rel="noreferrer">
                    Site web officiel
                  </a>
                </div>
              )}
            </div>

            <Button to={backUrl} variant="secondary">
              {getAllServicesLabel(category, service.type)}
            </Button>
          </aside>
        </div>
      </div>
    </section>
  )
}