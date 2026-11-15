import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { fetchMyService } from '../../lib/servicesApi.js'
import '../services/ServicesPage.css'
import ServiceForm from './ServiceForm.jsx'
import './NewServicePage.css'

/** /prestataire/services/:id/modifier : formulaire de US6.1 prérempli avec le service (US6.2). */
export default function EditServicePage() {
  const { id } = useParams()
  const [reload, setReload] = useState(0)
  const requestKey = `${id}:${reload}`
  const [state, setState] = useState({ fetchedKey: null, service: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    fetchMyService(id, { signal: controller.signal })
      .then(({ service }) => setState({ fetchedKey: requestKey, service, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setState({ fetchedKey: requestKey, service: null, error: err })
      })
    return () => controller.abort()
  }, [id, requestKey])

  if (state.fetchedKey === requestKey && state.service) {
    return <ServiceForm key={state.service._id} service={state.service} />
  }

  const loading = state.fetchedKey !== requestKey
  const notFound = state.error?.status === 404 || state.error?.status === 400

  return (
    <section className="nouveau-service" aria-labelledby="modifier-service-titre">
      <title>Modifier un service — Rehla.tn</title>
      <div className="container nouveau-service__inner">
        <Link to="/prestataire/services" className="nouveau-service__back texte-s">
          <Icon icon={ArrowLeft} size={16} />
          Retour à mes services
        </Link>

        <header className="services-page__header">
          <p className="surtitre nouveau-service__surtitre">Espace prestataire</p>
          <h1 id="modifier-service-titre" className="titre-1">
            Modifier un service
          </h1>
        </header>

        {loading ? (
          <div className="nouveau-service__form nouveau-service__loading" role="status">
            <span className="visually-hidden">Chargement du service…</span>
            <div className="skeleton skeleton--line" style={{ width: '40%' }} aria-hidden="true" />
            <div className="skeleton skeleton--line" aria-hidden="true" />
            <div className="skeleton skeleton--line" style={{ width: '70%' }} aria-hidden="true" />
          </div>
        ) : (
          <div className="services-page__state" role="alert">
            <h2 className="titre-4">
              {notFound ? 'Service introuvable' : 'Impossible de charger le service'}
            </h2>
            <p className="texte-s" style={{ color: 'var(--encre-2)' }}>
              {notFound
                ? 'Ce service n’existe pas ou ne fait pas partie de vos services.'
                : state.error?.message}
            </p>
            {notFound ? (
              <Button to="/prestataire/services" variant="primary">
                Voir mes services
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={() => setReload((n) => n + 1)}>
                Réessayer
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
