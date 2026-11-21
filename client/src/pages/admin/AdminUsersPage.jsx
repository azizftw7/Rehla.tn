import {
  ChevronDown,
  CircleCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRoundX,
  UserX,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Icon from '../../components/Icon.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { useAuth } from '../../hooks/useAuth.js'
import {
  deleteUser,
  fetchAdminStats,
  fetchAdminUsers,
  notifyAdminChange,
  reviewProvider,
  ROLE_LABELS,
  setUserStatus,
} from '../../lib/adminApi.js'
import { FormAlert } from '../auth/AuthLayout.jsx'
import '../services/ServicesPage.css'
import './AdminPages.css'

const PAGE_LIMIT = 20
const EMPTY_PAGE = { items: [], total: 0, page: 1, pages: 0 }
const REASON_MAX = 300
const FILTER_KEYS = ['role', 'status', 'approval']

const TABS = [
  { key: 'tous', label: 'Tous', params: {} },
  { key: 'voyageurs', label: 'Voyageurs', params: { role: 'voyageur' } },
  { key: 'prestataires', label: 'Prestataires', params: { role: 'prestataire' } },
  { key: 'demandes', label: 'Demandes prestataire', params: { approval: 'en_attente' } },
  { key: 'suspendus', label: 'Suspendus', params: { status: 'suspendu' } },
]

// Un prestataire inscrit avant la validation des comptes n'a pas de champ approval : en attente.
const approvalOf = (user) =>
  user.role === 'prestataire' ? (user.provider?.approval ?? 'en_attente') : null

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const activityLabel = (type) => CATEGORIES.find((cat) => cat.type === type)?.label ?? type

/** Badges du compte : Actif / Suspendu, et En attente / Refusé pour une demande prestataire. */
function AccountBadges({ user }) {
  const approval = approvalOf(user)
  const pendingOrRejected = approval === 'en_attente' || approval === 'refuse'
  return (
    <span className="admin-badges">
      {user.status === 'suspendu' ? (
        <span className="admin-badge admin-badge--suspendu">Suspendu</span>
      ) : (
        !pendingOrRejected && <span className="admin-badge admin-badge--actif">Actif</span>
      )}
      {approval === 'en_attente' && (
        <span className="admin-badge admin-badge--attente">En attente</span>
      )}
      {approval === 'refuse' && <span className="admin-badge admin-badge--refuse">Refusé</span>}
    </span>
  )
}

/** Détail d'un prestataire (ligne dépliée). */
function ProviderDetails({ user }) {
  const provider = user.provider ?? {}
  const rows = [
    ['Nom commercial', provider.businessName],
    ['Type d’activité', provider.activityType && activityLabel(provider.activityType)],
    ['Ville', provider.city],
    ['Téléphone', provider.phone],
  ]
  if (provider.reviewedAt) rows.push(['Décision du', formatDate(provider.reviewedAt)])
  if (approvalOf(user) === 'refuse') {
    rows.push(['Motif du refus', provider.rejectionReason || 'Aucun motif précisé'])
  }
  return (
    <dl className="admin-details">
      {rows.map(([label, value]) => (
        <div key={label} className="admin-details__item">
          <dt className="legende">{label}</dt>
          <dd className="texte-s">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** /admin/utilisateurs : l'administrateur gère les comptes et valide les prestataires. */
export default function AdminUsersPage() {
  const { user: me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get('role') || ''
  const status = searchParams.get('status') || ''
  const approval = searchParams.get('approval') || ''
  const search = searchParams.get('search') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const [reload, setReload] = useState(0)
  const requestKey = JSON.stringify({ role, status, approval, search, page, reload })
  const [requestState, setRequestState] = useState({
    fetchedKey: null,
    data: EMPTY_PAGE,
    error: null,
  })
  const [statsReload, setStatsReload] = useState(0)
  const [pendingCount, setPendingCount] = useState(null)

  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [pendingId, setPendingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [toReject, setToReject] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [dialogState, setDialogState] = useState({ busy: false, error: null })
  const titleRef = useRef(null)
  const focusTitleRef = useRef(false)
  const reasonId = useId()

  useEffect(() => {
    const controller = new AbortController()
    fetchAdminUsers(
      { role, status, approval, search, page, limit: PAGE_LIMIT },
      { signal: controller.signal },
    )
      .then((res) => setRequestState({ fetchedKey: requestKey, data: res, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRequestState({ fetchedKey: requestKey, data: EMPTY_PAGE, error: err.message })
      })
    return () => controller.abort()
  }, [requestKey, role, status, approval, search, page])

  // Nombre de demandes en attente, affiché sur l'onglet (mis à jour après chaque action).
  useEffect(() => {
    const controller = new AbortController()
    fetchAdminStats({ signal: controller.signal })
      .then((stats) => setPendingCount(stats.pendingProviders))
      .catch(() => {
        // Le compteur est facultatif : l'onglet reste utilisable sans lui.
      })
    return () => controller.abort()
  }, [statsReload])

  // Une ligne a disparu (suppression, ou compte qui ne correspond plus à l'onglet) : le focus
  // va sur le titre, une fois la boîte de dialogue éventuelle fermée.
  useEffect(() => {
    if (!toDelete && !toReject && focusTitleRef.current) {
      focusTitleRef.current = false
      titleRef.current?.focus()
    }
  })

  const loading = requestState.fetchedKey !== requestKey
  const { data, error } = requestState

  // Page vide après une action (ex. dernière demande de la dernière page) : page précédente.
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
  }

  const chooseTab = (tab) => {
    const updates = Object.fromEntries(FILTER_KEYS.map((key) => [key, tab.params[key] ?? '']))
    updateParams(updates)
    setExpandedId(null)
  }

  // Onglet dont les filtres correspondent exactement à l'URL (aucun si filtres combinés à la main).
  const activeTab = TABS.find((tab) =>
    FILTER_KEYS.every((key) => (tab.params[key] ?? '') === (searchParams.get(key) || '')),
  )

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    updateParams({ search: searchInput.trim() })
  }

  const resetSearch = () => {
    setSearchInput('')
    updateParams({ search: '' })
  }

  // Le compte modifié est-il encore dans l'onglet affiché ? (ex. une demande approuvée quitte
  // l'onglet « Demandes prestataire »).
  const matchesFilters = (user) =>
    (!role || user.role === role) &&
    (!status || user.status === status) &&
    (!approval || approvalOf(user) === approval)

  const applyUpdate = (updated) => {
    const stays = matchesFilters(updated)
    if (!stays) focusTitleRef.current = true
    setRequestState((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        total: stays ? prev.data.total : prev.data.total - 1,
        items: stays
          ? prev.data.items.map((item) => (item._id === updated._id ? updated : item))
          : prev.data.items.filter((item) => item._id !== updated._id),
      },
    }))
  }

  const afterAction = (message) => {
    setNotice(message)
    setActionError(null)
    setStatsReload((n) => n + 1)
    notifyAdminChange()
  }

  const runAction = async (user, action, message) => {
    setPendingId(user._id)
    setActionError(null)
    setNotice(null)
    try {
      const { user: updated } = await action()
      applyUpdate(updated)
      afterAction(message)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  const approve = (user) =>
    runAction(
      user,
      () => reviewProvider(user._id, 'approuve'),
      `La demande de ${user.name} est approuvée : son espace prestataire est ouvert.`,
    )

  const toggleStatus = (user) => {
    const suspend = user.status !== 'suspendu'
    return runAction(
      user,
      () => setUserStatus(user._id, suspend ? 'suspendu' : 'actif'),
      suspend
        ? `Le compte de ${user.name} est suspendu : il ne peut plus se connecter.`
        : `Le compte de ${user.name} est réactivé.`,
    )
  }

  const openReject = (user) => {
    setDialogState({ busy: false, error: null })
    setRejectReason('')
    setToReject(user)
  }

  const confirmReject = async () => {
    setDialogState({ busy: true, error: null })
    try {
      const { user: updated } = await reviewProvider(toReject._id, 'refuse', rejectReason.trim())
      applyUpdate(updated)
      afterAction(`La demande de ${toReject.name} est refusée.`)
      setToReject(null)
    } catch (err) {
      setDialogState({ busy: false, error: err.message })
    }
  }

  const openDelete = (user) => {
    setDialogState({ busy: false, error: null })
    setToDelete(user)
  }

  const confirmDelete = async () => {
    setDialogState({ busy: true, error: null })
    try {
      await deleteUser(toDelete._id)
      focusTitleRef.current = true
      setRequestState((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          total: prev.data.total - 1,
          items: prev.data.items.filter((item) => item._id !== toDelete._id),
        },
      }))
      afterAction(`Le compte de ${toDelete.name} a été supprimé.`)
      setToDelete(null)
    } catch (err) {
      setDialogState({ busy: false, error: err.message })
    }
  }

  const goToPage = (next) => {
    updateParams({ page: next > 1 ? next : '' }, false)
    titleRef.current?.focus()
  }

  const renderActions = (user) => {
    if (user._id === me?._id) return <span className="legende admin-table__muted">Votre compte</span>
    if (user.role === 'admin') return <span className="legende admin-table__muted">Aucune action</span>

    const busy = pendingId === user._id
    const approvalState = approvalOf(user)
    const suspended = user.status === 'suspendu'
    return (
      <div className="admin-actions">
        {approvalState && approvalState !== 'approuve' && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={UserCheck}
            disabled={busy}
            aria-label={`Approuver ${user.name}`}
            onClick={() => approve(user)}
          >
            Approuver
          </Button>
        )}
        {approvalState === 'en_attente' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={UserX}
            className="admin-actions__danger"
            disabled={busy}
            aria-label={`Refuser ${user.name}`}
            onClick={() => openReject(user)}
          >
            Refuser
          </Button>
        )}
        <Button
          type="button"
          variant={suspended ? 'secondary' : 'ghost'}
          size="sm"
          icon={suspended ? RotateCcw : UserRoundX}
          disabled={busy}
          aria-label={`${suspended ? 'Réactiver' : 'Suspendre'} ${user.name}`}
          onClick={() => toggleStatus(user)}
        >
          {suspended ? 'Réactiver' : 'Suspendre'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={Trash2}
          className="admin-actions__danger"
          disabled={busy}
          aria-label={`Supprimer ${user.name}`}
          onClick={() => openDelete(user)}
        >
          Supprimer
        </Button>
      </div>
    )
  }

  const total = data.total
  const hasSearch = Boolean(search)

  return (
    <section className="services-page admin-page" aria-labelledby="admin-utilisateurs-titre">
      <title>Gestion des utilisateurs — Administration — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header">
          <p className="surtitre">Administration</p>
          <h1
            id="admin-utilisateurs-titre"
            ref={titleRef}
            tabIndex={-1}
            className="titre-1 admin-page__title"
          >
            Gestion des utilisateurs
          </h1>
          <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
            Validez les demandes des prestataires, suspendez ou supprimez un compte.
          </p>
        </header>

        <div className="services-page__tabs" role="group" aria-label="Filtrer les comptes">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="services-page__tab label"
              aria-pressed={activeTab?.key === tab.key}
              aria-label={
                tab.key === 'demandes' && pendingCount != null
                  ? `${tab.label} : ${pendingCount}`
                  : undefined
              }
              onClick={() => chooseTab(tab)}
            >
              {tab.label}
              {tab.key === 'demandes' && pendingCount != null && (
                <span className="admin-tab__count">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <form className="services-page__filters admin-page__search" onSubmit={handleSearchSubmit}>
          <div className="services-page__field">
            <label htmlFor="admin-recherche" className="legende">
              Recherche
            </label>
            <input
              key={search}
              id="admin-recherche"
              type="search"
              className="services-page__input texte-s"
              placeholder="Nom, e-mail ou nom commercial…"
              defaultValue={search}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
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
              ? 'Chargement des utilisateurs…'
              : `${total} compte${total > 1 ? 's' : ''}${activeTab ? ` · ${activeTab.label}` : ''}`}
          </p>
          {hasSearch && (
            <Button type="button" variant="ghost" onClick={resetSearch}>
              <Icon icon={RotateCcw} size={15} />
              Effacer la recherche
            </Button>
          )}
        </div>

        {error ? (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">Impossible de charger les utilisateurs</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="admin-skeletons" role="status" aria-label="Chargement des utilisateurs">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="admin-skeleton" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="services-page__state">
            <h2 className="titre-4">
              {activeTab?.key === 'demandes' && !hasSearch
                ? 'Aucune demande en attente'
                : 'Aucun compte ne correspond'}
            </h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {activeTab?.key === 'demandes' && !hasSearch
                ? 'Toutes les demandes des prestataires ont été traitées.'
                : 'Essayez un autre onglet ou une autre recherche.'}
            </p>
            {hasSearch && (
              <Button type="button" variant="secondary" onClick={resetSearch}>
                Effacer la recherche
              </Button>
            )}
          </div>
        ) : (
          <>
            <table className="admin-table" role="table">
              <caption className="visually-hidden">
                Comptes utilisateurs, page {data.page} sur {Math.max(data.pages, 1)}
              </caption>
              <thead className="admin-table__head" role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">Nom</th>
                  <th scope="col" role="columnheader">E-mail</th>
                  <th scope="col" role="columnheader">Rôle</th>
                  <th scope="col" role="columnheader">Statut</th>
                  <th scope="col" role="columnheader">Inscription</th>
                  <th scope="col" role="columnheader">Actions</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {data.items.map((user) => {
                  const isProvider = user.role === 'prestataire'
                  const expanded = expandedId === user._id
                  const detailsId = `admin-details-${user._id}`
                  return [
                    <tr key={user._id} role="row" className="admin-table__row">
                      <th scope="row" role="rowheader" className="admin-table__name">
                        <span className="admin-table__name-text">
                          {user.name}
                          {user._id === me?._id && <span className="legende"> (vous)</span>}
                        </span>
                        {isProvider && (
                          <button
                            type="button"
                            className="admin-table__toggle legende"
                            aria-expanded={expanded}
                            aria-controls={detailsId}
                            aria-label={`Voir l’activité de ${user.name}`}
                            onClick={() => setExpandedId(expanded ? null : user._id)}
                          >
                            <Icon icon={ChevronDown} size={14} />
                            Voir l’activité
                          </button>
                        )}
                      </th>
                      <td role="cell" data-label="E-mail" className="admin-table__email">
                        {user.email}
                      </td>
                      <td role="cell" data-label="Rôle">
                        <span className="admin-role">
                          {user.role === 'admin' && <Icon icon={ShieldCheck} size={14} />}
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td role="cell" data-label="Statut">
                        <AccountBadges user={user} />
                      </td>
                      <td role="cell" data-label="Inscription">
                        {formatDate(user.createdAt)}
                      </td>
                      <td role="cell" data-label="Actions" className="admin-table__actions">
                        {renderActions(user)}
                      </td>
                    </tr>,
                    isProvider && expanded && (
                      <tr key={`${user._id}-details`} role="row" className="admin-table__details">
                        <td role="cell" colSpan={6} id={detailsId}>
                          <ProviderDetails user={user} />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>

            {data.pages > 1 && (
              <nav className="services-page__pagination" aria-label="Pagination des utilisateurs">
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

      {toReject && (
        <ConfirmDialog
          title={`Refuser la demande de ${toReject.name} ?`}
          confirmLabel="Refuser la demande"
          busyLabel="Refus…"
          confirmIcon={UserX}
          busy={dialogState.busy}
          error={dialogState.error}
          onConfirm={confirmReject}
          onCancel={() => setToReject(null)}
        >
          <p>
            Le compte reste actif, mais l’espace prestataire restera fermé. Le prestataire verra le
            motif en se connectant.
          </p>
          <div className="services-page__field admin-dialog__field">
            <label htmlFor={reasonId} className="legende">
              Motif (facultatif)
            </label>
            <textarea
              id={reasonId}
              className="services-page__input texte-s admin-dialog__textarea"
              rows={3}
              maxLength={REASON_MAX}
              value={rejectReason}
              disabled={dialogState.busy}
              aria-describedby={`${reasonId}-aide`}
              onChange={(event) => setRejectReason(event.target.value)}
            />
            <p id={`${reasonId}-aide`} className="legende admin-dialog__hint">
              {rejectReason.length} / {REASON_MAX} caractères
            </p>
          </div>
        </ConfirmDialog>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Supprimer ce compte ?"
          confirmLabel="Supprimer définitivement"
          busyLabel="Suppression…"
          confirmIcon={Trash2}
          busy={dialogState.busy}
          error={dialogState.error}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          <p>
            Le compte de {toDelete.name} ({toDelete.email}) sera supprimé
            {toDelete.role === 'prestataire'
              ? ', avec ses services, leurs photos, leurs offres et leurs avis'
              : ', avec ses avis, ses favoris et ses partages de voyage'}
            . Cette action est définitive.
          </p>
          <p>Pour bloquer le compte seulement quelque temps, utilisez plutôt « Suspendre ».</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
