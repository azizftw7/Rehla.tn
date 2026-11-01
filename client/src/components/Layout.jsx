import { Outlet } from 'react-router-dom'
import Footer from './Footer.jsx'
import NavBar from './NavBar.jsx'

/** Mise en page commune : lien d'évitement, barre de navigation, contenu de la page, pied de page. */
export default function Layout() {
  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <NavBar />
      <main id="contenu" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
