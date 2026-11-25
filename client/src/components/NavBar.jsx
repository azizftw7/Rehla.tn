import { CircleUserRound, KeyRound, LogOut, Menu, Moon, ShieldCheck, Store, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useTheme } from '../hooks/useTheme.js'
import { fetchAdminStats, onAdminChange } from '../lib/adminApi.js'
import { canBecomeProvider, isApprovedProvider } from '../lib/providerApproval.js'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'
import './NavBar.css'

const NAV_LINKS = [
  { to: '/destinations', label: 'Destinations' },
  { to: '/services', label: 'Services' },
  { to: '/partage', label: 'Partage de voyage' },
]
const BECOME_PROVIDER_LINK = { to: '/inscription?role=prestataire', label: 'Devenir prestataire' }
// US5.1 : réservé aux voyageurs connectés.
const FAVORITES_LINK = { to: '/mes-favoris', label: 'Mes favoris' }

/** Nombre de demandes prestataire en attente (admin uniquement), mis à jour après chaque action. */
function usePendingProviders(isAdmin) {
  const [count, setCount] = useState(null)
  useEffect(() => {
    if (!isAdmin) return undefined
    let controller
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetchAdminStats({ signal: controller.signal })
        .then((stats) => setCount(stats.pendingProviders))
        .catch(() => {
          // Compteur facultatif : le bouton reste affiché sans lui.
        })
    }
    load()
    const unsubscribe = onAdminChange(load)
    return () => {
      unsubscribe()
      controller?.abort()
    }
  }, [isAdmin])
  return isAdmin ? count : null
}

export default function NavBar() {
  const { theme, toggleTheme } = useTheme()
  const { user, loading: sessionLoading, logout } = useAuth()
  const location = useLocation()
  const burgerRef = useRef(null)
  const pendingProviders = usePendingProviders(user?.role === 'admin')
  const links = [
    ...NAV_LINKS,
    ...(user?.role === 'voyageur' ? [FAVORITES_LINK] : []),
    ...(canBecomeProvider({ user, loading: sessionLoading }) ? [BECOME_PROVIDER_LINK] : []),
  ]
  const providerState = user?.provider?.approval === 'refuse' ? 'Refusé' : 'En attente'

  // Le menu mobile est lié à la page où il a été ouvert : il se ferme seul au changement de page.
  const [openOnPage, setOpenOnPage] = useState(null)
  const menuOpen = openOnPage === location.key
  const closeMenu = () => setOpenOnPage(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenOnPage(null)
        burgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  const nextTheme = theme === 'dark' ? 'clair' : 'sombre'

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Logo />

        <nav
          id="menu-principal"
          className="navbar__nav"
          data-open={menuOpen}
          aria-label="Navigation principale"
        >
          <ul role="list" className="navbar__links">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="navbar__link" onClick={closeMenu}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          {user ? (
            <div className="navbar__actions">
              <p className="navbar__user texte-s">
                <Icon icon={CircleUserRound} size={20} />
                <span className="visually-hidden">Connecté en tant que </span>
                <span className="navbar__user-name" title={user.name}>
                  {user.name}
                </span>
              </p>
              {user.role === 'prestataire' &&
                (isApprovedProvider(user) ? (
                  <Button
                    to="/prestataire/services"
                    variant="secondary"
                    icon={Store}
                    className="navbar__btn navbar__btn--compact-lg"
                    title="Espace prestataire"
                    onClick={closeMenu}
                  >
                    <span className="navbar__btn-label">Espace prestataire</span>
                  </Button>
                ) : (
                  <Button
                    to="/prestataire/en-attente"
                    variant="secondary"
                    icon={Store}
                    className="navbar__btn navbar__btn--compact-lg"
                    title="Espace prestataire"
                    aria-label={`Espace prestataire : ${providerState}`}
                    onClick={closeMenu}
                  >
                    <span className="navbar__btn-label">Espace prestataire</span>
                    <span className="navbar__badge navbar__badge--attente">{providerState}</span>
                  </Button>
                ))}
              {user.role === 'admin' && (
                <Button
                  to="/admin"
                  variant="secondary"
                  icon={ShieldCheck}
                  className="navbar__btn navbar__btn--compact-lg"
                  title="Administration"
                  aria-label={
                    pendingProviders > 0
                      ? `Administration : ${pendingProviders} demande${pendingProviders > 1 ? 's' : ''} en attente`
                      : undefined
                  }
                  onClick={closeMenu}
                >
                  <span className="navbar__btn-label">Administration</span>
                  {pendingProviders > 0 && (
                    <span className="navbar__badge" title="Demandes prestataire en attente">
                      {pendingProviders}
                    </span>
                  )}
                </Button>
              )}
              {/* Sur ordinateur, ces deux boutons n'affichent que leur icône (libellé lu par les
                  lecteurs d'écran, infobulle au survol) : la barre ne déborde pas. */}
              <Button
                to="/mon-compte/mot-de-passe"
                variant="ghost"
                icon={KeyRound}
                className="navbar__btn navbar__btn--compact"
                title="Mot de passe"
                onClick={closeMenu}
              >
                <span className="navbar__btn-label">Mot de passe</span>
              </Button>
              <Button
                variant="ghost"
                icon={LogOut}
                className="navbar__btn navbar__btn--compact"
                title="Déconnexion"
                onClick={() => {
                  closeMenu()
                  logout()
                }}
              >
                <span className="navbar__btn-label">Déconnexion</span>
              </Button>
            </div>
          ) : (
            // Pendant la vérification de la session, on n'affiche pas de boutons (évite un clignotement).
            <div className="navbar__actions" aria-hidden={sessionLoading || undefined}>
              {!sessionLoading && (
                <>
                  <Button to="/connexion" variant="ghost" onClick={closeMenu}>
                    Connexion
                  </Button>
                  <Button to="/inscription" variant="primary" onClick={closeMenu}>
                    Inscription
                  </Button>
                </>
              )}
            </div>
          )}
        </nav>

        <div className="navbar__tools">
          <button
            type="button"
            className="navbar__icon-btn"
            onClick={toggleTheme}
            aria-label={`Activer le thème ${nextTheme}`}
            title={`Activer le thème ${nextTheme}`}
          >
            <Icon icon={theme === 'dark' ? Sun : Moon} />
          </button>
          <button
            ref={burgerRef}
            type="button"
            className="navbar__icon-btn navbar__burger"
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpenOnPage(menuOpen ? null : location.key)}
          >
            <Icon icon={menuOpen ? X : Menu} />
          </button>
        </div>
      </div>
    </header>
  )
}
