import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'
import Footer from './Footer.jsx'
import NavBar from './NavBar.jsx'

/** Mise en page commune : lien d'évitement, barre de navigation, contenu de la page, pied de page. */
export default function Layout() {
  const { pathname } = useLocation()

  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <NavBar />
      <main id="contenu" tabIndex={-1}>
        {/* Une erreur dans une page n'emporte pas la navigation ; changer de page l'efface. */}
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </>
  )
}
