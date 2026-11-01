import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme.js'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import Logo from './Logo.jsx'
import './NavBar.css'

const NAV_LINKS = [
  { to: '/destinations', label: 'Destinations' },
  { to: '/partage', label: 'Partage de voyage' },
  { to: '/inscription?role=prestataire', label: 'Devenir prestataire' },
]

export default function NavBar() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const burgerRef = useRef(null)

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
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="navbar__link" onClick={closeMenu}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="navbar__actions">
            <Button to="/connexion" variant="ghost" onClick={closeMenu}>
              Connexion
            </Button>
            <Button to="/inscription" variant="primary" onClick={closeMenu}>
              Inscription
            </Button>
          </div>
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
