import { ArrowLeft, MapPin } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import '../../components/DestinationCard.css'
import Icon from '../../components/Icon.jsx'
import MapFilters from '../../components/MapFilters.jsx'
import TransportCard from '../../components/TransportCard.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { TRANSPORT_TYPE_MAP, TRANSPORT_TYPES } from '../../data/transportTypes.js'
import { fetchDestinationBySlug, toLatLng } from '../../lib/destinationsApi.js'
import {
  countActiveFilters,
  EMPTY_FILTERS,
  parseMapFilters,
  toApiParams,
  toSearchParams,
} from '../../lib/mapFilters.js'
import { fetchServices, formatServicePrice } from '../../lib/servicesApi.js'
import { fetchTransports } from '../../lib/transportsApi.js'
import '../services/ServicesPage.css'
import './DestinationPage.css'

// Leaflet n'est chargé que sur cette page.
const ServicesMap = lazy(() => import('../../components/ServicesMap.jsx'))

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))
const TRANSPORT_CATEGORY = CATEGORY_MAP.transport
const SERVICES_LIMIT = 100
const TRANSPORTS_LIMIT = 100
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

/** Liste des transports pour rejoindre la destination, filtrable par type (US4.1). */
function TransportsPanel({ state, loading, mode, destinationName, onSelectMode, onRetry }) {
  const transports = loading ? [] : state.items
  const total = transports.length
  const activeMode = TRANSPORT_TYPE_MAP[mode]

  return (
    <>
      <div
        className="services-page__tabs destination-page__modes"
        role="group"
        aria-label="Filtrer par type de transport"
        style={{ '--tab-accent': `var(${TRANSPORT_CATEGORY.color})` }}
      >
        <button
          type="button"
          className="services-page__tab label"
          aria-pressed={mode === ''}
          onClick={() => onSelectMode('')}
        >
          Tous
        </button>
        {TRANSPORT_TYPES.map((transportType) => (
          <button
            key={transportType.value}
            type="button"
            className="services-page__tab label"
            aria-pressed={mode === transportType.value}
            onClick={() => onSelectMode(transportType.value)}
          >
            <Icon icon={transportType.icon} size={16} />
            {transportType.label}
          </button>
        ))}
      </div>

      <p className="destination-page__count texte-s" aria-live="polite">
        {loading
          ? 'Chargement des transports…'
          : `${total} transport${total > 1 ? 's' : ''}${activeMode ? ` · ${activeMode.title}` : ''}`}
      </p>

      {state.error && !loading ? (
        <div className="destination-page__state" role="alert">
          <h2 className="titre-4">Impossible de charger les transports</h2>
          <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
            {state.error}
          </p>
          <Button type="button" variant="primary" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      ) : loading ? (
        <ListSkeleton />
      ) : total === 0 ? (
        <div className="destination-page__state">
          <h2 className="titre-4">Aucun transport référencé pour cette destination.</h2>
          {mode && (
            <Button type="button" variant="secondary" onClick={() => onSelectMode('')}>
              Voir tous les transports
            </Button>
          )}
        </div>
      ) : (
        <ul
          className="destination-page__list"
          aria-label={`Transports pour rejoindre ${destinationName}`}
        >
          {transports.map((transport) => (
            <li key={transport._id}>
              <TransportCard transport={transport} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function DestinationPage() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  // Filtres de la carte, lus dans l'URL (US2.3).
  const filters = useMemo(() => parseMapFilters(searchParams), [searchParams])
  // Requête de l'API sous forme de texte : l'effet ne se relance que si elle change.
  const apiQuery = new URLSearchParams(toApiParams(filters)).toString()
  // Onglet « Transports » (US4.1) : la liste affiche les transports à la place des services.
  const isTransport = filters.transport
  const rawMode = isTransport ? searchParams.get('mode') || '' : ''
  const transportMode = TRANSPORT_TYPE_MAP[rawMode] ? rawMode : ''
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

  const [transportsReload, setTransportsReload] = useState(0)
  const [transportsState, setTransportsState] = useState({ key: null, items: [], error: null })

  const destinationKey = `${slug}|${destinationReload}`
  const servicesKey = `${slug}|${apiQuery}|${servicesReload}`
  const transportsKey = `${slug}|${transportMode}|${transportsReload}`

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
    if (isTransport) return undefined
    const controller = new AbortController()
    const params = Object.fromEntries(new URLSearchParams(apiQuery))
    fetchServices(
      { destination: slug, ...params, limit: SERVICES_LIMIT },
      { signal: controller.signal },
    )
      .then((res) => setServicesState({ key: servicesKey, items: res.items || [], error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setServicesState({ key: servicesKey, items: [], error: err.message })
      })
    return () => controller.abort()
  }, [slug, apiQuery, isTransport, servicesKey])

  useEffect(() => {
    if (!isTransport) return undefined
    const controller = new AbortController()
    fetchTransports(
      { destination: slug, type: transportMode, limit: TRANSPORTS_LIMIT },
      { signal: controller.signal },
    )
      .then((res) =>
        setTransportsState({ key: transportsKey, items: res.items || [], error: null }),
      )
      .catch((err) => {
        if (err.name === 'AbortError') return
        setTransportsState({ key: transportsKey, items: [], error: err.message })
      })
    return () => controller.abort()
  }, [slug, isTransport, transportMode, transportsKey])

  const destinationLoading = destinationState.key !== destinationKey
  const servicesLoading = servicesState.key !== servicesKey
  const transportsLoading = transportsState.key !== transportsKey
  const { destination, error: destinationError } = destinationState
  // La sélection ne vaut que pour la liste affichée (elle s'efface quand on change d'onglet).
  const selectedId = selected.key === `${slug}|${apiQuery}` ? selected.id : null

  // L'URL garde les filtres (lien partageable, rechargement) sans empiler l'historique à chaque
  // réglage ; la carte se recadre d'elle-même sur les nouveaux résultats (ServicesMap).
  const changeFilters = (nextFilters) => {
    setSearchParams(toSearchParams(nextFilters), { replace: true })
  }

  const clearFilters = () => changeFilters({ ...EMPTY_FILTERS, types: filters.types })

  const selectTransportMode = (nextMode) => {
    setSearchParams(toSearchParams({ ...EMPTY_FILTERS, transport: true }, { mode: nextMode }))
  }

  const selectService = (id) => {
    setSelected({ key: `${slug}|${apiQuery}`, id })
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
  const activeCategory = filters.types.length === 1 ? CATEGORY_MAP[filters.types[0]] : null
  const activeFilters = countActiveFilters(filters)
  // Onglet Transports : aucun marqueur, la carte reste centrée sur la destination.
  const services = isTransport || servicesLoading ? NO_SERVICES : servicesState.items
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

        <MapFilters filters={filters} onChange={changeFilters} />

        <div className="destination-page__layout">
          <div ref={mapRef} className="destination-page__map">
            <Suspense fallback={<MapPlaceholder />}>
              <ServicesMap
                key={slug}
                center={center}
                services={services}
                selectedId={selectedId}
                onSelect={selectService}
                label={
                  isTransport
                    ? `Carte de ${destination.name}`
                    : `Carte des services à ${destination.name}`
                }
              />
            </Suspense>
          </div>

          <div className="destination-page__aside">
            {isTransport ? (
              <TransportsPanel
                state={transportsState}
                loading={transportsLoading}
                mode={transportMode}
                destinationName={destination.name}
                onSelectMode={selectTransportMode}
                onRetry={() => setTransportsReload((n) => n + 1)}
              />
            ) : (
              <>
                <p className="destination-page__count texte-s" aria-live="polite">
                  {servicesLoading
                    ? 'Chargement des adresses…'
                    : `${total} adresse${total > 1 ? 's' : ''}${
                        activeCategory ? ` · ${activeCategory.title}` : ''
                      }${
                        activeFilters > 0
                          ? ` · ${activeFilters} filtre${activeFilters > 1 ? 's' : ''}`
                          : ''
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
                ) : total === 0 && activeFilters > 0 ? (
                  <div className="destination-page__state">
                    <h2 className="titre-4">Aucun service ne correspond à ces filtres.</h2>
                    <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
                      Élargissez le prix, la note ou la période pour voir plus d’adresses.
                    </p>
                    <Button type="button" variant="secondary" onClick={clearFilters}>
                      Effacer les filtres
                    </Button>
                  </div>
                ) : total === 0 ? (
                  <div className="destination-page__state">
                    <h2 className="titre-4">Aucun service dans cette catégorie pour le moment.</h2>
                    {filters.types.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => changeFilters(EMPTY_FILTERS)}
                      >
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
