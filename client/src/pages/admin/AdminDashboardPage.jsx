import { Backpack, ChevronRight, Hourglass, Store, UserRoundX, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { fetchAdminStats } from '../../lib/adminApi.js'
import '../services/ServicesPage.css'
import './AdminPages.css'

const STAT_CARDS = [
  {
    key: 'voyageurs',
    label: 'Voyageurs',
    icon: Backpack,
    tone: 'bleu',
    to: '/admin/utilisateurs?role=voyageur',
    value: (stats) => stats.users.voyageur,
  },
  {
    key: 'prestataires',
    label: 'Prestataires',
    icon: Store,
    tone: 'lagune',
    to: '/admin/utilisateurs?role=prestataire',
    value: (stats) => stats.users.prestataire,
  },
  {
    key: 'demandes',
    label: 'Demandes en attente',
    icon: Hourglass,
    tone: 'safran',
    to: '/admin/utilisateurs?approval=en_attente',
    value: (stats) => stats.pendingProviders,
  },
  {
    key: 'suspendus',
    label: 'Comptes suspendus',
    icon: UserRoundX,
    tone: 'danger',
    to: '/admin/utilisateurs?status=suspendu',
    value: (stats) => stats.suspended,
  },
]

/** /admin : tableau de bord de l'administrateur (chiffres clés des comptes). */
export default function AdminDashboardPage() {
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ fetchedKey: null, stats: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    fetchAdminStats({ signal: controller.signal })
      .then((stats) => setState({ fetchedKey: reload, stats, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ fetchedKey: reload, stats: null, error: err.message })
      })
    return () => controller.abort()
  }, [reload])

  const loading = state.fetchedKey !== reload
  const { stats, error } = state

  return (
    <section className="services-page admin-page" aria-labelledby="admin-titre">
      <title>Tableau de bord — Administration — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header admin-page__header">
          <div className="admin-page__heading">
            <p className="surtitre">Administration</p>
            <h1 id="admin-titre" className="titre-1">
              Tableau de bord
            </h1>
            <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
              Suivez les comptes de la plateforme et validez les nouveaux prestataires.
            </p>
          </div>
          <Button to="/admin/utilisateurs" variant="primary" icon={Users}>
            Gérer les utilisateurs
          </Button>
        </header>

        {error ? (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">Impossible de charger les statistiques</h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {error}
            </p>
            <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
              Réessayer
            </Button>
          </div>
        ) : (
          <ul className="admin-stats" role="list" aria-busy={loading || undefined}>
            {STAT_CARDS.map((card) => (
              <li key={card.key}>
                <Link
                  to={card.to}
                  className={`admin-stat admin-stat--${card.tone}`}
                  aria-label={
                    loading ? `${card.label} : chargement` : `${card.label} : ${card.value(stats)}`
                  }
                >
                  <span className="admin-stat__icon">
                    <Icon icon={card.icon} size={22} />
                  </span>
                  <span className="admin-stat__body">
                    <span className="admin-stat__value" aria-hidden="true">
                      {loading ? '–' : card.value(stats)}
                    </span>
                    <span className="admin-stat__label texte-s" aria-hidden="true">
                      {card.label}
                    </span>
                  </span>
                  <Icon icon={ChevronRight} size={18} className="admin-stat__chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
