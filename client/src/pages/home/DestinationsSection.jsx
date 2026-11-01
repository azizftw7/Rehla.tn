import { ArrowRight, MapPinned, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../components/Button.jsx'
import DestinationCard, { DestinationCardSkeleton } from '../../components/DestinationCard.jsx'
import Icon from '../../components/Icon.jsx'
import { apiGet } from '../../lib/api.js'

const LIMIT = 6
const SKELETON_COUNT = 3

export default function DestinationsSection() {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/destinations?limit=${LIMIT}`, { signal: controller.signal })
      .then((data) => setState({ status: 'success', items: data.items }))
      .catch((err) => {
        if (err.name !== 'AbortError') setState({ status: 'error', message: err.message })
      })
    return () => controller.abort()
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  return (
    <section
      className="section"
      aria-labelledby="destinations-titre"
      aria-busy={state.status === 'loading'}
    >
      <div className="container">
        <div className="section-head">
          <p className="surtitre">Inspirations</p>
          <h2 id="destinations-titre" className="titre-1">
            Où partir cet automne ?
          </h2>
          <p className="texte-l">
            Douceur des températures, plages désertes et oasis en fête : nos destinations du
            moment.
          </p>
        </div>

        {state.status === 'loading' && (
          <>
            <p role="status" className="visually-hidden">
              Chargement des destinations…
            </p>
            <div className="grille-destinations">
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <DestinationCardSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {state.status === 'error' && (
          <div className="etat etat--erreur" role="alert">
            <Icon icon={TriangleAlert} size={32} className="etat__icon" />
            <div>
              <p className="titre-4">Impossible de charger les destinations.</p>
              <p className="texte-s">{state.message}</p>
            </div>
            <Button variant="secondary" icon={RefreshCw} onClick={retry}>
              Réessayer
            </Button>
          </div>
        )}

        {state.status === 'success' && state.items.length === 0 && (
          <div className="etat">
            <Icon icon={MapPinned} size={32} className="etat__icon" />
            <div>
              <p className="titre-4">Aucune destination pour le moment.</p>
              <p className="texte-s">
                Revenez bientôt : de nouvelles destinations sont ajoutées régulièrement.
              </p>
            </div>
          </div>
        )}

        {state.status === 'success' && state.items.length > 0 && (
          <>
            <ul role="list" className="grille-destinations">
              {state.items.map((destination) => (
                <li key={destination._id}>
                  <DestinationCard destination={destination} />
                </li>
              ))}
            </ul>
            <div className="section-action">
              <Button to="/destinations" variant="secondary" iconRight={ArrowRight}>
                Voir toutes les destinations
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
