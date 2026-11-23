import { CircleCheck, KeyRound } from 'lucide-react'
import { useState } from 'react'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { changePassword } from '../../lib/accountApi.js'
import { AuthField, FormAlert } from '../auth/AuthLayout.jsx'
import { fieldId, splitApiError } from '../auth/authForm.js'
import PasswordInput from '../auth/PasswordInput.jsx'
import '../services/ServicesPage.css'
import '../auth/AuthPages.css'
import './ChangePasswordPage.css'

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword']
const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }
const MIN_LENGTH = 8
const id = (field) => fieldId('mot-de-passe', field)

/** Vérifications avant l'envoi (le serveur refait les siennes). */
function validate(values) {
  const errors = {}
  if (!values.currentPassword) {
    errors.currentPassword = 'Le mot de passe actuel est obligatoire.'
  }
  if (!values.newPassword) {
    errors.newPassword = 'Le nouveau mot de passe est obligatoire.'
  } else if (values.newPassword.length < MIN_LENGTH) {
    errors.newPassword = `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = 'Le nouveau mot de passe doit être différent de l’ancien.'
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirmez le nouveau mot de passe.'
  } else if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = 'Les deux mots de passe ne correspondent pas.'
  }
  return errors
}

/** /mon-compte/mot-de-passe : tout utilisateur connecté modifie son mot de passe. */
export default function ChangePasswordPage() {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSuccess(null)
  }

  const showErrors = (fieldErrors) => {
    setErrors(fieldErrors)
    const firstInvalid = FIELDS.find((field) => fieldErrors[field])
    if (firstInvalid) document.getElementById(id(firstInvalid))?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setGeneralError(null)
    setSuccess(null)

    const localErrors = validate(values)
    if (Object.keys(localErrors).length > 0) {
      showErrors(localErrors)
      return
    }

    setSubmitting(true)
    try {
      const { message } = await changePassword(values)
      setValues(EMPTY)
      setErrors({})
      setSuccess(message || 'Votre mot de passe a été modifié.')
    } catch (err) {
      const { fieldErrors, general } = splitApiError(err, FIELDS)
      setGeneralError(general)
      showErrors(fieldErrors)
    } finally {
      setSubmitting(false)
    }
  }

  const field = (name, label, autoComplete, hint) => (
    <AuthField id={id(name)} label={label} hint={hint} error={errors[name]}>
      {(props) => (
        <PasswordInput
          {...props}
          autoComplete={autoComplete}
          required
          value={values[name]}
          onChange={update(name)}
        />
      )}
    </AuthField>
  )

  return (
    <section className="services-page mot-de-passe-page" aria-labelledby="mot-de-passe-titre">
      <title>Modifier mon mot de passe — Rehla.tn</title>
      <div className="container">
        <header className="services-page__header">
          <p className="surtitre">Mon compte</p>
          <h1 id="mot-de-passe-titre" className="titre-1">
            Modifier mon mot de passe
          </h1>
          <p className="texte-l" style={{ color: 'var(--encre-2)' }}>
            Pour votre sécurité, saisissez d’abord votre mot de passe actuel.
          </p>
        </header>

        {/* Zone toujours présente : les lecteurs d'écran annoncent le message dès qu'il apparaît. */}
        <div role="status">
          {success && (
            <p className="mot-de-passe-page__success texte-s">
              <Icon icon={CircleCheck} size={18} />
              {success}
            </p>
          )}
        </div>

        <div className="auth-page__card mot-de-passe-page__card">

          <form className="auth-form" noValidate onSubmit={handleSubmit}>
            <FormAlert>{generalError}</FormAlert>

            {field('currentPassword', 'Mot de passe actuel', 'current-password')}
            {field(
              'newPassword',
              'Nouveau mot de passe',
              'new-password',
              `${MIN_LENGTH} caractères minimum, différent du mot de passe actuel.`,
            )}
            {field('confirmPassword', 'Confirmer le nouveau mot de passe', 'new-password')}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={KeyRound}
              className="auth-form__submit"
              disabled={submitting}
            >
              {submitting ? 'Enregistrement…' : 'Modifier mon mot de passe'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  )
}
