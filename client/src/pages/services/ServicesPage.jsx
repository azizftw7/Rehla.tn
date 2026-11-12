import { RotateCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import ServiceCard, { ServiceCardSkeleton } from '../../components/ServiceCard.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { fetchDestinationsList, fetchServices } from '../../lib/servicesApi.js'
import './ServicesPage.css'

const SERVICE_CATEGORIES = CATEGORIES.filter((cat) => cat.type !== 'transport')
const PAGE_LIMIT = 12

export default function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const type = searchParams.get('type') || ''
  const destination = searchParams.get('destination') || ''
  const search = searchParams.get('search') || ''
  const cuisine = searchParams.get('cuisine') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const freeOnly = searchParams.get('free') === 'true'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const [destinations, setDestinations] = useState([])
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinationsList({ signal: controller.signal })
      .then((res) => setDestinations(res.items || []))
      .catch((err) => {
        if (err.name !== 'AbortError') setDestinations([])
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchServices(
      {
        type,
        destination,
        search,
        cuisine: type === 'restaurant' ? cuisine : '',
        maxPrice: !freeOnly ? maxPrice : '',
        free: freeOnly ? 'true' : '',
        page,
        limit: PAGE_LIMIT,
      },
      { signal: controller.signal },
    )
      .then((res) => {
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setLoading(false)
      })

    return () => controller.abort()
  }, [type, destination, search, cuisine, maxPrice, freeOnly, page])

  const updateParams = (updates, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })
    if (resetPage) {
      next.delete('page')
    }
    setSearchParams(next)
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    updateParams({ search: searchInput.trim() })
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearchParams(type ? { type } : {})
  }

  const activeCategory = SERVICE_CATEGORIES.find((cat) => cat.type === type)
  const hasFilters = Boolean(destination || search || cuisine || maxPrice || freeOnly)

  return (
    <section className="services-page" aria-labelledby="services-titre">
      <div className="container">
        <header className="services-page__header">
          <p className="surtitre">Explorer la Tunisie</p>
          <h1 id="services-titre" className="titre-1">
            {activeCategory ? activeCategory.title : 'Tous les services'}
          </h1>
          <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
            {activeCategory
              ? activeCategory.text
              : 'Hébergements, restaurants, activités, événements et guides locaux vérifiés.'}
          </p>
        </header>

        <div className="services-page__tabs" role="group" aria-label="Filtrer par catégorie">
          <button
            type="button"
            className="services-page__tab label"
            aria-pressed={type === ''}
            onClick={() => updateParams({ type: '', cuisine: '' })}
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
              onClick={() =>
                updateParams({
                  type: category.type,
                  cuisine: category.type === 'restaurant' ? cuisine : '',
                })
              }
            >
              <Icon icon={category.icon} size={16} />
              {category.title}
            </button>
          ))}
        </div>

        <form className="services-page__filters" onSubmit={handleSearchSubmit}>
          <div className="services-page__field">
            <label htmlFor="filtre-recherche" className="legende">
              Recherche
            </label>
            <input
              id="filtre-recherche"
              type="search"
              className="services-page__input texte-s"
              placeholder="Nom, spécialité, adresse…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="services-page__field">
            <label htmlFor="filtre-destination" className="legende">
              Destination
            </label>
            <select
              id="filtre-destination"
              className="services-page__input texte-s"
              value={destination}
              onChange={(e) => updateParams({ destination: e.target.value })}
            >
              <option value="">Toutes les destinations</option>
              {destinations.map((dest) => (
                <option key={dest._id} value={dest.slug}>
                  {dest.name} ({dest.region})
                </option>
              ))}
            </select>
          </div>

          {type === 'restaurant' && (
            <div className="services-page__field">
              <label htmlFor="filtre-cuisine" className="legende">
                Type de cuisine
              </label>
              <input
                id="filtre-cuisine"
                type="text"
                className="services-page__input texte-s"
                placeholder="Ex. Tunisienne, Fruits de mer…"
                value={cuisine}
                onChange={(e) => updateParams({ cuisine: e.target.value })}
              />
            </div>
          )}

          <div className="services-page__field">
            <label htmlFor="filtre-prix" className="legende">
              Budget max (DT)
            </label>
            <input
              id="filtre-prix"
              type="number"
              min="0"
              className="services-page__input texte-s"
              placeholder="Ex. 60"
              disabled={freeOnly}
              value={maxPrice}
              onChange={(e) => updateParams({ maxPrice: e.target.value })}
            />
          </div>

          <label className="services-page__checkbox texte-s">
            <input
              type="checkbox"
              checked={freeOnly}
              onChange={(e) => updateParams({ free: e.target.checked ? 'true' : '' })}
            />
            Gratuit uniquement
          </label>

          <Button type="submit" variant="primary">
            <Icon icon={Search} size={16} />
            Rechercher
          </Button>
        </form>

        <div className="services-page__toolbar texte-s">
          <p>
            {loading
              ? 'Chargement des adresses…'
              : `${data.total} résultat${data.total > 1 ? 's' : ''}`}
          </p>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <Icon icon={RotateCcw} size={15} />
              Réinitialiser les filtres
            </Button>
          )}
        </div>

        {error ? (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">Impossible de charger les services</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={() => updateParams({}, false)}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="services-page__grid">
            {Array.from({ length: 6 }, (_, index) => (
              <ServiceCardSkeleton key={index} />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="services-page__state">
            <h2 className="titre-4">Aucun service ne correspond à votre recherche</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              Essayez d’élargir votre budget ou de réinitialiser les filtres.
            </p>
            {hasFilters && (
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Afficher tout
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="services-page__grid">
              {data.items.map((service) => (
                <ServiceCard key={service._id} service={service} />
              ))}
            </div>

            {data.pages > 1 && (
              <nav className="services-page__pagination" aria-label="Pagination des services">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: page - 1 }, false)}
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
                  onClick={() => updateParams({ page: page + 1 }, false)}
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