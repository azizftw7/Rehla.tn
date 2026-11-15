import { House } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import ArchScene from './ArchScene.jsx'
import Button from './Button.jsx'
import './ErrorPage.css'

function AccessDenied() {
  return (
    <section className="page-erreur container" aria-labelledby="acces-refuse-titre">
      <title>Accès refusé — Rehla.tn</title>
      <div className="page-erreur__texte">
        <p className="surtitre page-erreur__surtitre">Erreur 403</p>
        <h1 id="acces-refuse-titre" className="page-erreur__titre">
          Accès refusé
        </h1>
        <p className="texte-l">
          Cette page est réservée à un autre type de compte. Si vous pensez qu’il s’agit d’une
          erreur, connectez-vous avec le bon compte.
        </p>
        <div className="page-erreur__actions">
          <Button to="/" variant="primary" size="lg" icon={House}>
            Retour à l’accueil
          </Button>
        </div>
      </div>
      <ArchScene className="page-erreur__illustration">
        <span className="page-erreur__plaque" aria-hidden="true">
          403
        </span>
      </ArchScene>
    </section>
  )
}

/**
 * Réserve une page aux utilisateurs connectés (et éventuellement à certains rôles).
 * - non connecté : redirection vers /connexion, qui renverra ici après la connexion ;
 * - mauvais rôle : page « Accès refusé ».
 * S'utilise autour d'un élément (<ProtectedRoute><Page /></ProtectedRoute>) ou comme route parente.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p
        role="status"
        className="container texte"
        style={{ paddingBlock: 'var(--space-12)', color: 'var(--encre-2)' }}
      >
        Vérification de votre session…
      </p>
    )
  }

  if (!user) {
    return <Navigate to="/connexion" replace state={{ from: location }} />
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <AccessDenied />
  }

  return children ?? <Outlet />
}
