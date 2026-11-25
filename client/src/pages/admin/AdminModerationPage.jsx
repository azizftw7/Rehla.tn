import { CircleCheck, Eye, EyeOff, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import StarRating from '../../components/StarRating.jsx'
import { CATEGORIES } from '../../data/categories.js'
import {
  deleteAdminReview,
  deleteAdminService,
  deleteAdminTripShare,
  fetchAdminReviews,
  fetchAdminServices,
  fetchAdminTripShares,
  setAdminServiceHidden,
} from '../../lib/adminApi.js'
import { FormAlert } from '../auth/AuthLayout.jsx'
import '../services/ServicesPage.css'
import './AdminPages.css'

const PAGE_LIMIT = 20
const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0 }

const VISIBILITY = {
  tous: undefined,
  visibles: 'false',
  masques: 'true',
}

const TABS = [
  {
    key: 'avis',
    label: 'Avis',
    unit: ['avis', 'avis'],
    placeholder: 'Commentaire, auteur ou service…',
    fetch: fetchAdminReviews,
  },
  {
    key: 'services',
    label: 'Services',
    unit: ['service', 'services'],
    placeholder: 'Nom du service ou du prestataire…',
    fetch: fetchAdminServices,
  },
  {
    key: 'partages',
    label: 'Partages de voyage',
    unit: ['partage', 'partages'],
    placeholder: 'Voyageur, destination ou message…',
    fetch: fetchAdminTripShares,
  },
]

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

// Dates de séjour enregistrées à minuit UTC : affichées en UTC.
const formatDay = (value) =>
  new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
const formatStayDates = (share) =>
  share.startDate && share.endDate
    ? `Du ${formatDay(share.startDate)} au ${formatDay(share.endDate)}`
    : '—'

/** Le service est-il visible des voyageurs ? (ni masqué par son prestataire, ni par la modération) */
const isPublic = (service) => !service?.hidden && !service?.hiddenByAdmin

const categoryLabel = (type) => CATEGORIES.find((cat) => cat.type === type)?.label ?? type

/** Texte de la boîte de confirmation selon le contenu à supprimer. */
function deleteDialog(tab, item) {
  if (tab === 'avis') {
    return {
      title: 'Supprimer cet avis ?',
      text: `L’avis de ${item.author?.name || 'ce voyageur'} sur « ${item.service?.name || 'ce service'} » sera supprimé, et la note du service recalculée. Cette action est définitive.`,
      done: `L’avis de ${item.author?.name || 'ce voyageur'} a été supprimé.`,
      run: () => deleteAdminReview(item._id),
    }
  }
  if (tab === 'services') {
    return {
      title: 'Supprimer ce service ?',
      text: `« ${item.name} » sera supprimé avec ses photos, ses offres, ses avis et les favoris qui le contiennent. Pour le retirer seulement quelque temps, utilisez plutôt « Masquer ».`,
      done: `« ${item.name} » a été supprimé.`,
      run: () => deleteAdminService(item._id),
    }
  }
  return {
    title: 'Supprimer ce partage de voyage ?',
    text: `Le partage de ${item.user?.name || 'ce voyageur'} à ${item.destination?.name || 'cette destination'} ne sera plus visible par les autres voyageurs.`,
    done: `Le partage de ${item.user?.name || 'ce voyageur'} a été supprimé.`,
    run: () => deleteAdminTripShare(item._id),
  }
}

/**
 * /admin/moderation (US7.2) : l'administrateur supprime des avis, masque, réaffiche ou supprime
 * des services, et supprime des partages de voyage. Onglet, recherche et page dans l'URL.
 */
export default function AdminModerationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find((item) => item.key === searchParams.get('onglet')) || TABS[0]
  const search = searchParams.get('search') || ''
  const visibility = tab.key === 'services' ? searchParams.get('visibilite') || 'tous' : 'tous'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const [reload, setReload] = useState(0)
  const requestKey = JSON.stringify({ tab: tab.key, search, visibility, page, reload })
  const [state, setState] = useState({ key: null, data: EMPTY_PAGE, error: null })
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [dialogState, setDialogState] = useState({ busy: false, error: null })
  const titleRef = useRef(null)
  const focusTitleRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    tab
      .fetch(
        { search, hidden: VISIBILITY[visibility], page, limit: PAGE_LIMIT },
        { signal: controller.signal },
      )
      .then((res) => setState({ key: requestKey, data: { ...EMPTY_PAGE, ...res }, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ key: requestKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
    // tab, search, visibility et page font partie de requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  // Après une suppression, la ligne a disparu : le focus va sur le titre.
  useEffect(() => {
    if (!toDelete && focusTitleRef.current) {
      focusTitleRef.current = false
      titleRef.current?.focus()
    }
  })

  const loading = state.key !== requestKey
  const { data, error } = state

  // Page vide après une suppression (dernière ligne de la dernière page) : page précédente.
  useEffect(() => {
    if (!loading && !error && data.items.length === 0 && page > 1) {
      const next = new URLSearchParams(searchParams)
      if (data.pages > 1) next.set('page', String(data.pages))
      else next.delete('page')
      setSearchParams(next, { replace: true })
    }
  }, [loading, error, data, page, searchParams, setSearchParams])

  const updateParams = (updates, resetPage = true) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.delete('page')
    setSearchParams(next)
    setNotice(null)
    setActionError(null)
  }

  const chooseTab = (key) => {
    setSearchInput('')
    setSearchParams(key === TABS[0].key ? {} : { onglet: key })
    setNotice(null)
    setActionError(null)
  }

  const toggleHidden = async (service) => {
    setPendingId(service._id)
    setNotice(null)
    setActionError(null)
    try {
      // L'administrateur ne change que la modération (hiddenByAdmin), jamais le choix du prestataire.
      const { service: updated } = await setAdminServiceHidden(service._id, !service.hiddenByAdmin)
      const stays = visibility === 'tous' || (visibility === 'masques') === !isPublic(updated)
      setState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          total: stays ? prev.data.total : prev.data.total - 1,
          items: stays
            ? prev.data.items.map((item) => (item._id === updated._id ? updated : item))
            : prev.data.items.filter((item) => item._id !== updated._id),
        },
      }))
      if (!stays) focusTitleRef.current = true
      setNotice(
        updated.hiddenByAdmin
          ? `« ${updated.name} » est masqué par la modération : les voyageurs ne le voient plus et son prestataire ne peut pas le réafficher.`
          : updated.hidden
            ? `La modération de « ${updated.name} » est levée ; il reste masqué par son prestataire.`
            : `« ${updated.name} » est de nouveau visible.`,
      )
    } catch (err) {
      setActionError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  const confirmDelete = async () => {
    const dialog = deleteDialog(tab.key, toDelete)
    setDialogState({ busy: true, error: null })
    try {
      await dialog.run()
      setNotice(dialog.done)
      setActionError(null)
      focusTitleRef.current = true
      setToDelete(null)
      setReload((n) => n + 1)
    } catch (err) {
      setDialogState({ busy: false, error: err.message })
    }
  }

  const deleteButton = (item, label) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={Trash2}
      className="admin-actions__danger"
      disabled={pendingId === item._id}
      aria-label={`Supprimer ${label}`}
      onClick={() => {
        setDialogState({ busy: false, error: null })
        setToDelete(item)
      }}
    >
      Supprimer
    </Button>
  )

  const renderReviewRow = (review) => (
    <tr key={review._id} role="row" className="admin-table__row">
      <th scope="row" role="rowheader" className="admin-table__name">
        <StarRating value={review.rating} size={14} />
        <span className="admin-moderation__comment texte-s">
          {review.comment || <em className="admin-table__muted">Note sans commentaire</em>}
        </span>
      </th>
      <td role="cell" data-label="Auteur">
        <span className="admin-moderation__who">
          {review.author?.name || 'Compte supprimé'}
          {review.author?.email && (
            <span className="legende admin-table__email">{review.author.email}</span>
          )}
        </span>
      </td>
      <td role="cell" data-label="Service">
        {review.service && isPublic(review.service) ? (
          <Link to={`/services/${review.service._id}`}>{review.service.name}</Link>
        ) : (
          review.service?.name || '—'
        )}
      </td>
      <td role="cell" data-label="Date">
        {formatDate(review.createdAt)}
      </td>
      <td role="cell" data-label="Actions" className="admin-table__actions">
        <div className="admin-actions">
          {deleteButton(review, `l’avis de ${review.author?.name || 'ce voyageur'}`)}
        </div>
      </td>
    </tr>
  )

  const renderServiceRow = (service) => {
    const busy = pendingId === service._id
    const provider = service.provider
    return (
      <tr key={service._id} role="row" className="admin-table__row">
        <th scope="row" role="rowheader" className="admin-table__name">
          {!isPublic(service) ? (
            service.name
          ) : (
            <Link to={`/services/${service._id}`}>{service.name}</Link>
          )}
          <span className="legende admin-table__muted">{categoryLabel(service.type)}</span>
        </th>
        <td role="cell" data-label="Prestataire">
          <span className="admin-moderation__who">
            {provider?.provider?.businessName || provider?.name || '—'}
            {provider?.provider?.businessName && (
              <span className="legende admin-table__muted">{provider.name}</span>
            )}
          </span>
        </td>
        <td role="cell" data-label="Destination">
          {service.destination?.name || '—'}
        </td>
        <td role="cell" data-label="Statut">
          {service.hiddenByAdmin ? (
            <span className="admin-badge admin-badge--refuse">Masqué par la modération</span>
          ) : service.hidden ? (
            <span className="admin-badge admin-badge--attente">Masqué par le prestataire</span>
          ) : (
            <span className="admin-badge admin-badge--actif">Visible</span>
          )}
        </td>
        <td role="cell" data-label="Actions" className="admin-table__actions">
          <div className="admin-actions">
            <Button
              type="button"
              variant={service.hiddenByAdmin ? 'secondary' : 'ghost'}
              size="sm"
              icon={service.hiddenByAdmin ? Eye : EyeOff}
              disabled={busy}
              aria-label={`${service.hiddenByAdmin ? 'Réafficher' : 'Masquer'} « ${service.name} »`}
              onClick={() => toggleHidden(service)}
            >
              {service.hiddenByAdmin ? 'Réafficher' : 'Masquer'}
            </Button>
            {deleteButton(service, `« ${service.name} »`)}
          </div>
        </td>
      </tr>
    )
  }

  const renderTripShareRow = (share) => (
    <tr key={share._id} role="row" className="admin-table__row">
      <th scope="row" role="rowheader" className="admin-table__name">
        <span className="admin-moderation__who">
          {share.user?.name || 'Compte supprimé'}
          {share.user?.email && (
            <span className="legende admin-table__email">{share.user.email}</span>
          )}
        </span>
      </th>
      <td role="cell" data-label="Destination">
        {share.destination?.name || '—'}
      </td>
      <td role="cell" data-label="Dates">
        {formatStayDates(share)}
      </td>
      <td role="cell" data-label="Message">
        <span className="admin-moderation__comment texte-s">
          {share.message || <em className="admin-table__muted">Pas de message</em>}
        </span>
      </td>
      <td role="cell" data-label="Actions" className="admin-table__actions">
        <div className="admin-actions">
          {deleteButton(share, `le partage de ${share.user?.name || 'ce voyageur'}`)}
        </div>
      </td>
    </tr>
  )

  const COLUMNS = {
    avis: ['Avis', 'Auteur', 'Service', 'Date', 'Actions'],
    services: ['Service', 'Prestataire', 'Destination', 'Statut', 'Actions'],
    partages: ['Voyageur', 'Destination', 'Dates', 'Message', 'Actions'],
  }
  const renderRow = {
    avis: renderReviewRow,
    services: renderServiceRow,
    partages: renderTripShareRow,
  }[tab.key]

  const total = data.total
  const [singular, plural] = tab.unit
  const filtered = Boolean(search) || visibility !== 'tous'
  const dialog = toDelete ? deleteDialog(tab.key, toDelete) : null

  return (
    <section className="services-page admin-page" aria-labelledby="admin-moderation-titre">
      <title>Modération — Administration — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header">
          <p className="surtitre">Administration</p>
          <h1
            id="admin-moderation-titre"
            ref={titleRef}
            tabIndex={-1}
            className="titre-1 admin-page__title"
          >
            Modération des contenus
          </h1>
          <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
            Supprimez les avis abusifs, masquez ou supprimez un service, retirez un partage de
            voyage.
          </p>
        </header>

        <div className="services-page__tabs" role="group" aria-label="Type de contenu">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="services-page__tab label"
              aria-pressed={tab.key === item.key}
              onClick={() => chooseTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="services-page__filters admin-page__search admin-moderation__filters"
          onSubmit={(event) => {
            event.preventDefault()
            updateParams({ search: searchInput.trim() })
          }}
        >
          <div className="services-page__field">
            <label htmlFor="moderation-recherche" className="legende">
              Recherche
            </label>
            <input
              key={`${tab.key}-${search}`}
              id="moderation-recherche"
              type="search"
              className="services-page__input texte-s"
              placeholder={tab.placeholder}
              defaultValue={search}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          {tab.key === 'services' && (
            <div className="services-page__field">
              <label htmlFor="moderation-visibilite" className="legende">
                Visibilité
              </label>
              <select
                id="moderation-visibilite"
                className="services-page__input texte-s"
                value={visibility}
                onChange={(event) =>
                  updateParams({
                    visibilite: event.target.value === 'tous' ? '' : event.target.value,
                  })
                }
              >
                <option value="tous">Tous les services</option>
                <option value="visibles">Visibles</option>
                <option value="masques">Masqués</option>
              </select>
            </div>
          )}
          <Button type="submit" variant="primary">
            <Icon icon={Search} size={16} />
            Rechercher
          </Button>
        </form>

        {notice && (
          <p className="admin-page__notice texte-s" role="status">
            <Icon icon={CircleCheck} size={18} />
            {notice}
          </p>
        )}
        {actionError && (
          <div className="admin-page__alert">
            <FormAlert>{actionError}</FormAlert>
          </div>
        )}

        <div className="services-page__toolbar texte-s">
          <p>
            {loading
              ? 'Chargement…'
              : `${total} ${total > 1 ? plural : singular}`}
          </p>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput('')
                updateParams({ search: '', visibilite: '' })
              }}
            >
              <Icon icon={RotateCcw} size={15} />
              Effacer les filtres
            </Button>
          )}
        </div>

        {error ? (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">Impossible de charger les contenus</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="admin-skeletons" role="status" aria-label="Chargement des contenus">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="admin-skeleton" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="services-page__state">
            <h2 className="titre-4">
              {filtered ? 'Aucun contenu ne correspond' : `Aucun ${singular} pour le moment`}
            </h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {filtered
                ? 'Essayez une autre recherche.'
                : 'Rien à modérer dans cette rubrique.'}
            </p>
          </div>
        ) : (
          <>
            <table className="admin-table" role="table">
              <caption className="visually-hidden">
                {tab.label}, page {data.page} sur {Math.max(data.pages, 1)}
              </caption>
              <thead className="admin-table__head" role="rowgroup">
                <tr role="row">
                  {COLUMNS[tab.key].map((column) => (
                    <th key={column} scope="col" role="columnheader">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">{data.items.map(renderRow)}</tbody>
            </table>

            {data.pages > 1 && (
              <nav className="services-page__pagination" aria-label="Pagination des contenus">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => {
                    updateParams({ page: page - 1 > 1 ? page - 1 : '' }, false)
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
                    updateParams({ page: page + 1 }, false)
                    titleRef.current?.focus()
                  }}
                >
                  Suivant
                </Button>
              </nav>
            )}
          </>
        )}
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          confirmLabel="Supprimer définitivement"
          busyLabel="Suppression…"
          confirmIcon={Trash2}
          busy={dialogState.busy}
          error={dialogState.error}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>{dialog.text}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
