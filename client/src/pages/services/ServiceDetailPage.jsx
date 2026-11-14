import {
  ArrowLeft,
  CalendarDays,
  Globe,
  Languages,
  MapPin,
  Phone,
  Star,
  Store,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { fetchServiceById, formatServicePrice } from '../../lib/servicesApi.js'
import './ServiceDetailPage.css'

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

export default function ServiceDetailPage() {
  const { id } = useParams()
  const [requestState, setRequestState] = useState({
    fetchedId: null,
    service: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    fetchServiceById(id, { signal: controller.signal })
      .then((res) => {
        setRequestState({ fetchedId: id, service: res.service, error: null })
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRequestState({ fetchedId: id, service: null, error: err })
      })

    return () => controller.abort()
  }, [id])

  const loading = requestState.fetchedId !== id
  const { service, error } = requestState

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
            <Button to="/services" variant="primary">
              Retour au catalogue
            </Button>
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

  return (
    <section
      className="service-detail"
      style={{ '--service-accent': accentColor }}
      aria-labelledby="service-detail-titre"
    >
      <div className="container">
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
                {service.activityCategory && (
                  <span className="service-card__tag legende">{service.activityCategory}</span>
                )}
                {service.free && (
                  <span className="service-card__free-tag legende">Gratuit</span>
                )}
              </div>

              <h1 id="service-detail-titre" className="titre-1">
                {service.name}
              </h1>

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
                  {service.ratingCount > 0
                    ? `${Number(service.ratingAverage).toFixed(1)} (${service.ratingCount} avis)`
                    : 'Nouveau — aucun avis pour le moment'}
                </span>
              </div>
            </header>

            {service.description && (
              <div className="service-detail__section">
                <h2 className="titre-3">À propos</h2>
                <p className="service-detail__description texte">{service.description}</p>
              </div>
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