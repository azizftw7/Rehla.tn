import { CircleCheck, Compass, HeartOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import ServiceCard, { ServiceCardSkeleton } from '../../components/ServiceCard.jsx'
import { useFavorites } from '../../hooks/useFavorites.js'
import { FAVORITES_PAGE_SIZE, fetchFavorites, removeFavorite } from '../../lib/favoritesApi.js'
import '../services/ServicesPage.css'
import '../provider/MyServicesPage.css'

const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0 }

/** /mes-favoris (US5.1, voyageur) : services mis en favori, paginés, retrait avec confirmation. */
export default function FavoritesPage() {
  const favorites = useFavorites()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [reload, setReload] = useState(0)
  const requestKey = `${page}|${reload}`
  const [state, setState] = useState({ key: null, data: EMPTY_PAGE, error: null })
  const [toRemove, setToRemove] = useState(null)
  const [removeState, setRemoveState] = useState({ busy: false, error: null })
  const [notice, setNotice] = useState('')
  const titleRef = useRef(null)
  const focusTitleRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchFavorites({ page, limit: FAVORITES_PAGE_SIZE }, { signal: controller.signal })
      .then((res) => setState({ key: requestKey, data: { ...EMPTY_PAGE, ...res }, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ key: requestKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [page, requestKey])

  const loading = state.key !== requestKey
  const { data, error } = state

  // Page vide après un retrait (dernier favori de la dernière page) : page précédente.
  useEffect(() => {
    if (!loading && !error && data.items.length === 0 && page > 1) {
      setSearchParams(data.pages > 1 ? { page: String(data.pages) } : {}, { replace: true })
    }
  }, [loading, error, data, page, setSearchParams])

  // Après un retrait, le bouton a disparu : le focus revient sur le titre.
  useEffect(() => {
    if (!toRemove && focusTitleRef.current) {
      focusTitleRef.current = false
      titleRef.current?.focus()
    }
  }, [toRemove])

  const goToPage = (next) => {
    setNotice('')
    setSearchParams(next > 1 ? { page: String(next) } : {})
    titleRef.current?.focus()
  }

  const confirmRemove = async () => {
    const service = toRemove.service
    setRemoveState({ busy: true, error: null })
    try {
      await removeFavorite(service._id).catch((err) => {
        // Déjà retiré ailleurs : le résultat est le même.
        if (err.status !== 404) throw err
      })
      favorites?.setFavorite(service._id, false)
      setNotice(`« ${service.name} » a été retiré de vos favoris.`)
      focusTitleRef.current = true
      setToRemove(null)
      setReload((n) => n + 1)
    } catch (err) {
      setRemoveState({ busy: false, error: err.message })
    }
  }

  let content
  if (error) {
    content = (
      <div className="services-page__state" role="alert">
        <h2 className="titre-4">Impossible de charger vos favoris</h2>
        <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
          {error}
        </p>
        <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
          Réessayer
        </Button>
      </div>
    )
  } else if (loading) {
    content = (
      <div className="services-page__grid" role="status" aria-label="Chargement de vos favoris">
        {Array.from({ length: 3 }, (_, index) => (
          <ServiceCardSkeleton key={index} />
        ))}
      </div>
    )
  } else if (data.items.length === 0) {
    content = (
      <div className="services-page__state">
        <h2 className="titre-4">Vous n’avez pas encore de favori</h2>
        <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
          Touchez le cœur d’un hébergement, d’un restaurant ou d’une activité pour le retrouver
          ici.
        </p>
        <Button to="/services" variant="accent" icon={Compass}>
          Explorer les services
        </Button>
      </div>
    )
  } else {
    content = (
      <>
        <p className="texte-s mes-services__count">
          {data.total} favori{data.total > 1 ? 's' : ''}
        </p>
        <ul className="services-page__grid mes-services__list" aria-label="Mes favoris">
          {data.items.map(({ _id, service }) => (
            <li key={_id}>
              <ServiceCard service={service} favorite={false}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={HeartOff}
                  className="mes-services__delete"
                  aria-label={`Retirer « ${service.name} » de mes favoris`}
                  onClick={() => {
                    setRemoveState({ busy: false, error: null })
                    setToRemove({ service })
                  }}
                >
                  Retirer
                </Button>
              </ServiceCard>
            </li>
          ))}
        </ul>
        {data.pages > 1 && (
          <nav className="services-page__pagination" aria-label="Pagination de mes favoris">
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
    )
  }

  return (
    <section className="services-page mes-services" aria-labelledby="favoris-titre">
      <title>Mes favoris — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header mes-services__header">
          <div className="mes-services__heading">
            <p className="surtitre">Mon voyage</p>
            <h1 id="favoris-titre" ref={titleRef} tabIndex={-1} className="titre-1">
              Mes favoris
            </h1>
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              Les adresses que vous avez mises de côté pour préparer votre déplacement.
            </p>
          </div>
        </header>

        <div aria-live="polite">
          {notice && (
            <p className="mes-services__notice texte-s">
              <Icon icon={CircleCheck} size={18} />
              {notice}
            </p>
          )}
        </div>

        {content}
      </div>

      {toRemove && (
        <ConfirmDialog
          title="Retirer ce favori ?"
          confirmLabel="Retirer"
          busyLabel="Retrait…"
          confirmIcon={HeartOff}
          busy={removeState.busy}
          error={removeState.error}
          onConfirm={confirmRemove}
          onCancel={() => setToRemove(null)}
        >
          « {toRemove.service.name} » ne sera plus dans vos favoris. Vous pourrez l’y remettre à
          tout moment depuis sa fiche.
        </ConfirmDialog>
      )}
    </section>
  )
}
