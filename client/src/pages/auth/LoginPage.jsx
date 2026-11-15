import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import AuthLayout, { AuthField, FormAlert } from './AuthLayout.jsx'
import { fieldId, getRedirectTarget, splitApiError } from './authForm.js'
import PasswordInput from './PasswordInput.jsx'

const FIELDS = ['email', 'password']
const id = (field) => fieldId('connexion', field)

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Déjà connecté (ou connexion réussie) : retour à la page demandée.
  if (user) return <Navigate to={getRedirectTarget(location)} replace />

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setGeneralError(null)
    try {
      await login({ email: values.email.trim(), password: values.password })
    } catch (err) {
      const { fieldErrors, general } = splitApiError(err, FIELDS)
      setErrors(fieldErrors)
      setGeneralError(general)
      setSubmitting(false)
      const firstInvalid = FIELDS.find((field) => fieldErrors[field])
      if (firstInvalid) document.getElementById(id(firstInvalid))?.focus()
    }
  }

  return (
    <AuthLayout
      titleId="connexion-titre"
      surtitle="Bon retour"
      title="Connexion"
      intro="Retrouvez vos favoris, vos avis et vos déplacements partagés."
    >
      <title>Connexion — Rehla.tn</title>
      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <FormAlert>{generalError}</FormAlert>

        <AuthField id={id('email')} label="Adresse e-mail" error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={update('email')}
            />
          )}
        </AuthField>

        <AuthField id={id('password')} label="Mot de passe" error={errors.password}>
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="current-password"
              required
              value={values.password}
              onChange={update('password')}
            />
          )}
        </AuthField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={LogIn}
          className="auth-form__submit"
          disabled={submitting}
        >
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>

        <p className="texte-s auth-form__switch">
          Pas encore de compte ?{' '}
          <Link to="/inscription" state={location.state}>
            Créer un compte
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
