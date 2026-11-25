import { CircleCheck, Eye, Luggage, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { fetchDestinationsList } from '../../lib/servicesApi.js'
import {
  createTripShare,
  deleteTripShare,
  fetchMyTripShares,
  formatDayMonth,
  formatStay,
  updateTripShare,
} from '../../lib/tripSharesApi.js'
import '../services/ServicesPage.css'
import '../provider/MyServicesPage.css'
import CoTravelers from './CoTravelers.jsx'
import TripShareForm from './TripShareForm.jsx'
import { EMPTY_FORM, formFromShare } from './tripShareValues.js'
import './TripSharePage.css'

/** Destinations proposées dans le formulaire. */
function useDestinations() {
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ key: null, items: [], error: null })
  useEffect(() => {
    const controller = new AbortController()
    fetchDestinationsList({ signal: controller.signal })
      .then((res) => setState({ key: reload, items: res.items || [], error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ key: reload, items: [], error: err.message })
      })
    return () => controller.abort()
  }, [reload])
  return {
    items: state.items,
    loading: state.key !== reload,
    error: state.error,
    retry: () => setReload((n) => n + 1),
  }
}

/**
 * /partage (US5.3, US5.4, voyageur) : publier un partage de déplacement avec l'aperçu de ce que
 * les autres voient, voir les voyageurs aux mêmes dates, gérer ses partages.
 */
export default function TripSharePage() {
  const { user } = useAuth()
  const destinations = useDestinations()

  const [reload, setReload] = useState(0)
  const [sharesState, setSharesState] = useState({ key: null, items: [], error: null })
  const [editing, setEditing] = useState(null) // partage en cours de modification
  const [formKey, setFormKey] = useState(0) // remet le formulaire à zéro
  const [notice, setNotice] = useState('')
  const [lastShareId, setLastShareId] = useState(null) // séjour montré aux co-voyageurs
  const [toDelete, setToDelete] = useState(null)
  const [deleteState, setDeleteState] = useState({ busy: false, error: null })
  const formRef = useRef(null)
  const sharesTitleRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchMyTripShares({}, { signal: controller.signal })
      .then((res) => setSharesState({ key: reload, items: res.items || [], error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setSharesState({ key: reload, items: [], error: err.message })
      })
    return () => controller.abort()
  }, [reload])

  const sharesLoading = sharesState.key !== reload
  const shares = sharesState.items

  const resetForm = () => {
    setEditing(null)
    setFormKey((n) => n + 1)
  }

  const handleSubmit = async (body) => {
    if (editing) {
      const { tripShare } = await updateTripShare(editing._id, body)
      setLastShareId(tripShare?._id ?? editing._id)
      setNotice('Votre partage est modifié.')
    } else {
      const { tripShare } = await createTripShare(body)
      setLastShareId(tripShare?._id ?? null)
      setNotice('Votre partage est publié : les voyageurs aux mêmes dates peuvent vous voir.')
    }
    resetForm()
    setReload((n) => n + 1)
  }

  const startEdit = (share) => {
    setNotice('')
    setEditing(share)
    setFormKey((n) => n + 1)
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    // Le focus va sur le premier champ du formulaire rechargé.
    requestAnimationFrame(() => formRef.current?.querySelector('select')?.focus())
  }

  const confirmDelete = async () => {
    setDeleteState({ busy: true, error: null })
    try {
      await deleteTripShare(toDelete._id)
      if (editing?._id === toDelete._id) resetForm()
      setNotice(`Votre partage à ${toDelete.destination?.name || 'cette destination'} est supprimé.`)
      setToDelete(null)
      setReload((n) => n + 1)
      sharesTitleRef.current?.focus()
    } catch (err) {
      setDeleteState({ busy: false, error: err.message })
    }
  }

  let mySharesContent
  if (sharesState.error && !sharesLoading) {
    mySharesContent = (
      <div className="services-page__state" role="alert">
        <h3 className="titre-4">Impossible de charger vos partages</h3>
        <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
          {sharesState.error}
        </p>
        <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
          Réessayer
        </Button>
      </div>
    )
  } else if (sharesLoading) {
    mySharesContent = (
      <div role="status" aria-label="Chargement de vos partages">
        <div className="partage-ligne skeleton" aria-hidden="true" />
      </div>
    )
  } else if (shares.length === 0) {
    mySharesContent = (
      <p className="texte-s partage-section__empty">
        Vous n’avez aucun partage en cours. Remplissez le formulaire ci-dessus pour publier le
        vôtre.
      </p>
    )
  } else {
    mySharesContent = (
      <ul className="partage-lignes" aria-label="Mes partages">
        {shares.map((share) => {
          const label = `${share.destination?.name} · ${formatStay(share.startDate, share.endDate)}`
          const count = share.travelersCount ?? 0
          return (
            <li key={share._id} className="partage-ligne">
              <span className="partage-ligne__icon" aria-hidden="true">
                <Icon icon={Luggage} size={22} />
              </span>
              <div className="partage-ligne__texte">
                <p className="titre-4">{label}</p>
                <p className="texte-s partage-ligne__meta">
                  Visible par {count} voyageur{count > 1 ? 's' : ''} · s’efface le{' '}
                  {formatDayMonth(share.expiresAt)}
                </p>
              </div>
              <span className="partage-ligne__badge legende">
                <Icon icon={Eye} size={14} />
                Visible
              </span>
              <div className="partage-ligne__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  aria-label={`Modifier le partage ${label}`}
                  onClick={() => startEdit(share)}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  className="mes-services__delete"
                  aria-label={`Supprimer le partage ${label}`}
                  onClick={() => {
                    setDeleteState({ busy: false, error: null })
                    setToDelete(share)
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="partage-page">
      <title>Partage de voyage — Rehla.tn</title>
      <section className="container partage-page__intro" aria-labelledby="partage-page-titre">
        <header className="section-head partage-page__head">
          <p className="surtitre">Partage de voyage</p>
          <h1 id="partage-page-titre" className="titre-1">
            Partager mon déplacement
          </h1>
          <p className="texte-l">
            Les voyageurs qui partent au même endroit, aux mêmes dates, pourront vous trouver. Vous
            choisissez ce qu’ils voient.
          </p>
        </header>

        <div aria-live="polite">
          {notice && (
            <p className="mes-services__notice texte-s">
              <Icon icon={CircleCheck} size={18} />
              {notice}
            </p>
          )}
        </div>

        <div ref={formRef}>
          <TripShareForm
            key={formKey}
            user={user}
            destinations={destinations}
            initial={editing ? formFromShare(editing) : EMPTY_FORM}
            editing={Boolean(editing)}
            onSubmit={handleSubmit}
            onCancel={() => {
              setNotice('')
              resetForm()
            }}
          />
        </div>
      </section>

      <div className="container">
        <CoTravelers shares={shares} loading={sharesLoading} preferredId={lastShareId} />

        <section className="partage-section" aria-labelledby="mes-partages-titre">
          <h2 id="mes-partages-titre" ref={sharesTitleRef} tabIndex={-1} className="titre-2">
            Mes partages
          </h2>
          {mySharesContent}
        </section>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce partage ?"
          confirmLabel="Supprimer"
          busyLabel="Suppression…"
          confirmIcon={Trash2}
          busy={deleteState.busy}
          error={deleteState.error}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          Les autres voyageurs ne verront plus votre séjour à{' '}
          {toDelete.destination?.name || 'cette destination'} (
          {formatStay(toDelete.startDate, toDelete.endDate)}). Vous ne verrez plus les
          co-voyageurs de ce séjour.
        </ConfirmDialog>
      )}
    </div>
  )
}
