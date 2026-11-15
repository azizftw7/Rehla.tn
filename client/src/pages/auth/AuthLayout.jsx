import { CircleAlert } from 'lucide-react'
import ArchScene from '../../components/ArchScene.jsx'
import Icon from '../../components/Icon.jsx'
// Les champs reprennent le style des filtres du catalogue (.services-page__input…).
import '../services/ServicesPage.css'
import './AuthPages.css'

/** Mise en page commune Connexion / Inscription : carte centrée + illustration (ordinateur). */
export default function AuthLayout({ titleId, surtitle, title, intro, children }) {
  return (
    <section className="auth-page" aria-labelledby={titleId}>
      <div className="container auth-page__inner">
        <div className="auth-page__card">
          <header className="auth-page__header">
            <p className="surtitre auth-page__surtitre">{surtitle}</p>
            <h1 id={titleId} className="titre-2">
              {title}
            </h1>
            {intro && <p className="texte auth-page__intro">{intro}</p>}
          </header>
          {children}
        </div>
        <ArchScene className="auth-page__illustration" />
      </div>
    </section>
  )
}

/** Message d'erreur général (en haut du formulaire). */
export function FormAlert({ id, children }) {
  if (!children) return null
  return (
    <div id={id} className="auth-form__alert texte-s" role="alert">
      <Icon icon={CircleAlert} size={18} />
      <p>{children}</p>
    </div>
  )
}

/**
 * Champ avec libellé, aide et erreur reliés (aria-describedby).
 * `children` reçoit les attributs à poser sur le contrôle : <AuthField>{(props) => <input {...props} />}</AuthField>
 */
export function AuthField({ id, label, hint, error, children }) {
  const hintId = hint ? `${id}-aide` : null
  const errorId = error ? `${id}-erreur` : null
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="services-page__field">
      <label htmlFor={id} className="label auth-form__label">
        {label}
      </label>
      {children({
        id,
        name: id,
        className: 'services-page__input texte',
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && (
        <p id={hintId} className="legende auth-form__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="services-page__field-error legende">
          {error}
        </p>
      )}
    </div>
  )
}
