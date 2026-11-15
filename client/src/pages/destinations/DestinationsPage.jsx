import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import DestinationCard, { DestinationCardSkeleton } from '../../components/DestinationCard.jsx'
import { fetchDestinations } from '../../lib/destinationsApi.js'
import '../services/ServicesPage.css'
import './DestinationsPage.css'

const PAGE_LIMIT = 12

export default function DestinationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [reload, setReload] = useState(0)
  const [requestState, setRequestState] = useState({
    key: null,
    data: { items: [], total: 0, page: 1, pages: 0 },
    error: null,
  })
  const requestKey = `${search}|${page}|${reload}`

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinations({ search, page, limit: PAGE_LIMIT }, { signal: controller.signal })
      .then((res) => setRequestState({ key: requestKey, data: res, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRequestState({
          key: requestKey,
          data: { items: [], total: 0, page: 1, pages: 0 },
          error: err.message,
        })
      })
    return () => controller.abort()
  }, [search, page, requestKey])

  const loading = requestState.key !== requestKey
  const { data, error } = requestState

  const handleSubmit = (event) => {
    event.preventDefault()
    const text = new FormData(event.currentTarget).get('search')?.toString().trim()
    setSearchParams(text ? { search: text } : {})
  }

  const clearSearch = () => setSearchParams({})

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

        <div className="services-page__toolbar texte-s">
          <p aria-live="polite">
            {loading
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

        {loading ? (
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
            <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
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
