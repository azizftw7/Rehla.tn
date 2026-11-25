import { CircleCheck, MessageSquareReply, Pencil, Store, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import ReplyForm from '../../components/ReplyForm.jsx'
import ReviewCard from '../../components/ReviewCard.jsx'
import {
  createReply,
  deleteReply,
  fetchReceivedReviews,
  PROVIDER_REVIEWS_PAGE_SIZE,
  updateReply,
} from '../../lib/reviewsApi.js'
import '../services/ServicesPage.css'
import './MyServicesPage.css'
import './ProviderReviewsPage.css'

const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0, unansweredCount: 0 }
const UNANSWERED = 'sans-reponse'

function ReviewsSkeleton() {
  return (
    <ul className="avis-recus__list" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <li key={index} className="review-card">
          <div className="skeleton skeleton--line" style={{ width: '30%' }} />
          <div className="skeleton skeleton--line" style={{ width: '85%' }} />
        </li>
      ))}
    </ul>
  )
}

/**
 * /prestataire/avis (US6.4) : avis laissés sur les services du prestataire, filtre « sans réponse ».
 * Le prestataire répond (une réponse par avis), modifie ou supprime sa réponse.
 */
export default function ProviderReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const unanswered = searchParams.get('filtre') === UNANSWERED
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [reload, setReload] = useState(0)
  const requestKey = `${unanswered}|${page}|${reload}`
  const [state, setState] = useState({ key: null, data: EMPTY_PAGE, error: null })
  const [openForm, setOpenForm] = useState(null) // { id, mode: 'create' | 'edit' }
  const [toDelete, setToDelete] = useState(null)
  const [deleteState, setDeleteState] = useState({ busy: false, error: null })
  const [notice, setNotice] = useState('')
  const titleRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchReceivedReviews(
      { page, limit: PROVIDER_REVIEWS_PAGE_SIZE, unanswered },
      { signal: controller.signal },
    )
      .then((res) => setState({ key: requestKey, data: { ...EMPTY_PAGE, ...res }, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ key: requestKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [page, unanswered, requestKey])

  const loading = state.key !== requestKey
  const { data, error } = state

  const updateParams = (next) => {
    const params = {}
    if (next.unanswered) params.filtre = UNANSWERED
    if (next.page > 1) params.page = String(next.page)
    setSearchParams(params)
    setOpenForm(null)
    setNotice('')
  }

  /** Remplace un avis de la liste et ajuste le compteur « sans réponse ». */
  const replaceReview = (updated, unansweredDelta) =>
    setState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        unansweredCount: Math.max(0, prev.data.unansweredCount + unansweredDelta),
        items: prev.data.items.map((item) =>
          item._id === updated._id ? { ...item, ...updated } : item,
        ),
      },
    }))

  const submitReply = async (review, text) => {
    if (openForm?.mode === 'edit') {
      const res = await updateReply(review._id, text)
      replaceReview(res.review, 0)
      setNotice('Votre réponse est modifiée.')
    } else {
      const res = await createReply(review._id, text)
      replaceReview(res.review, -1)
      setNotice('Votre réponse est publiée : elle s’affiche sous l’avis, sur la fiche du service.')
    }
    setOpenForm(null)
  }

  const confirmDelete = async () => {
    setDeleteState({ busy: true, error: null })
    try {
      await deleteReply(toDelete._id)
      replaceReview({ _id: toDelete._id, providerReply: undefined }, 1)
      setNotice('Votre réponse est supprimée.')
      setToDelete(null)
    } catch (err) {
      setDeleteState({ busy: false, error: err.message })
    }
  }

  const renderReview = (review) => {
    const form = openForm?.id === review._id ? openForm.mode : null
    const hasReply = Boolean(review.providerReply?.text)
    const service = review.service

    return (
      <li key={review._id} className="avis-recus__item">
        <p className="texte-s avis-recus__service">
          <Icon icon={Store} size={16} />
          {service?.hidden ? (
            <>
              <span>{service.name}</span>
              <span className="avis-recus__badge legende">Masqué</span>
            </>
          ) : (
            <Link to={`/services/${service?._id}`}>{service?.name}</Link>
          )}
          {!hasReply && <span className="avis-recus__badge avis-recus__badge--todo legende">Sans réponse</span>}
        </p>
        <ReviewCard
          review={review}
          headingLevel={2}
          hideReply={form === 'edit'}
          replyActions={
            hasReply && !form ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  aria-label={`Modifier ma réponse à ${review.author?.name || 'ce voyageur'}`}
                  onClick={() => {
                    setNotice('')
                    setOpenForm({ id: review._id, mode: 'edit' })
                  }}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="mes-services__delete"
                  aria-label={`Supprimer ma réponse à ${review.author?.name || 'ce voyageur'}`}
                  onClick={() => {
                    setDeleteState({ busy: false, error: null })
                    setToDelete(review)
                  }}
                >
                  Supprimer
                </Button>
              </>
            ) : null
          }
          actions={
            form ? (
              <ReplyForm
                label={form === 'edit' ? 'Modifier votre réponse' : 'Votre réponse'}
                initial={form === 'edit' ? review.providerReply.text : ''}
                submitLabel={form === 'edit' ? 'Enregistrer' : 'Publier la réponse'}
                busyLabel={form === 'edit' ? 'Enregistrement…' : 'Publication…'}
                onSubmit={(text) => submitReply(review, text)}
                onCancel={() => setOpenForm(null)}
              />
            ) : !hasReply ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={MessageSquareReply}
                aria-label={`Répondre à ${review.author?.name || 'ce voyageur'}`}
                onClick={() => {
                  setNotice('')
                  setOpenForm({ id: review._id, mode: 'create' })
                }}
              >
                Répondre
              </Button>
            ) : null
          }
        />
      </li>
    )
  }

  let content
  if (error) {
    content = (
      <div className="services-page__state" role="alert">
        <h2 className="titre-4">Impossible de charger les avis</h2>
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
      <div role="status" aria-label="Chargement des avis">
        <ReviewsSkeleton />
      </div>
    )
  } else if (data.items.length === 0) {
    content = (
      <div className="services-page__state">
        <h2 className="titre-4">
          {unanswered ? 'Vous avez répondu à tous les avis' : 'Aucun avis pour le moment'}
        </h2>
        <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
          {unanswered
            ? 'Bravo ! Les nouveaux avis des voyageurs apparaîtront ici.'
            : 'Les avis que les voyageurs laissent sur vos services apparaîtront ici.'}
        </p>
        {unanswered && (
          <Button type="button" variant="secondary" onClick={() => updateParams({ page: 1 })}>
            Voir tous les avis
          </Button>
        )}
      </div>
    )
  } else {
    content = (
      <>
        <ul className="avis-recus__list" aria-label="Avis reçus">
          {data.items.map(renderReview)}
        </ul>
        {data.pages > 1 && (
          <nav className="services-page__pagination" aria-label="Pagination des avis reçus">
            <Button
              type="button"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => {
                updateParams({ unanswered, page: page - 1 })
                titleRef.current?.focus()
              }}
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
              onClick={() => {
                updateParams({ unanswered, page: page + 1 })
                titleRef.current?.focus()
              }}
            >
              Suivant
            </Button>
          </nav>
        )}
      </>
    )
  }

  return (
    <section className="services-page mes-services" aria-labelledby="avis-recus-titre">
      <title>Avis reçus — Rehla.tn</title>
      <div className="container avis-recus">
        <header className="services-page__header mes-services__header">
          <div className="mes-services__heading">
            <p className="surtitre">Espace prestataire</p>
            <h1 id="avis-recus-titre" ref={titleRef} tabIndex={-1} className="titre-1">
              Avis reçus
            </h1>
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              Répondez aux voyageurs : votre réponse s’affiche sous leur avis, sur la fiche du
              service.
            </p>
          </div>
          <Button to="/prestataire/services" variant="secondary" icon={Store}>
            Mes services
          </Button>
        </header>

        <div className="services-page__tabs" role="group" aria-label="Filtrer les avis">
          <button
            type="button"
            className="services-page__tab"
            aria-pressed={!unanswered}
            onClick={() => updateParams({ page: 1 })}
          >
            Tous les avis
          </button>
          <button
            type="button"
            className="services-page__tab"
            aria-pressed={unanswered}
            onClick={() => updateParams({ unanswered: true, page: 1 })}
          >
            Sans réponse
            {!loading && !error && (
              <span className="avis-recus__count" aria-label={`(${data.unansweredCount})`}>
                {data.unansweredCount}
              </span>
            )}
          </button>
        </div>

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

      {toDelete && (
        <ConfirmDialog
          title="Supprimer votre réponse ?"
          confirmLabel="Supprimer"
          busyLabel="Suppression…"
          confirmIcon={Trash2}
          busy={deleteState.busy}
          error={deleteState.error}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          Votre réponse ne s’affichera plus sous l’avis de {toDelete.author?.name || 'ce voyageur'}.
          L’avis lui-même reste publié.
        </ConfirmDialog>
      )}
    </section>
  )
}
