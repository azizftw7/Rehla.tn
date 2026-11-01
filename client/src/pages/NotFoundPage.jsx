import { House, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ArchScene from '../components/ArchScene.jsx'
import Button from '../components/Button.jsx'
import '../components/ErrorPage.css'

/** Page 404 (route *). */
export default function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <section className="page-erreur container" aria-labelledby="erreur-titre">
      <title>Page introuvable — Rehla.tn</title>
      <div className="page-erreur__texte">
        <p className="surtitre page-erreur__surtitre">Erreur 404</p>
        <h1 id="erreur-titre" className="page-erreur__titre">
          Page introuvable
        </h1>
        <p className="texte-l">
          L’adresse <code className="page-erreur__adresse">{pathname}</code> ne correspond à
          aucune page. Elle a peut-être été déplacée, ou il y a une faute de frappe.
        </p>
        <div className="page-erreur__actions">
          <Button to="/" variant="primary" size="lg" icon={House}>
            Retour à l’accueil
          </Button>
          <Button to="/#recherche" variant="secondary" size="lg" icon={Search}>
            Rechercher une destination
          </Button>
        </div>
      </div>
      <ArchScene className="page-erreur__illustration">
        <span className="page-erreur__plaque" aria-hidden="true">
          404
        </span>
      </ArchScene>
    </section>
  )
}
