import { Info, Save, Share2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import TravelerCard from '../../components/TravelerCard.jsx'
import {
  expiryFromEnd,
  formatDayMonth,
  LANGUAGES,
  MAX_MESSAGE_LENGTH,
  publicName,
  todayInputDate,
} from '../../lib/tripSharesApi.js'
import { FormAlert } from '../auth/AuthLayout.jsx'
import { splitApiError } from '../auth/authForm.js'
import { EMPTY_FORM } from './tripShareValues.js'

const FIELDS = ['destination', 'startDate', 'endDate', 'message', 'city', 'languages']

/** Mêmes règles que le serveur, pour signaler les erreurs avant l'envoi. */
function validate(values) {
  const errors = {}
  if (!values.destination) errors.destination = 'Choisissez une destination.'
  if (!values.startDate) errors.startDate = "La date d'aller est obligatoire."
  if (!values.endDate) errors.endDate = 'La date de retour est obligatoire.'
  else if (values.startDate && values.endDate <= values.startDate) {
    errors.endDate = "La date de retour doit être postérieure à la date d'aller."
  } else if (values.endDate < todayInputDate()) {
    errors.endDate = 'La date de retour est déjà passée.'
  }
  if (values.message.trim().length > MAX_MESSAGE_LENGTH) {
    errors.message = `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`
  }
  if (values.visible.city && !values.city.trim()) {
    errors.city = 'Indiquez votre ville de départ, ou décochez « Ville de départ ».'
  }
  if (values.visible.languages && values.languages.length === 0) {
    errors.languages = 'Choisissez au moins une langue, ou décochez « Langues parlées ».'
  }
  return errors
}

/** Corps envoyé à l'API : une information décochée n'est pas envoyée. */
function toBody(values) {
  const { visible } = values
  return {
    destination: values.destination,
    startDate: values.startDate,
    endDate: values.endDate,
    message: values.message.trim(),
    ...(visible.city ? { city: values.city.trim() } : {}),
    ...(visible.languages ? { languages: values.languages } : {}),
    visible,
  }
}

/**
 * Formulaire « Partager mon déplacement » (US5.3) et, à côté, l'aperçu en direct de ce que
 * les autres voyageurs verront.
 * - user : voyageur connecté (prénom, profil, photo de l'aperçu)
 * - destinations : { items, loading, error, retry }
 * - initial : valeurs de départ (modification d'un partage) ; editing : libellés de modification
 * - onSubmit(body) : promesse ; les erreurs de l'API s'affichent sous les champs
 * - onCancel : « Annuler » (vide le formulaire ou quitte la modification)
 */
export default function TripShareForm({
  user,
  destinations,
  initial = EMPTY_FORM,
  editing = false,
  onSubmit,
  onCancel,
}) {
  const id = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)

  const fieldId = (name) => `${id}-${name}`
  const errorId = (name) => `${id}-${name}-erreur`

  const setField = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }
  const setVisible = (name, checked) => {
    setValues((prev) => ({ ...prev, visible: { ...prev.visible, [name]: checked } }))
    if (name === 'city' || name === 'languages') {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }
  const toggleLanguage = (language, checked) =>
    setField(
      'languages',
      checked
        ? [...values.languages, language]
        : values.languages.filter((item) => item !== language),
    )

  const focusFirstError = (fieldErrors) => {
    const first = FIELDS.find((name) => fieldErrors[name])
    if (!first) return
    const target =
      first === 'languages'
        ? formRef.current?.querySelector(`[name="${fieldId('langue')}"]`)
        : formRef.current?.querySelector(`#${CSS.escape(fieldId(first))}`)
    target?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const fieldErrors = validate(values)
    setErrors(fieldErrors)
    setGeneral(null)
    if (Object.keys(fieldErrors).length > 0) {
      focusFirstError(fieldErrors)
      return
    }
    setBusy(true)
    try {
      await onSubmit(toBody(values))
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      setErrors(split.fieldErrors)
      setGeneral(split.general)
      focusFirstError(split.fieldErrors)
      setBusy(false)
    }
  }

  const describedBy = (name, extra) =>
    [extra, errors[name] && errorId(name)].filter(Boolean).join(' ') || undefined
  const fieldError = (name) =>
    errors[name] && (
      <p id={errorId(name)} className="services-page__field-error legende">
        {errors[name]}
      </p>
    )

  const destinationName = destinations.items.find((item) => item._id === values.destination)?.name
  const expiry = formatDayMonth(expiryFromEnd(values.endDate))
  const extraLanguages = values.languages.filter((language) => !LANGUAGES.includes(language))
  const preview = {
    name: publicName(user?.name) || 'Vous',
    profile: values.visible.profile ? user?.profile : undefined,
    city: values.visible.city ? values.city.trim() : undefined,
    languages: values.visible.languages ? values.languages : undefined,
    avatarUrl: values.visible.photo ? user?.avatarUrl : undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    message: values.message.trim(),
  }

  return (
    <div className="partage-page__grid">
      <form
        ref={formRef}
        className="partage-form"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={`${id}-titre`}
      >
        <h2 id={`${id}-titre`} className="titre-3 partage-form__title">
          {editing ? 'Modifier mon partage' : 'Mon déplacement'}
        </h2>
        <FormAlert>{general}</FormAlert>

        <div className="services-page__field">
          <label htmlFor={fieldId('destination')} className="label">
            Destination
          </label>
          <select
            id={fieldId('destination')}
            className="services-page__input"
            value={values.destination}
            disabled={destinations.loading}
            onChange={(event) => setField('destination', event.target.value)}
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby={describedBy('destination')}
          >
            <option value="">
              {destinations.loading ? 'Chargement des destinations…' : 'Choisissez une destination'}
            </option>
            {destinations.items.map((destination) => (
              <option key={destination._id} value={destination._id}>
                {destination.name}
              </option>
            ))}
          </select>
          {destinations.error && (
            <p className="legende partage-form__inline-error" role="alert">
              Impossible de charger les destinations.{' '}
              <button type="button" className="partage-form__link" onClick={destinations.retry}>
                Réessayer
              </button>
            </p>
          )}
          {fieldError('destination')}
        </div>

        <div className="partage-form__dates">
          <div className="services-page__field">
            <label htmlFor={fieldId('startDate')} className="label">
              Date d’aller
            </label>
            <input
              id={fieldId('startDate')}
              type="date"
              className="services-page__input"
              value={values.startDate}
              onChange={(event) => setField('startDate', event.target.value)}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={describedBy('startDate')}
            />
            {fieldError('startDate')}
          </div>
          <div className="services-page__field">
            <label htmlFor={fieldId('endDate')} className="label">
              Date de retour
            </label>
            <input
              id={fieldId('endDate')}
              type="date"
              className="services-page__input"
              min={values.startDate || todayInputDate()}
              value={values.endDate}
              onChange={(event) => setField('endDate', event.target.value)}
              aria-invalid={errors.endDate ? true : undefined}
              aria-describedby={describedBy('endDate')}
            />
            {fieldError('endDate')}
          </div>
        </div>

        <div className="services-page__field">
          <label htmlFor={fieldId('message')} className="label">
            Message <span className="legende partage-form__optional">(facultatif)</span>
          </label>
          <textarea
            id={fieldId('message')}
            className="services-page__input texte-s partage-form__textarea"
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Un louage à partager, une sortie à plusieurs…"
            value={values.message}
            onChange={(event) => setField('message', event.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy('message', fieldId('compteur'))}
          />
          <p id={fieldId('compteur')} className="legende partage-form__counter">
            {values.message.trim().length} / {MAX_MESSAGE_LENGTH} caractères
          </p>
          {fieldError('message')}
        </div>

        <fieldset className="partage-form__visible">
          <legend className="label">Visible par les co-voyageurs</legend>
          <label className="services-page__checkbox">
            <input type="checkbox" checked disabled />
            Prénom et initiale (toujours visibles)
          </label>
          <label className="services-page__checkbox">
            <input
              type="checkbox"
              checked={values.visible.profile}
              onChange={(event) => setVisible('profile', event.target.checked)}
            />
            Profil
          </label>

          <label className="services-page__checkbox">
            <input
              type="checkbox"
              checked={values.visible.city}
              onChange={(event) => setVisible('city', event.target.checked)}
            />
            Ville de départ
          </label>
          {values.visible.city && (
            <div className="services-page__field partage-form__sub">
              <label htmlFor={fieldId('city')} className="visually-hidden">
                Ville de départ
              </label>
              <input
                id={fieldId('city')}
                className="services-page__input"
                placeholder="Ex. Tunis"
                maxLength={80}
                value={values.city}
                onChange={(event) => setField('city', event.target.value)}
                aria-invalid={errors.city ? true : undefined}
                aria-describedby={describedBy('city')}
              />
              {fieldError('city')}
            </div>
          )}

          <label className="services-page__checkbox">
            <input
              type="checkbox"
              checked={values.visible.languages}
              onChange={(event) => setVisible('languages', event.target.checked)}
            />
            Langues parlées
          </label>
          {values.visible.languages && (
            <fieldset
              className="partage-form__sub partage-form__languages"
              aria-describedby={describedBy('languages')}
            >
              <legend className="visually-hidden">Langues parlées</legend>
              {[...LANGUAGES, ...extraLanguages].map((language) => (
                <label key={language} className="partage-form__language">
                  <input
                    type="checkbox"
                    name={fieldId('langue')}
                    checked={values.languages.includes(language)}
                    onChange={(event) => toggleLanguage(language, event.target.checked)}
                  />
                  <span>{language}</span>
                </label>
              ))}
              {fieldError('languages')}
            </fieldset>
          )}

          <label className="services-page__checkbox">
            <input
              type="checkbox"
              checked={values.visible.photo}
              onChange={(event) => setVisible('photo', event.target.checked)}
            />
            Photo de profil
            {!user?.avatarUrl && (
              <span className="legende partage-form__optional">(aucune photo sur votre compte)</span>
            )}
          </label>
        </fieldset>

        <div className="partage-form__actions">
          <Button type="submit" variant="accent" icon={editing ? Save : Share2} disabled={busy}>
            {busy
              ? editing
                ? 'Enregistrement…'
                : 'Publication…'
              : editing
                ? 'Enregistrer les modifications'
                : 'Publier mon partage'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        </div>
      </form>

      <aside className="partage-apercu" aria-labelledby={`${id}-apercu`}>
        <p id={`${id}-apercu`} className="surtitre partage-apercu__title">
          Ce que les autres voient
        </p>
        {/* Aperçu en direct, sans aria-live : il change à chaque frappe, l'annoncer serait bruyant. */}
        <TravelerCard traveler={preview} destination={destinationName} />

        <p className="partage-apercu__info texte-s" role="note">
          <Icon icon={Info} size={18} />
          <span>
            Vos coordonnées restent privées : jamais d’e-mail ni de téléphone. Votre partage
            s’efface après votre retour{expiry ? `, le ${expiry}` : ''}.
          </span>
        </p>
      </aside>
    </div>
  )
}
