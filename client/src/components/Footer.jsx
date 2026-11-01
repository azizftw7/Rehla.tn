import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'
import './Footer.css'

const COLUMNS = [
  {
    title: 'Explorer',
    links: [
      { to: '/destinations', label: 'Destinations' },
      { to: '/partage', label: 'Partage de voyage' },
    ],
  },
  {
    title: 'Prestataires',
    links: [
      { to: '/inscription?role=prestataire', label: 'Devenir prestataire' },
      { to: '/connexion', label: 'Espace prestataire' },
    ],
  },
  {
    title: 'Mon compte',
    links: [
      { to: '/connexion', label: 'Connexion' },
      { to: '/inscription', label: 'Inscription' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Logo />
          <p className="texte-s">
            Préparez votre déplacement en Tunisie : tout ce qu’il faut autour de votre destination,
            sur une seule carte.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} className="footer__col" aria-label={column.title}>
            <h2 className="footer__title">{column.title}</h2>
            <ul role="list">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="container footer__bottom texte-s">
        <p>© {new Date().getFullYear()} Rehla.tn — projet étudiant.</p>
        <p>Pas de réservation ni de paiement sur le site : contactez directement les prestataires.</p>
      </div>
    </footer>
  )
}
