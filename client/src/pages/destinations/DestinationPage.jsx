import { ArrowLeft, MapPin } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import '../../components/DestinationCard.css'
import Icon from '../../components/Icon.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { fetchDestinationBySlug, toLatLng } from '../../lib/destinationsApi.js'
import { fetchServices, formatServicePrice } from '../../lib/servicesApi.js'
import '../services/ServicesPage.css'
import './DestinationPage.css'

// Leaflet n'est chargé que sur cette page.
const ServicesMap = lazy(() => import('../../components/ServicesMap.jsx'))

const SERVICE_CATEGORIES = CATEGORIES.filter((cat) => cat.type !== 'transport')
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))
const SERVICES_LIMIT = 100
// Tableau vide stable : la carte ne se recadre que lorsque la liste change vraiment.
const NO_SERVICES = []
// Centre de la Tunisie, si la destination n'a pas de coordonnées valides.
const TUNISIA_CENTER = [34.0, 9.5]

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

function MapPlaceholder() {
  return <div className="destination-page__map-placeholder skeleton" aria-hidden="true" />
}

function ListSkeleton() {
  return (
    <ul className="destination-page__list" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="destination-page__item">
          <div className="destination-page__item-body">
            <div className="skeleton skeleton--line" style={{ width: '35%' }} />
            <div className="skeleton skeleton--line" style={{ width: '70%' }} />
            <div className="skeleton skeleton--line" style={{ width: '25%' }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function DestinationPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type') || ''
  const mapRef = useRef(null)

  const [destinationReload, setDestinationReload] = useState(0)
  const [destinationState, setDestinationState] = useState({
    key: null,
    destination: null,
    error: null,
  })

  const [servicesReload, setServicesReload] = useState(0)
  const [servicesState, setServicesState] = useState({ key: null, items: [], error: null })
  const [selected, setSelected] = useState({ key: null, id: null })

  const destinationKey = `${slug}|${destinationReload}`
  const servicesKey = `${slug}|${type}|${servicesReload}`

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinationBySlug(slug, { signal: controller.signal })
      .then((res) =>
        setDestinationState({ key: destinationKey, destination: res.destination, error: null }),
      )
      .catch((err) => {
        if (err.name === 'AbortError') return
        setDestinationState({ key: destinationKey, destination: null, error: err })
      })
    return () => controller.abort()
  }, [slug, destinationKey])

  useEffect(() => {
    const controller = new AbortController()
    fetchServices({ destination: slug, type, limit: SERVICES_LIMIT }, { signal: controller.signal })
      .then((res) => setServicesState({ key: servicesKey, items: res.items || [], error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setServicesState({ key: servicesKey, items: [], error: err.message })
      })
    return () => controller.abort()
  }, [slug, type, servicesKey])

  const destinationLoading = destinationState.key !== destinationKey
  const servicesLoading = servicesState.key !== servicesKey
  const { destination, error: destinationError } = destinationState
  // La sélection ne vaut que pour la liste affichée (elle s'efface quand on change d'onglet).
  const selectedId = selected.key === `${slug}|${type}` ? selected.id : null

  const selectType = (nextType) => {
    setSearchParams(nextType ? { type: nextType } : {})
  }

  const selectService = (id) => {
    setSelected({ key: `${slug}|${type}`, id })
  }

  const showOnMap = (id) => {
    selectService(id)
    // Sur mobile la carte est au-dessus de la liste : on la ramène à l'écran.
    mapRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }

  if (destinationLoading) {
    return (
      <section className="destination-page" aria-busy="true">
        <div className="container">
          <p className="visually-hidden" role="status">
            Chargement de la destination…
          </p>
          <div className="destination-page__header">
            <div className="skeleton skeleton--line" style={{ width: '20%' }} />
            <div className="skeleton skeleton--line" style={{ width: '45%' }} />
            <div className="skeleton skeleton--line" style={{ width: '70%' }} />
          </div>
          <div className="destination-page__layout">
            <MapPlaceholder />
            <ListSkeleton />
          </div>
        </div>
      </section>
    )
  }

  if (destinationError || !destination) {
    const notFound = destinationError?.status === 404 || destinationError?.status === 400
    return (
      <section className="destination-page">
        <div className="container">
          <div className="destination-page__state" role="alert">
            <h1 className="titre-2">
              {notFound ? 'Destination introuvable' : 'Impossible de charger cette destination'}
            </h1>
            <p className="texte" style={{ color: 'var(--encre-2)' }}>
              {notFound
                ? 'Cette destination n’existe pas ou le lien est incorrect.'
                : destinationError?.message}
            </p>
            {notFound ? (
              <Button to="/" variant="primary">
                Retour à l’accueil
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => setDestinationReload((n) => n + 1)}
              >
                Réessayer
              </Button>
            )}
          </div>
        </div>
      </section>
    )
  }

  const center = toLatLng(destination.location) || TUNISIA_CENTER
  const activeCategory = SERVICE_CATEGORIES.find((cat) => cat.type === type)
  const services = servicesLoading ? NO_SERVICES : servicesState.items
  const total = services.length

  return (
    <section className="destination-page" aria-labelledby="destination-titre">
      <div className="container">
        <Link to="/destinations" className="destination-page__back texte-s">
          <Icon icon={ArrowLeft} size={16} />
          Toutes les destinations
        </Link>

        <header className="destination-page__header">
          {destination.region && <p className="surtitre">{destination.region}</p>}
          <h1 id="destination-titre" className="titre-1">
            {destination.name}
          </h1>
          {destination.description && (
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              {destination.description}
            </p>
          )}
        </header>

        <div className="services-page__tabs" role="group" aria-label="Filtrer par catégorie">
          <button
            type="button"
            className="services-page__tab label"
            aria-pressed={type === ''}
            onClick={() => selectType('')}
          >
            Tous
          </button>
          {SERVICE_CATEGORIES.map((category) => (
            <button
              key={category.type}
              type="button"
              className="services-page__tab label"
              style={{ '--tab-accent': `var(${category.color})` }}
              aria-pressed={type === category.type}
              onClick={() => selectType(category.type)}
            >
              <Icon icon={category.icon} size={16} />
              {category.title}
            </button>
          ))}
        </div>

        <div className="destination-page__layout">
          <div ref={mapRef} className="destination-page__map">
            <Suspense fallback={<MapPlaceholder />}>
              <ServicesMap
                key={slug}
                center={center}
                services={services}
                selectedId={selectedId}
                onSelect={selectService}
                label={`Carte des services à ${destination.name}`}
              />
            </Suspense>
          </div>

          <div className="destination-page__aside">
            <p className="destination-page__count texte-s" aria-live="polite">
              {servicesLoading
                ? 'Chargement des adresses…'
                : `${total} adresse${total > 1 ? 's' : ''}${
                    activeCategory ? ` · ${activeCategory.title}` : ''
                  }`}
            </p>

            {servicesState.error && !servicesLoading ? (
              <div className="destination-page__state" role="alert">
                <h2 className="titre-4">Impossible de charger les services</h2>
                <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
                  {servicesState.error}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setServicesReload((n) => n + 1)}
                >
                  Réessayer
                </Button>
              </div>
            ) : servicesLoading ? (
              <ListSkeleton />
            ) : total === 0 ? (
              <div className="destination-page__state">
                <h2 className="titre-4">Aucun service dans cette catégorie pour le moment.</h2>
                {type && (
                  <Button type="button" variant="secondary" onClick={() => selectType('')}>
                    Voir tous les services
                  </Button>
                )}
              </div>
            ) : (
              <ul className="destination-page__list" aria-label="Services de la destination">
                {services.map((service) => {
                  const category = CATEGORY_MAP[service.type]
                  const price = formatServicePrice(service)
                  const isSelected = service._id === selectedId
                  return (
                    <li
                      key={service._id}
                      className="destination-page__item"
                      data-selected={isSelected}
                      style={{ '--item-accent': `var(${category?.color || '--bleu'})` }}
                    >
                      <div className="destination-page__item-body">
                        <span className="destination-page__item-category legende">
                          {category?.label || service.type}
                        </span>
                        <Link
                          to={`/services/${service._id}`}
                          className="destination-page__item-name titre-4"
                        >
                          {service.name}
                        </Link>
                        <span className="destination-page__item-price texte-s">
                          {price.main} {price.unit}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={MapPin}
                        className="destination-page__locate"
                        aria-label={`Voir ${service.name} sur la carte`}
                        aria-pressed={isSelected}
                        onClick={() => showOnMap(service._id)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
