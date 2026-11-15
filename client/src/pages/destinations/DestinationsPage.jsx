import { MapPin, Search, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import DestinationCard, { DestinationCardSkeleton } from '../../components/DestinationCard.jsx'
import Icon from '../../components/Icon.jsx'
import { fetchDestinations } from '../../lib/destinationsApi.js'
import '../services/ServicesPage.css'
import './DestinationsPage.css'

// Leaflet n'est chargé que sur les pages qui affichent une carte.
const DestinationsMap = lazy(() => import('../../components/DestinationsMap.jsx'))

const PAGE_LIMIT = 12
// La carte et la liste compacte montrent toutes les destinations de la recherche, pas seulement la page.
const MAP_LIMIT = 100
const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0 }
const NO_DESTINATIONS = []

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export default function DestinationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const mapRef = useRef(null)

  // Un seul compteur : « Réessayer » relance la grille et la carte.
  const [reload, setReload] = useState(0)
  const [gridState, setGridState] = useState({ key: null, data: EMPTY_PAGE, error: null })
  const [mapState, setMapState] = useState({ key: null, items: NO_DESTINATIONS, error: null })
  const [selected, setSelected] = useState({ search: null, slug: null })

  const gridKey = `${search}|${page}|${reload}`
  const mapKey = `${search}|${reload}`

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinations({ search, page, limit: PAGE_LIMIT }, { signal: controller.signal })
      .then((res) => setGridState({ key: gridKey, data: res, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setGridState({ key: gridKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [search, page, gridKey])

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinations({ search, limit: MAP_LIMIT }, { signal: controller.signal })
      .then((res) => setMapState({ key: mapKey, items: res.items || NO_DESTINATIONS, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setMapState({ key: mapKey, items: NO_DESTINATIONS, error: err.message })
      })
    return () => controller.abort()
  }, [search, mapKey])

  const gridLoading = gridState.key !== gridKey
  const mapLoading = mapState.key !== mapKey
  const { data, error } = gridState
  const found = mapLoading ? NO_DESTINATIONS : mapState.items
  // La sélection ne vaut que pour la recherche en cours.
  const selectedSlug = selected.search === search ? selected.slug : null

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = new FormData(event.currentTarget).get('search')?.toString().trim()
    setSearchParams(text ? { search: text } : {})
  }

  const clearSearch = () => setSearchParams({})
  const retry = () => setReload((n) => n + 1)

  const selectDestination = (slug) => setSelected({ search, slug })

  const showOnMap = (slug) => {
    selectDestination(slug)
    // Sur mobile la carte est sous la recherche : on la ramène à l'écran.
    mapRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setSearchParams(next)
  }

  return (
    <section className="destinations-page" aria-labelledby="destinations-page-titre">
      <div className="container">
        <header className="destinations-page__header">
          <p className="surtitre">Explorer la Tunisie</p>
          <h1 id="destinations-page-titre" className="titre-1">
            Toutes les destinations
          </h1>
          <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
            Médinas, îles, oasis et villages perchés : choisissez une destination pour voir ses
            adresses sur la carte.
          </p>
        </header>

        <div className="destinations-page__explorer">
          <div className="destinations-page__panel">
            <form role="search" className="destinations-page__search" onSubmit={handleSubmit}>
              <div className="services-page__field destinations-page__field">
                <label htmlFor="recherche-destination" className="legende">
                  Rechercher une destination
                </label>
                <input
                  key={search}
                  id="recherche-destination"
                  name="search"
                  type="search"
                  className="services-page__input texte-s"
                  placeholder="Ex. Djerba, Tozeur, Aïn Draham…"
                  defaultValue={search}
                />
              </div>
              <Button type="submit" variant="primary" icon={Search} size="sm">
                Rechercher
              </Button>
            </form>

            <div className="destinations-page__found">
              <h2 id="destinations-trouvees" className="destinations-page__found-title label">
                Sur la carte
                {!mapLoading && !mapState.error && (
                  <span className="legende"> · {found.length}</span>
                )}
              </h2>

              {mapLoading ? (
                <p className="texte-s destinations-page__found-note">Chargement…</p>
              ) : mapState.error ? (
                <div className="destinations-page__found-note texte-s">
                  <p>Impossible de charger la liste.</p>
                  <Button type="button" variant="ghost" size="sm" onClick={retry}>
                    Réessayer
                  </Button>
                </div>
              ) : found.length === 0 ? (
                <p className="texte-s destinations-page__found-note">
                  {search ? `Aucun résultat pour « ${search} ».` : 'Aucune destination.'}
                </p>
              ) : (
                <ul
                  className="destinations-page__found-list"
                  aria-labelledby="destinations-trouvees"
                >
                  {found.map((destination) => (
                    <li key={destination.slug}>
                      <button
                        type="button"
                        className="destinations-page__found-item"
                        aria-pressed={destination.slug === selectedSlug}
                        aria-label={`Voir ${destination.name} sur la carte`}
                        onClick={() => showOnMap(destination.slug)}
                      >
                        <Icon icon={MapPin} size={16} />
                        <span className="destinations-page__found-name texte-s">
                          {destination.name}
                        </span>
                        {destination.region && (
                          <span className="destinations-page__found-region legende">
                            {destination.region}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div ref={mapRef} className="destinations-page__map">
            <Suspense
              fallback={
                <div className="destinations-page__map-placeholder skeleton" aria-hidden="true" />
              }
            >
              <DestinationsMap
                destinations={found}
                selectedSlug={selectedSlug}
                onSelect={selectDestination}
              />
            </Suspense>
          </div>
        </div>

        <div className="services-page__toolbar texte-s">
          <p aria-live="polite">
            {gridLoading
              ? 'Chargement des destinations…'
              : error
                ? ''
                : `${data.total} destination${data.total > 1 ? 's' : ''}`}
          </p>
          {search && (
            <Button type="button" variant="ghost" icon={X} size="sm" onClick={clearSearch}>
              Effacer la recherche
            </Button>
          )}
        </div>

        <h2 className="visually-hidden">Résultats</h2>

        {gridLoading ? (
          <div className="destinations-page__grid" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <DestinationCardSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="services-page__state" role="alert">
            <h3 className="titre-4">Impossible de charger les destinations</h3>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={retry}>
              Réessayer
            </Button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="services-page__state">
            <h3 className="titre-4">
              {search
                ? `Aucune destination ne correspond à « ${search} »`
                : 'Aucune destination pour le moment'}
            </h3>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {search
                ? 'Vérifiez l’orthographe ou essayez un autre nom.'
                : 'De nouvelles destinations sont ajoutées régulièrement.'}
            </p>
            {search && (
              <Button type="button" variant="secondary" onClick={clearSearch}>
                Effacer la recherche
              </Button>
            )}
          </div>
        ) : (
          <>
            <ul className="destinations-page__grid" role="list">
              {data.items.map((destination) => (
                <li key={destination._id}>
                  <DestinationCard destination={destination} />
                </li>
              ))}
            </ul>

            {data.pages > 1 && (
              <nav className="services-page__pagination" aria-label="Pagination des destinations">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  Précédent
                </Button>
                <span className="texte-s">
                  Page {data.page} sur {data.pages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page >= data.pages}
                  onClick={() => goToPage(page + 1)}
                >
                  Suivant
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  )
}
