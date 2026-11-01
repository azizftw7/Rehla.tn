import { House, RefreshCw } from 'lucide-react'
import ArchScene from './ArchScene.jsx'
import Button from './Button.jsx'
import Logo from './Logo.jsx'
import './ErrorPage.css'

/**
 * Contenu affiché par ErrorBoundary. Le lien vers l'accueil recharge la page (href, pas de
 * navigation interne) pour repartir d'un état propre après une erreur.
 */
export default function ErrorFallback({ onRetry, standalone = false }) {
  const content = (
    <section className="page-erreur container" aria-labelledby="erreur-titre">
      <title>Une erreur est survenue — Rehla.tn</title>
      <div className="page-erreur__texte">
        <p className="surtitre page-erreur__surtitre">Erreur inattendue</p>
        <h1 id="erreur-titre" className="page-erreur__titre">
          Une erreur est survenue
        </h1>
        <p className="texte-l">
          Quelque chose s’est mal passé de notre côté. Vous pouvez réessayer ; si le problème
          continue, revenez à l’accueil.
        </p>
        <div className="page-erreur__actions">
          <Button variant="primary" size="lg" icon={RefreshCw} onClick={onRetry}>
            Réessayer
          </Button>
          <Button href="/" variant="secondary" size="lg" icon={House}>
            Retour à l’accueil
          </Button>
        </div>
      </div>
      <ArchScene className="page-erreur__illustration">
        <span className="page-erreur__plaque" aria-hidden="true">
          Oups
        </span>
      </ArchScene>
    </section>
  )

  if (!standalone) return content

  return (
    <div className="page-erreur-autonome">
      <header className="page-erreur-autonome__entete container">
        <a href="/" aria-label="rehla.tn, retour à l'accueil" className="page-erreur-autonome__logo">
          <Logo asLink={false} />
        </a>
      </header>
      <main id="contenu">{content}</main>
    </div>
  )
}
