import { LogIn, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import ReviewCard from '../../components/ReviewCard.jsx'
import ReviewForm from '../../components/ReviewForm.jsx'
import StarRating from '../../components/StarRating.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import {
  createReview,
  deleteReview,
  fetchMyReview,
  fetchServiceReviews,
  formatRating,
  updateReview,
} from '../../lib/reviewsApi.js'
import './ServiceReviews.css'

const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0, summary: null }
const RATINGS = [5, 4, 3, 2, 1]

function ReviewsSkeleton({ count = 2 }) {
  return (
    <ul className="service-reviews__list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="review-card">
          <div className="skeleton skeleton--line" style={{ width: '40%' }} />
          <div className="skeleton skeleton--line" style={{ width: '90%' }} />
        </li>
      ))}
    </ul>
  )
}

/** Moyenne, nombre d'avis et répartition des notes (barres). */
function ReviewsSummary({ summary }) {
  const { average, count, distribution = {} } = summary
  return (
    <div className="service-reviews__summary">
      <div className="service-reviews__average">
        <p className="service-reviews__average-value" aria-hidden="true">
          {formatRating(average)}
        </p>
        <StarRating value={average} size={18} />
        <p className="legende service-reviews__count">
          {count} avis
        </p>
      </div>
      <ul className="service-reviews__bars" aria-label="Répartition des notes">
        {RATINGS.map((rating) => {
          const n = distribution[rating] || 0
          const percent = count > 0 ? Math.round((n / count) * 100) : 0
          return (
            <li key={rating} className="service-reviews__bar texte-s">
              <span aria-hidden="true">{rating} ★</span>
              <span className="service-reviews__track" aria-hidden="true">
                <span className="service-reviews__fill" style={{ width: `${percent}%` }} />
              </span>
              <span aria-hidden="true">{n}</span>
              <span className="visually-hidden">
                {rating} étoile{rating > 1 ? 's' : ''} : {n} avis
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Avis d'un service (US3.5), sur la fiche détaillée :
 * - tout le monde voit la moyenne, la répartition et la liste paginée ;
 * - un voyageur connecté publie un avis (un seul par service), le modifie ou le supprime ;
 * - un visiteur est invité à se connecter.
 * onSummaryChange({ average, count }) : met à jour la note affichée en haut de la fiche.
 */
export default function ServiceReviews({ serviceId, initialSummary, onSummaryChange }) {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const isTraveler = user?.role === 'voyageur'

  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [listState, setListState] = useState({ key: null, data: EMPTY_PAGE, error: null })
  const listKey = `${serviceId}|${page}|${reload}`

  const mineKey = isTraveler ? `${serviceId}|${user._id}|${reload}` : null
  const [mineState, setMineState] = useState({ key: null, review: null, error: null })

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState({ open: false, busy: false, error: null })
  const [notice, setNotice] = useState('')

  // Référence stable : l'effet ne se relance pas quand le parent recrée la fonction.
  const onSummaryRef = useRef(onSummaryChange)
  useEffect(() => {
    onSummaryRef.current = onSummaryChange
  })

  useEffect(() => {
    const controller = new AbortController()
    fetchServiceReviews(serviceId, { page }, { signal: controller.signal })
      .then((res) => {
        const data = { ...EMPTY_PAGE, ...res, items: res.items || [] }
        setListState({ key: listKey, data, error: null })
        if (res.summary) onSummaryRef.current?.(res.summary)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setListState({ key: listKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [serviceId, page, listKey])

  useEffect(() => {
    if (!mineKey) return undefined
    const controller = new AbortController()
    fetchMyReview(serviceId, { signal: controller.signal })
      .then((res) => setMineState({ key: mineKey, review: res.review || null, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setMineState({ key: mineKey, review: null, error: err.message })
      })
    return () => controller.abort()
  }, [serviceId, mineKey])

  const listLoading = listState.key !== listKey
  const mineLoading = Boolean(mineKey) && mineState.key !== mineKey
  const { data, error } = listState
  const summary = data.summary || initialSummary
  const myReview = mineState.review

  /** Après une publication, une modification ou une suppression : tout recharger, page 1. */
  const refresh = (message) => {
    setNotice(message)
    setEditing(false)
    setPage(1)
    setReload((n) => n + 1)
  }

  const handleCreate = async (values) => {
    await createReview(serviceId, values)
    refresh('Merci ! Votre avis est publié.')
  }

  const handleUpdate = async (values) => {
    await updateReview(myReview._id, values)
    refresh('Votre avis est modifié.')
  }

  const handleDelete = async () => {
    setDeleting({ open: true, busy: true, error: null })
    try {
      await deleteReview(myReview._id)
      setDeleting({ open: false, busy: false, error: null })
      refresh('Votre avis est supprimé.')
    } catch (err) {
      setDeleting({ open: true, busy: false, error: err.message })
    }
  }

  const goToPage = (next) => {
    setNotice('')
    setPage(next)
  }

  // Zone d'action selon la session (rien tant que la session se charge).
  let action = null
  if (authLoading) {
    // Session en cours de vérification.
  } else if (!user) {
    action = (
      <div className="service-reviews__cta">
        <p className="texte-s">Vous connaissez cette adresse ? Partagez votre expérience.</p>
        <Button to="/connexion" state={{ from: location }} variant="secondary" icon={LogIn}>
          Se connecter pour donner mon avis
        </Button>
      </div>
    )
  } else if (!isTraveler) {
    action = (
      <p className="texte-s service-reviews__hint">Seuls les voyageurs peuvent laisser un avis.</p>
    )
  } else if (mineLoading) {
    action = <ReviewsSkeleton count={1} />
  } else if (mineState.error) {
    action = (
      <div className="service-reviews__cta" role="alert">
        <p className="texte-s">Impossible de vérifier si vous avez déjà donné votre avis.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setReload((n) => n + 1)}>
          Réessayer
        </Button>
      </div>
    )
  } else if (myReview && editing) {
    action = (
      <ReviewForm
        title="Modifier mon avis"
        initial={{ rating: myReview.rating, comment: myReview.comment }}
        submitLabel="Enregistrer"
        busyLabel="Enregistrement…"
        onSubmit={handleUpdate}
        onCancel={() => setEditing(false)}
      />
    )
  } else if (myReview) {
    action = (
      <div className="service-reviews__mine">
        <h3 className="titre-4">Votre avis</h3>
        <ReviewCard
          review={myReview}
          headingLevel={4}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Pencil}
                onClick={() => {
                  setNotice('')
                  setEditing(true)
                }}
              >
                Modifier
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={() => setDeleting({ open: true, busy: false, error: null })}
              >
                Supprimer
              </Button>
            </>
          }
        />
      </div>
    )
  } else {
    action = <ReviewForm title="Donner mon avis" onSubmit={handleCreate} />
  }

  return (
    <section className="service-detail__section service-reviews" aria-labelledby="avis-titre">
      <h2 id="avis-titre" className="titre-3">
        Avis des voyageurs
      </h2>

      {summary?.count > 0 && <ReviewsSummary summary={summary} />}

      {/* Zone toujours présente : les lecteurs d'écran annoncent le message quand il apparaît. */}
      <div aria-live="polite" className="service-reviews__live">
        {notice && <p className="service-reviews__notice texte-s">{notice}</p>}
      </div>

      {action}

      {listLoading ? (
        <ReviewsSkeleton />
      ) : error ? (
        <div className="services-page__state" role="alert">
          <h3 className="titre-4">Impossible de charger les avis</h3>
          <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
            {error}
          </p>
          <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
            Réessayer
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <p className="texte-s service-reviews__empty">
          Aucun avis pour le moment.
          {isTraveler && !myReview && ' Soyez le premier à partager votre expérience !'}
        </p>
      ) : (
        <>
          <ul className="service-reviews__list" aria-label="Avis des voyageurs">
            {data.items.map((review) => (
              <li key={review._id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>

          {data.pages > 1 && (
            <nav className="services-page__pagination" aria-label="Pagination des avis">
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

      {deleting.open && (
        <ConfirmDialog
          title="Supprimer votre avis ?"
          confirmLabel="Supprimer"
          confirmIcon={Trash2}
          busy={deleting.busy}
          busyLabel="Suppression…"
          error={deleting.error}
          onConfirm={handleDelete}
          onCancel={() => setDeleting({ open: false, busy: false, error: null })}
        >
          Votre note et votre commentaire seront retirés de cette fiche. Vous pourrez donner un
          nouvel avis plus tard.
        </ConfirmDialog>
      )}
    </section>
  )
}
