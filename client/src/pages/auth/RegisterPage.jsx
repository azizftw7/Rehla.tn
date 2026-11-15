import { Backpack, Store, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { CATEGORIES } from '../../data/categories.js'
import { useAuth } from '../../hooks/useAuth.js'
import AuthLayout, { AuthField, FormAlert } from './AuthLayout.jsx'
import { fieldId, getRedirectTarget, splitApiError, withoutEmpty } from './authForm.js'
import PasswordInput from './PasswordInput.jsx'

const ROLES = [
  { value: 'voyageur', label: 'Voyageur', icon: Backpack },
  { value: 'prestataire', label: 'Prestataire', icon: Store },
]

const PROFILES = [
  { value: 'etudiant', label: 'Étudiant' },
  { value: 'resident', label: 'Résident' },
  { value: 'touriste', label: 'Touriste' },
]

// Types d'activité acceptés par le serveur (types de service, sans les transports).
const ACTIVITY_TYPES = CATEGORIES.filter((cat) => cat.type !== 'transport')

const ACCOUNT_FIELDS = ['name', 'email', 'password']
const FIELDS = {
  voyageur: [...ACCOUNT_FIELDS, 'profile'],
  prestataire: [
    ...ACCOUNT_FIELDS,
    'provider.businessName',
    'provider.activityType',
    'provider.city',
    'provider.phone',
  ],
}

const EMPTY_VALUES = {
  name: '',
  email: '',
  password: '',
  profile: '',
  'provider.businessName': '',
  'provider.activityType': '',
  'provider.city': '',
  'provider.phone': '',
}

const id = (field) => fieldId('inscription', field)

function buildBody(role, values) {
  const account = { name: values.name, email: values.email, password: values.password }
  if (role === 'prestataire') {
    return {
      ...withoutEmpty(account),
      role,
      provider: withoutEmpty({
        businessName: values['provider.businessName'],
        activityType: values['provider.activityType'],
        city: values['provider.city'],
        phone: values['provider.phone'],
      }),
    }
  }
  return { ...withoutEmpty({ ...account, profile: values.profile }), role }
}

export default function RegisterPage() {
  const { user, register } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get('role') === 'prestataire' ? 'prestataire' : 'voyageur'

  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={getRedirectTarget(location)} replace />

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const chooseRole = (nextRole) => {
    if (nextRole === role) return
    const next = new URLSearchParams(searchParams)
    if (nextRole === 'prestataire') next.set('role', 'prestataire')
    else next.delete('role')
    // replace : changer d'onglet ne crée pas d'entrée d'historique ; state garde la page demandée.
    setSearchParams(next, { replace: true, state: location.state })
    setErrors({})
    setGeneralError(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setGeneralError(null)
    try {
      await register(buildBody(role, values))
    } catch (err) {
      const fields = FIELDS[role]
      const { fieldErrors, general } = splitApiError(err, fields)
      setErrors(fieldErrors)
      setGeneralError(general)
      setSubmitting(false)
      const firstInvalid = fields.find((field) => fieldErrors[field])
      if (firstInvalid) document.getElementById(id(firstInvalid))?.focus()
    }
  }

  const field = (name, label, render, hint) => (
    <AuthField id={id(name)} label={label} hint={hint} error={errors[name]}>
      {(props) => render({ ...props, value: values[name], onChange: update(name), required: true })}
    </AuthField>
  )

  const isProvider = role === 'prestataire'

  return (
    <AuthLayout
      titleId="inscription-titre"
      surtitle={isProvider ? 'Espace prestataire' : 'Bienvenue'}
      title="Créer un compte"
      intro={
        isProvider
          ? 'Faites découvrir votre adresse aux voyageurs : publiez vos services, vos offres et répondez aux avis.'
          : 'Gardez vos adresses favorites, donnez votre avis et partagez vos déplacements.'
      }
    >
      <title>Inscription — Rehla.tn</title>

      <div className="auth-page__tabs" role="group" aria-label="Type de compte">
        {ROLES.map((item) => (
          <button
            key={item.value}
            type="button"
            className="services-page__tab label"
            aria-pressed={role === item.value}
            onClick={() => chooseRole(item.value)}
          >
            <Icon icon={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </div>

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <p className="legende auth-form__hint">Tous les champs sont obligatoires.</p>
        <FormAlert>{generalError}</FormAlert>

        {field('name', isProvider ? 'Nom et prénom du responsable' : 'Nom et prénom', (props) => (
          <input {...props} type="text" autoComplete="name" />
        ))}

        {field('email', 'Adresse e-mail', (props) => (
          <input {...props} type="email" autoComplete="email" />
        ))}

        {field(
          'password',
          'Mot de passe',
          (props) => <PasswordInput {...props} autoComplete="new-password" />,
          '8 caractères minimum.',
        )}

        {isProvider ? (
          <fieldset className="auth-form__group">
            <legend className="titre-4">Votre activité</legend>

            {field('provider.businessName', 'Nom commercial', (props) => (
              <input {...props} type="text" autoComplete="organization" />
            ))}

            {field('provider.activityType', 'Type de service', (props) => (
              <select {...props}>
                <option value="">Choisissez un type</option>
                {ACTIVITY_TYPES.map((cat) => (
                  <option key={cat.type} value={cat.type}>
                    {cat.label}
                  </option>
                ))}
              </select>
            ))}

            <div className="auth-form__row">
              {field('provider.city', 'Ville', (props) => (
                <input {...props} type="text" autoComplete="address-level2" />
              ))}

              {field(
                'provider.phone',
                'Téléphone',
                (props) => <input {...props} type="tel" autoComplete="tel" />,
                'Ex. +216 71 000 000',
              )}
            </div>
          </fieldset>
        ) : (
          field('profile', 'Vous êtes', (props) => (
            <select {...props}>
              <option value="">Choisissez votre profil</option>
              {PROFILES.map((profile) => (
                <option key={profile.value} value={profile.value}>
                  {profile.label}
                </option>
              ))}
            </select>
          ))
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={UserPlus}
          className="auth-form__submit"
          disabled={submitting}
        >
          {submitting ? 'Création du compte…' : 'Créer mon compte'}
        </Button>

        <p className="texte-s auth-form__switch">
          Déjà inscrit ?{' '}
          <Link to="/connexion" state={location.state}>
            Se connecter
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
