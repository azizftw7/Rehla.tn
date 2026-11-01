import { Link } from 'react-router-dom'
import './Logo.css'

/** Logo « rehla.tn » : une porte en arche et le nom du site. Lien vers l'accueil. */
export default function Logo({ asLink = true }) {
  const content = (
    <>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path
          fillRule="evenodd"
          d="M4 30V14a12 12 0 0 1 24 0v16zM11 30V17a5 5 0 0 1 10 0v13z"
        />
      </svg>
      <span className="logo__text">
        rehla<span className="logo__tld">.tn</span>
      </span>
    </>
  )

  if (!asLink) return <span className="logo">{content}</span>
  return (
    <Link to="/" className="logo" aria-label="rehla.tn, retour à l'accueil">
      {content}
    </Link>
  )
}
