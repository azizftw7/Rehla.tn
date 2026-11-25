import { Lock } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import TravelerCard from '../../components/TravelerCard.jsx'
import { TRAVELER_PROFILES } from '../../data/travelerProfiles.js'
import { fetchCoTravelers, formatStay, MIN_SHARED_DAYS } from '../../lib/tripSharesApi.js'

const NO_FILTERS = { profile: '', language: '', minDays: false }
const EMPTY = { items: [], total: 0, page: 1, pages: 0, destination: null, languages: [] }

function Chip({ pressed, onClick, children }) {
  return (
    <button type="button" className="partage-chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * « N voyageurs à <destination> sur vos dates » (US5.4) : voyageurs de la même destination
 * aux dates qui chevauchent un de ses partages. Visible seulement si l'on partage soi-même.
 * shares : ses partages actifs ; preferredId : séjour à montrer (celui qu'on vient de publier),
 * sinon le premier.
 */
export default function CoTravelers({ shares, loading: sharesLoading, preferredId }) {
  const id = useId()
  const [selectedId, setSelectedId] = useState(null)
  const share =
    shares.find((item) => item._id === selectedId) ||
    shares.find((item) => item._id === preferredId) ||
    shares[0] ||
    null
  const [filters, setFilters] = useState(NO_FILTERS)
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)

  const requestKey = share
    ? `${share._id}|${share.updatedAt}|${filters.profile}|${filters.language}|${filters.minDays}|${page}|${reload}`
    : null
  const [state, setState] = useState({ key: null, data: EMPTY, error: null })

  useEffect(() => {
    if (!requestKey) return undefined
    const controller = new AbortController()
    fetchCoTravelers(
      share._id,
      {
        profile: filters.profile,
        language: filters.language,
        minDays: filters.minDays ? MIN_SHARED_DAYS : '',
        page,
      },
      { signal: controller.signal },
    )
      .then((res) => setState({ key: requestKey, data: { ...EMPTY, ...res }, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ key: requestKey, data: EMPTY, error: err.message })
      })
    return () => controller.abort()
    // share._id fait partie de requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const updateFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  const headingId = `${id}-titre`

  if (sharesLoading) {
    return (
      <section className="partage-section" aria-labelledby={headingId} aria-busy="true">
        <h2 id={headingId} className="titre-2">
          Voyageurs sur vos dates
        </h2>
        <div className="skeleton skeleton--line" style={{ width: '50%' }} />
      </section>
    )
  }

  if (!share) {
    return (
      <section className="partage-section" aria-labelledby={headingId}>
        <h2 id={headingId} className="titre-2">
          Voyageurs sur vos dates
        </h2>
        <div className="services-page__state partage-section__locked">
          <Icon icon={Lock} size={28} />
          <p className="texte">
            Publiez votre partage pour voir les voyageurs qui partent au même endroit, aux mêmes
            dates.
          </p>
          <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
            Vous ne voyez les autres que si vous partagez vous aussi votre séjour.
          </p>
        </div>
      </section>
    )
  }

  const loading = state.key !== requestKey
  const { data, error } = state
  const destination = data.destination?.name || share.destination?.name || 'votre destination'
  const filtered = Boolean(filters.profile || filters.language || filters.minDays)
  const count = loading ? null : data.total

  return (
    <section className="partage-section" aria-labelledby={headingId}>
      <div className="partage-section__head">
        <h2 id={headingId} className="titre-2" aria-live="polite">
          {count === null
            ? `Voyageurs à ${destination} sur vos dates`
            : `${count} voyageur${count > 1 ? 's' : ''} à ${destination} sur vos dates`}
        </h2>
        <p className="texte" style={{ color: 'var(--encre-2)' }}>
          Visible parce que vous partagez vous aussi votre séjour.
        </p>
      </div>

      {shares.length > 1 && (
        <div className="services-page__field partage-section__select">
          <label htmlFor={`${id}-sejour`} className="label">
            Mon séjour
          </label>
          <select
            id={`${id}-sejour`}
            className="services-page__input"
            value={share._id}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setFilters(NO_FILTERS)
              setPage(1)
            }}
          >
            {shares.map((item) => (
              <option key={item._id} value={item._id}>
                {item.destination?.name} · {formatStay(item.startDate, item.endDate)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="partage-filtres" role="group" aria-label="Filtrer les voyageurs">
        <div className="partage-filtres__groupe" role="group" aria-labelledby={`${id}-profil`}>
          <span id={`${id}-profil`} className="label">
            Profil
          </span>
          <Chip pressed={!filters.profile} onClick={() => updateFilters({ profile: '' })}>
            Tous
          </Chip>
          {TRAVELER_PROFILES.map((profile) => (
            <Chip
              key={profile.value}
              pressed={filters.profile === profile.value}
              onClick={() => updateFilters({ profile: profile.value })}
            >
              {profile.label}
            </Chip>
          ))}
        </div>
        {(data.languages.length > 0 || filters.language) && (
          <div className="partage-filtres__groupe" role="group" aria-labelledby={`${id}-langue`}>
            <span id={`${id}-langue`} className="label">
              Langue
            </span>
            <Chip pressed={!filters.language} onClick={() => updateFilters({ language: '' })}>
              Toutes
            </Chip>
            {[...new Set([...data.languages, filters.language].filter(Boolean))].map(
              (language) => (
                <Chip
                  key={language}
                  pressed={filters.language === language}
                  onClick={() => updateFilters({ language })}
                >
                  {language}
                </Chip>
              ),
            )}
          </div>
        )}
        <div className="partage-filtres__groupe">
          <Chip
            pressed={filters.minDays}
            onClick={() => updateFilters({ minDays: !filters.minDays })}
          >
            {MIN_SHARED_DAYS} jours en commun ou plus
          </Chip>
        </div>
      </div>

      {error ? (
        <div className="services-page__state" role="alert">
          <h3 className="titre-4">Impossible de charger les voyageurs</h3>
          <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
            {error}
          </p>
          <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
            Réessayer
          </Button>
        </div>
      ) : loading ? (
        <div className="partage-grille" role="status" aria-label="Chargement des voyageurs">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="traveler-card" aria-hidden="true">
              <div className="skeleton skeleton--line" style={{ width: '50%' }} />
              <div className="skeleton skeleton--line" />
              <div className="skeleton skeleton--line" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="services-page__state">
          <h3 className="titre-4">
            {filtered
              ? 'Aucun voyageur ne correspond à ces filtres'
              : `Personne d’autre à ${destination} sur vos dates pour l’instant`}
          </h3>
          <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
            {filtered
              ? 'Essayez avec moins de filtres.'
              : 'Revenez plus tard : les nouveaux partages apparaîtront ici.'}
          </p>
          {filtered && (
            <Button type="button" variant="secondary" onClick={() => updateFilters(NO_FILTERS)}>
              Effacer les filtres
            </Button>
          )}
        </div>
      ) : (
        <>
          <ul className="partage-grille" aria-label={`Voyageurs à ${destination}`}>
            {data.items.map((traveler) => (
              <li key={traveler._id}>
                <TravelerCard traveler={traveler} />
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <nav className="services-page__pagination" aria-label="Pagination des voyageurs">
              <Button
                type="button"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
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
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
