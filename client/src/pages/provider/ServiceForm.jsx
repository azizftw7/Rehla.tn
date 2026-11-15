import { ArrowLeft, ImagePlus, Save, Send, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/Button.jsx'
import Icon from '../../components/Icon.jsx'
import { ACCOMMODATION_TYPES } from '../../data/accommodationTypes.js'
import { CATEGORIES } from '../../data/categories.js'
import { EVENT_TYPES } from '../../data/eventTypes.js'
import { toLatLng } from '../../lib/destinationsApi.js'
import { createService, fetchDestinationsList, updateService } from '../../lib/servicesApi.js'
import { AuthField, FormAlert } from '../auth/AuthLayout.jsx'
import { fieldId, splitApiError } from '../auth/authForm.js'
import '../auth/AuthPages.css'
import '../services/ServicesPage.css'
import {
  ACCEPTED_TYPES,
  ACTIVITY_CATEGORY_SUGGESTIONS,
  ALL_FIELDS,
  buildFormData,
  checkPhotos,
  EMPTY_VALUES,
  MAX_PHOTOS,
  PRICE_UNITS,
  serviceToForm,
} from './newServiceForm.js'
import './NewServicePage.css'

// Leaflet n'est chargé qu'à l'affichage du formulaire.
const LocationPicker = lazy(() => import('../../components/LocationPicker.jsx'))

const SERVICE_CATEGORIES = CATEGORIES.filter((cat) => cat.type !== 'transport')

const id = (field) => fieldId('service', field)

// Clé unique de chaque photo choisie (liste React).
let nextPhotoKey = 0

function previewUrl(file) {
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

function MapPlaceholder() {
  return <div className="nouveau-service__map-placeholder skeleton" aria-hidden="true" />
}

/** Photos de départ : en modification, celles déjà publiées ({ src }), retirables. */
function initialPhotos(service) {
  return (service?.photos || []).map((src) => ({ key: (nextPhotoKey += 1), src }))
}

/**
 * Formulaire d'une fiche service, partagé par « Publier un service » (US6.1)
 * et « Modifier un service » (US6.2, `service` fourni : champs et photos préremplis).
 */
export default function ServiceForm({ service }) {
  const editing = Boolean(service)
  const navigate = useNavigate()
  const [initial] = useState(() =>
    service ? serviceToForm(service) : { type: 'hebergement', values: EMPTY_VALUES, free: false },
  )
  const [type, setType] = useState(initial.type)
  const [values, setValues] = useState(initial.values)
  const [free, setFree] = useState(initial.free)
  const [photos, setPhotos] = useState(() => initialPhotos(service))
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [destinations, setDestinations] = useState({ items: [], error: null, reload: 0 })
  const fileInputRef = useRef(null)
  const photosRef = useRef(photos)

  useEffect(() => {
    const controller = new AbortController()
    fetchDestinationsList({ signal: controller.signal })
      .then((res) => setDestinations((prev) => ({ ...prev, items: res.items || [], error: null })))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setDestinations((prev) => ({ ...prev, items: [], error: err.message }))
      })
    return () => controller.abort()
  }, [destinations.reload])

  // Libère les aperçus quand on quitte la page.
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(
    () => () => photosRef.current.forEach((photo) => photo.url && URL.revokeObjectURL(photo.url)),
    [],
  )

  const clearError = (field) => setErrors((prev) => ({ ...prev, [field]: undefined }))

  const setValue = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    clearError(field)
  }

  const update = (field) => (event) => setValue(field, event.target.value)

  const category = SERVICE_CATEGORIES.find((cat) => cat.type === type)
  const destination = destinations.items.find((dest) => dest._id === values.destination)
  const destinationCenter = destination ? toLatLng(destination.location) : null
  const latitude = Number.parseFloat(values.latitude)
  const longitude = Number.parseFloat(values.longitude)
  const position =
    Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null

  const choosePosition = ([lat, lng]) => {
    setValues((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
    setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }))
  }

  const addPhotos = (event) => {
    const { kept, error } = checkPhotos(photos, Array.from(event.target.files || []))
    // Permet de choisir à nouveau le même fichier après l'avoir retiré.
    event.target.value = ''
    if (kept.length > 0) {
      setPhotos((prev) => [
        ...prev,
        ...kept.map((file) => ({ key: (nextPhotoKey += 1), file, url: previewUrl(file) })),
      ])
    }
    setErrors((prev) => ({ ...prev, photos: error || undefined }))
  }

  const removePhoto = (key) => {
    setPhotos((prev) => {
      const removed = prev.find((photo) => photo.key === key)
      // Une photo déjà publiée ({ src }) n'a pas d'aperçu local à libérer.
      if (removed?.url) URL.revokeObjectURL(removed.url)
      return prev.filter((photo) => photo.key !== key)
    })
    clearError('photos')
    fileInputRef.current?.focus()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setGeneralError(null)
    try {
      const formData = buildFormData(type, values, free, photos)
      if (editing) {
        const { service: saved } = await updateService(service._id, formData)
        navigate('/prestataire/services', {
          state: { notice: `Les modifications de « ${saved.name} » sont enregistrées.` },
        })
      } else {
        const { service: created } = await createService(formData)
        navigate(`/services/${created._id}`, {
          state: {
            notice: `« ${created.name} » est publié : les voyageurs peuvent le voir dès maintenant.`,
          },
        })
      }
    } catch (err) {
      const { fieldErrors, general } = splitApiError(err, ALL_FIELDS)
      setErrors(fieldErrors)
      setGeneralError(general)
      setSubmitting(false)
      const firstInvalid = ALL_FIELDS.find((field) => fieldErrors[field])
      if (firstInvalid) document.getElementById(id(firstInvalid))?.focus()
      else document.getElementById('service-erreur-generale')?.focus()
    }
  }

  const field = (name, label, render, { hint, required = false } = {}) => (
    <AuthField
      id={id(name)}
      label={required ? `${label} *` : label}
      hint={hint}
      error={errors[name]}
    >
      {(props) =>
        render({
          ...props,
          value: values[name],
          onChange: update(name),
          required: required || undefined,
        })
      }
    </AuthField>
  )

  const photosHintId = `${id('photos')}-aide`
  const photosErrorId = errors.photos ? `${id('photos')}-erreur` : null

  return (
    <section
      className="nouveau-service"
      aria-labelledby="nouveau-service-titre"
      style={{ '--service-accent': `var(${category.color})` }}
    >
      <title>
        {editing ? `Modifier « ${service.name} » — Rehla.tn` : 'Publier un service — Rehla.tn'}
      </title>
      <div className="container nouveau-service__inner">
        <Link to="/prestataire/services" className="nouveau-service__back texte-s">
          <Icon icon={ArrowLeft} size={16} />
          Retour à mes services
        </Link>

        <header className="services-page__header">
          <p className="surtitre nouveau-service__surtitre">Espace prestataire</p>
          <h1 id="nouveau-service-titre" className="titre-1">
            {editing ? 'Modifier un service' : 'Publier un service'}
          </h1>
          <p className="texte-l nouveau-service__intro">
            {editing
              ? `Mettez à jour « ${service.name} » : les voyageurs verront les changements dès l’enregistrement.`
              : 'Présentez votre adresse aux voyageurs : quelques informations, des photos et sa position sur la carte suffisent.'}
          </p>
        </header>

        <form className="auth-form nouveau-service__form" noValidate onSubmit={handleSubmit}>
          <p className="legende auth-form__hint">
            Les champs marqués d’un astérisque (*) sont obligatoires.
          </p>
          <div id="service-erreur-generale" tabIndex={-1}>
            <FormAlert>{generalError}</FormAlert>
          </div>

          {/* ---------- Type ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Type de service</legend>
            <div
              id={id('type')}
              className="services-page__tabs nouveau-service__tabs"
              tabIndex={-1}
            >
              {SERVICE_CATEGORIES.map((cat) => (
                <button
                  key={cat.type}
                  type="button"
                  className="services-page__tab label"
                  style={{ '--tab-accent': `var(${cat.color})` }}
                  aria-pressed={type === cat.type}
                  onClick={() => {
                    setType(cat.type)
                    clearError('type')
                  }}
                >
                  <Icon icon={cat.icon} size={16} />
                  {cat.label}
                </button>
              ))}
            </div>
            {errors.type && <p className="services-page__field-error legende">{errors.type}</p>}
          </fieldset>

          {/* ---------- Informations ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Informations</legend>

            {field(
              'name',
              'Nom du service',
              (props) => (
                <input {...props} type="text" maxLength={120} />
              ),
              {
                required: true,
              },
            )}

            {field(
              'description',
              'Description',
              (props) => (
                <textarea {...props} rows={5} maxLength={5000} />
              ),
              { hint: 'Ce que les voyageurs vont trouver chez vous : ambiance, services, accès…' },
            )}

            <div className="auth-form__row">
              {field(
                'destination',
                'Destination',
                (props) => (
                  <select {...props}>
                    <option value="">Choisissez une destination</option>
                    {destinations.items.map((dest) => (
                      <option key={dest._id} value={dest._id}>
                        {dest.name} ({dest.region})
                      </option>
                    ))}
                  </select>
                ),
                { required: true },
              )}

              {field('address', 'Adresse', (props) => (
                <input {...props} type="text" autoComplete="street-address" maxLength={250} />
              ))}
            </div>

            {destinations.error && (
              <div className="nouveau-service__inline-alert">
                <FormAlert>Impossible de charger les destinations. {destinations.error}</FormAlert>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDestinations((prev) => ({ ...prev, reload: prev.reload + 1 }))}
                >
                  Réessayer
                </Button>
              </div>
            )}
          </fieldset>

          {/* ---------- Prix ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Prix</legend>

            <label className="services-page__checkbox texte-s">
              <input
                type="checkbox"
                checked={free}
                onChange={(event) => {
                  setFree(event.target.checked)
                  clearError('price')
                }}
              />
              Gratuit
            </label>

            {!free && (
              <div className="auth-form__row">
                {field(
                  'price',
                  'Prix (DT)',
                  (props) => (
                    <input {...props} type="number" min="0" step="0.5" inputMode="decimal" />
                  ),
                  { required: true },
                )}

                {field(
                  'priceUnit',
                  'Par',
                  (props) => (
                    <>
                      <input {...props} type="text" list="service-unites" maxLength={30} />
                      <datalist id="service-unites">
                        {(PRICE_UNITS[type] || []).map((unit) => (
                          <option key={unit} value={unit} />
                        ))}
                      </datalist>
                    </>
                  ),
                  { hint: `Ex. ${(PRICE_UNITS[type] || ['personne']).join(', ')}` },
                )}
              </div>
            )}
          </fieldset>

          {/* ---------- Champs propres au type ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Détails : {category.label.toLowerCase()}</legend>

            {type === 'hebergement' &&
              field(
                'accommodationType',
                'Type d’hébergement',
                (props) => (
                  <select {...props}>
                    <option value="">Choisissez un type</option>
                    {ACCOMMODATION_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ),
                { required: true },
              )}

            {type === 'restaurant' &&
              field(
                'cuisine',
                'Type de cuisine',
                (props) => (
                  <input
                    {...props}
                    type="text"
                    maxLength={60}
                    placeholder="Ex. Tunisienne, Fruits de mer…"
                  />
                ),
                { required: true },
              )}

            {type === 'activite' &&
              field(
                'activityCategory',
                'Catégorie d’activité',
                (props) => (
                  <>
                    <input
                      {...props}
                      type="text"
                      list="service-categories-activite"
                      maxLength={60}
                    />
                    <datalist id="service-categories-activite">
                      {ACTIVITY_CATEGORY_SUGGESTIONS.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </>
                ),
                { required: true, hint: 'Ex. Plage, Désert, Culture et artisanat…' },
              )}

            {type === 'evenement' && (
              <>
                <div className="auth-form__row">
                  {field('eventType', 'Type d’événement', (props) => (
                    <select {...props}>
                      <option value="">Choisissez un type</option>
                      {EVENT_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ))}
                  {field(
                    'hours',
                    'Horaires',
                    (props) => (
                      <input {...props} type="text" maxLength={60} />
                    ),
                    {
                      hint: 'Ex. 20h – 23h',
                    },
                  )}
                </div>
                <div className="auth-form__row">
                  {field(
                    'startDate',
                    'Date de début',
                    (props) => (
                      <input {...props} type="date" max={values.endDate || undefined} />
                    ),
                    {
                      required: true,
                    },
                  )}
                  {field('endDate', 'Date de fin', (props) => (
                    <input {...props} type="date" min={values.startDate || undefined} />
                  ))}
                </div>
              </>
            )}

            {type === 'guide' &&
              field(
                'languages',
                'Langues parlées',
                (props) => <input {...props} type="text" maxLength={300} />,
                {
                  required: true,
                  hint: 'Séparées par des virgules. Ex. français, arabe, anglais',
                },
              )}
          </fieldset>

          {/* ---------- Contact et vidéo ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Contact et vidéo</legend>
            <div className="auth-form__row">
              {field(
                'phone',
                'Téléphone',
                (props) => (
                  <input {...props} type="tel" autoComplete="tel" />
                ),
                {
                  hint: 'Ex. +216 71 000 000',
                },
              )}
              {field(
                'website',
                'Site web',
                (props) => (
                  <input {...props} type="url" autoComplete="url" />
                ),
                {
                  hint: 'Ex. https://www.mon-adresse.tn',
                },
              )}
            </div>
            {field(
              'videoUrl',
              'Lien d’une vidéo',
              (props) => (
                <input {...props} type="url" />
              ),
              {
                hint: 'Lien YouTube de présentation (facultatif).',
              },
            )}
          </fieldset>

          {/* ---------- Photos ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Photos</legend>

            <div className="services-page__field">
              <label htmlFor={id('photos')} className="nouveau-service__upload label">
                <Icon icon={ImagePlus} size={22} />
                <span>Ajouter des photos</span>
              </label>
              <input
                ref={fileInputRef}
                id={id('photos')}
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                multiple
                className="nouveau-service__file"
                disabled={photos.length >= MAX_PHOTOS}
                aria-invalid={errors.photos ? true : undefined}
                aria-describedby={[photosHintId, photosErrorId].filter(Boolean).join(' ')}
                onChange={addPhotos}
              />
              <p id={photosHintId} className="legende auth-form__hint">
                JPEG, PNG ou WebP, 5 Mo maximum par photo. {photos.length} / {MAX_PHOTOS} photo
                {photos.length > 1 ? 's' : ''}.
              </p>
              {errors.photos && (
                <p id={photosErrorId} className="services-page__field-error legende" role="alert">
                  {errors.photos}
                </p>
              )}
            </div>

            {photos.length > 0 && (
              <ul className="nouveau-service__photos" role="list" aria-label="Photos choisies">
                {photos.map((photo, index) => (
                  <li key={photo.key} className="nouveau-service__photo arche">
                    {photo.src ? (
                      <img src={photo.src} alt={`Photo ${index + 1} actuellement publiée`} />
                    ) : photo.url ? (
                      <img
                        src={photo.url}
                        alt={`Aperçu de la photo ${index + 1} : ${photo.file.name}`}
                      />
                    ) : (
                      <span className="nouveau-service__photo-name legende">{photo.file.name}</span>
                    )}
                    {index === 0 && (
                      <span className="nouveau-service__cover legende">Couverture</span>
                    )}
                    <button
                      type="button"
                      className="nouveau-service__remove"
                      aria-label={`Retirer la photo ${index + 1} (${photo.file ? photo.file.name : 'photo publiée'})`}
                      onClick={() => removePhoto(photo.key)}
                    >
                      <Icon icon={X} size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {/* ---------- Position ---------- */}
          <fieldset className="nouveau-service__section">
            <legend className="titre-4">Position sur la carte *</legend>
            <p className="texte-s nouveau-service__intro">
              {destination
                ? `La carte est centrée sur ${destination.name}. Cliquez à l’endroit exact de votre service ; vous pouvez ensuite déplacer le marqueur.`
                : 'Choisissez d’abord une destination, puis cliquez sur la carte à l’endroit exact de votre service.'}
            </p>

            <Suspense fallback={<MapPlaceholder />}>
              <LocationPicker
                center={destinationCenter}
                position={position}
                onChange={choosePosition}
                colorVar={category.color}
                label="Carte : cliquez pour placer votre service"
              />
            </Suspense>

            <div className="auth-form__row">
              {field(
                'latitude',
                'Latitude',
                (props) => (
                  <input {...props} type="number" step="any" inputMode="decimal" />
                ),
                {
                  required: true,
                },
              )}
              {field(
                'longitude',
                'Longitude',
                (props) => (
                  <input {...props} type="number" step="any" inputMode="decimal" />
                ),
                {
                  required: true,
                },
              )}
            </div>
          </fieldset>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={editing ? Save : Send}
            className="auth-form__submit"
            disabled={submitting}
          >
            {editing
              ? submitting
                ? 'Enregistrement en cours…'
                : 'Enregistrer les modifications'
              : submitting
                ? 'Publication en cours…'
                : 'Publier le service'}
          </Button>
        </form>
      </div>
    </section>
  )
}
