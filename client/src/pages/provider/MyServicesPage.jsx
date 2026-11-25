import { CircleCheck, Eye, EyeOff, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import ServiceCard, { ServiceCardSkeleton } from '../../components/ServiceCard.jsx'
import { deleteService, fetchMyServices, setServiceHidden } from '../../lib/servicesApi.js'
import { FormAlert } from '../auth/AuthLayout.jsx'
import '../services/ServicesPage.css'
import './MyServicesPage.css'

const PAGE_LIMIT = 12
const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0 }

const editUrl = (service) => `/prestataire/services/${service._id}/modifier`

/** /prestataire/services : le prestataire voit, modifie, masque/réaffiche et supprime ses services. */
export default function MyServicesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [reload, setReload] = useState(0)
  const requestKey = `${page}:${reload}`
  const [requestState, setRequestState] = useState({
    fetchedKey: null,
    data: EMPTY_PAGE,
    error: null,
  })
  // Message de confirmation : après une modification (state.notice) ou une action de la page.
  const [notice, setNotice] = useState(location.state?.notice || null)
  const [actionError, setActionError] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [deleteState, setDeleteState] = useState({ busy: false, error: null })
  const titleRef = useRef(null)
  const focusTitleRef = useRef(false)

  // Après une suppression, le bouton « Supprimer » a disparu : le focus va sur le titre
  // (une fois la boîte de dialogue fermée, qui rend sinon le focus au bouton d'ouverture).
  useEffect(() => {
    if (!toDelete && focusTitleRef.current) {
      focusTitleRef.current = false
      titleRef.current?.focus()
    }
  }, [toDelete])

  // Le message transmis par la page de modification ne doit pas revenir au rechargement.
  useEffect(() => {
    if (location.state?.notice) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    }
  }, [location.state, location.pathname, location.search, navigate])

  useEffect(() => {
    const controller = new AbortController()
    fetchMyServices({ page, limit: PAGE_LIMIT }, { signal: controller.signal })
      .then((res) => setRequestState({ fetchedKey: requestKey, data: res, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRequestState({ fetchedKey: requestKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [page, requestKey])

  const loading = requestState.fetchedKey !== requestKey
  const { data, error } = requestState

  // Page vide après une suppression (ex. dernier service de la dernière page) : page précédente.
  useEffect(() => {
    if (!loading && !error && data.items.length === 0 && page > 1) {
      setSearchParams(data.pages > 1 ? { page: String(data.pages) } : {}, { replace: true })
    }
  }, [loading, error, data, page, setSearchParams])

  const goToPage = (next) => {
    setSearchParams(next > 1 ? { page: String(next) } : {})
    titleRef.current?.focus()
  }

  const replaceItem = (updated) =>
    setRequestState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        items: prev.data.items.map((item) => (item._id === updated._id ? updated : item)),
      },
    }))

  const toggleVisibility = async (service) => {
    setPendingId(service._id)
    setActionError(null)
    setNotice(null)
    try {
      const { service: updated } = await setServiceHidden(service._id, !service.hidden)
      replaceItem(updated)
      setNotice(
        updated.hidden
          ? `« ${updated.name} » est masqué : les voyageurs ne le voient plus.`
          : `« ${updated.name} » est de nouveau visible par les voyageurs.`,
      )
    } catch (err) {
      setActionError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  const openDelete = (service) => {
    setDeleteState({ busy: false, error: null })
    setToDelete(service)
  }

  const confirmDelete = async () => {
    setDeleteState({ busy: true, error: null })
    try {
      await deleteService(toDelete._id)
      setNotice(`« ${toDelete.name} » a été supprimé.`)
      setActionError(null)
      focusTitleRef.current = true
      setToDelete(null)
      setReload((n) => n + 1)
    } catch (err) {
      setDeleteState({ busy: false, error: err.message })
    }
  }

  const total = data.total

  return (
    <section className="services-page mes-services" aria-labelledby="mes-services-titre">
      <title>Mes services — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header mes-services__header">
          <div className="mes-services__heading">
            <p className="surtitre">Espace prestataire</p>
            <h1 id="mes-services-titre" ref={titleRef} tabIndex={-1} className="titre-1">
              Mes services
            </h1>
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              Modifiez vos fiches, masquez-les le temps d’une fermeture ou supprimez-les.
            </p>
          </div>
          <div className="mes-services__header-actions">
            <Button to="/prestataire/avis" variant="secondary" icon={MessageSquareText}>
              Avis reçus
            </Button>
            <Button to="/prestataire/services/nouveau" variant="accent" icon={Plus}>
              Publier un service
            </Button>
          </div>
        </header>

        {notice && (
          <p className="mes-services__notice texte-s" role="status">
            <Icon icon={CircleCheck} size={18} />
            {notice}
          </p>
        )}
        {actionError && (
          <div className="mes-services__alert">
            <FormAlert>{actionError}</FormAlert>
          </div>
        )}

        {error ? (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">Impossible de charger vos services</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="services-page__grid" role="status" aria-label="Chargement de vos services">
            {Array.from({ length: 3 }, (_, index) => (
              <ServiceCardSkeleton key={index} />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="services-page__state">
            <h2 className="titre-4">Vous n’avez encore publié aucun service</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              Présentez votre hébergement, votre restaurant, une activité, un événement ou vos
              visites guidées : les voyageurs le verront sur la carte.
            </p>
            <Button to="/prestataire/services/nouveau" variant="accent" icon={Plus}>
              Publier mon premier service
            </Button>
          </div>
        ) : (
          <>
            <p className="texte-s mes-services__count">
              {total} service{total > 1 ? 's' : ''} publié{total > 1 ? 's' : ''}
            </p>
            <ul className="services-page__grid mes-services__list" role="list">
              {data.items.map((service) => {
                const busy = pendingId === service._id
                return (
                  <li key={service._id}>
                    <ServiceCard
                      service={service}
                      to={service.hidden || service.hiddenByAdmin ? editUrl(service) : undefined}
                    >
                      <Button
                        to={editUrl(service)}
                        variant="secondary"
                        size="sm"
                        icon={Pencil}
                        aria-label={`Modifier « ${service.name} »`}
                      >
                        Modifier
                      </Button>
                      {/* US7.2 : masqué par la modération, seul l'administrateur peut le réafficher. */}
                      {service.hiddenByAdmin ? (
                        <p className="legende mes-services__moderation-hint">
                          Seul l’administrateur peut le réafficher.
                        </p>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={service.hidden ? Eye : EyeOff}
                          disabled={busy}
                          aria-label={`${service.hidden ? 'Afficher' : 'Masquer'} « ${service.name} »`}
                          onClick={() => toggleVisibility(service)}
                        >
                          {service.hidden ? 'Afficher' : 'Masquer'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="mes-services__delete"
                        disabled={busy}
                        aria-label={`Supprimer « ${service.name} »`}
                        onClick={() => openDelete(service)}
                      >
                        Supprimer
                      </Button>
                    </ServiceCard>
                  </li>
                )
              })}
            </ul>

            {data.pages > 1 && (
              <nav className="services-page__pagination" aria-label="Pagination de mes services">
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

      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce service ?"
          confirmLabel="Supprimer définitivement"
          busyLabel="Suppression…"
          confirmIcon={Trash2}
          busy={deleteState.busy}
          error={deleteState.error}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>
            « {toDelete.name} » sera retiré de la carte et du catalogue, avec ses photos, ses avis
            et ses offres. Cette action est définitive.
          </p>
          <p>Pour le retirer seulement quelque temps, utilisez plutôt « Masquer ».</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
