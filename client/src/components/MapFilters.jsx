import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import { ACCOMMODATION_TYPES } from '../data/accommodationTypes.js'
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js'
import { CATEGORIES } from '../data/categories.js'
import { formatLanguage, GUIDE_LANGUAGES } from '../data/languages.js'
import {
  appliesTo,
  countActiveFilters,
  EMPTY_FILTERS,
  getPeriodError,
  PRICE_OPTIONS,
  RATING_OPTIONS,
  withTypes,
} from '../lib/mapFilters.js'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import '../pages/services/ServicesPage.css'
import './MapFilters.css'

/**
 * Filtres multicritères de la carte (US2.3).
 * - Catégories : plusieurs types à la fois ; « Transports » ouvre l'onglet des transports.
 * - « Filtres » : prix, note minimale, type d'hébergement, catégorie d'activité, période des
 *   événements, langue parlée par les guides (US4.2). Les filtres propres à un type n'apparaissent que si ce type est affiché.
 * filters : objet de lib/mapFilters.js ; onChange(nextFilters) à chaque modification.
 */
export default function MapFilters({ filters, onChange }) {
  const activeCount = countActiveFilters(filters)
  const [open, setOpen] = useState(activeCount > 0)
  const id = useId()
  const periodError = getPeriodError(filters)

  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value })

  const toggleType = (type) => {
    const types = filters.types.includes(type)
      ? filters.types.filter((item) => item !== type)
      : [...filters.types, type]
    onChange(withTypes(filters, types))
  }

  const resetFilters = () => onChange({ ...EMPTY_FILTERS, types: filters.types })

  // Une catégorie venue de l'URL mais absente de la liste reste sélectionnable.
  const activityCategories =
    filters.activityCategory && !ACTIVITY_CATEGORIES.includes(filters.activityCategory)
      ? [...ACTIVITY_CATEGORIES, filters.activityCategory]
      : ACTIVITY_CATEGORIES

  // Une langue venue de l'URL mais absente de la liste reste sélectionnable.
  const languageValue = filters.language ? formatLanguage(filters.language) : ''
  const languages =
    languageValue && !GUIDE_LANGUAGES.includes(languageValue)
      ? [...GUIDE_LANGUAGES, languageValue]
      : GUIDE_LANGUAGES

  return (
    <div className="map-filters">
      <div className="map-filters__bar">
        <div className="services-page__tabs" role="group" aria-label="Filtrer par catégorie">
          <button
            type="button"
            className="services-page__tab label"
            aria-pressed={!filters.transport && filters.types.length === 0}
            onClick={() => onChange(withTypes(filters, []))}
          >
            Tous
          </button>
          {CATEGORIES.map((category) => {
            const isTransport = category.type === 'transport'
            const pressed = isTransport
              ? filters.transport
              : !filters.transport && filters.types.includes(category.type)
            return (
              <button
                key={category.type}
                type="button"
                className="services-page__tab label"
                style={{ '--tab-accent': `var(${category.color})` }}
                aria-pressed={pressed}
                onClick={() =>
                  isTransport
                    ? onChange({ ...EMPTY_FILTERS, transport: true })
                    : toggleType(category.type)
                }
              >
                <Icon icon={category.icon} size={16} />
                {category.title}
              </button>
            )
          })}
        </div>

        {!filters.transport && (
          <button
            type="button"
            className="services-page__tab label map-filters__toggle"
            aria-expanded={open}
            aria-controls={`${id}-panneau`}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon icon={SlidersHorizontal} size={16} />
            Filtres
            {activeCount > 0 && (
              <span className="map-filters__badge">
                {activeCount}
                <span className="visually-hidden"> actif{activeCount > 1 ? 's' : ''}</span>
              </span>
            )}
          </button>
        )}
      </div>

      {!filters.transport && (
        <div
          id={`${id}-panneau`}
          className="services-page__filters map-filters__panel"
          role="group"
          aria-label="Filtres avancés"
          hidden={!open}
        >
          <div className="services-page__field">
            <label htmlFor={`${id}-prix`} className="legende">
              Prix
            </label>
            <select
              id={`${id}-prix`}
              className="services-page__input texte-s"
              value={filters.price}
              onChange={set('price')}
            >
              {PRICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="services-page__field">
            <label htmlFor={`${id}-note`} className="legende">
              Note minimale
            </label>
            <select
              id={`${id}-note`}
              className="services-page__input texte-s"
              value={filters.minRating}
              onChange={set('minRating')}
            >
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {appliesTo(filters, 'hebergement') && (
            <div className="services-page__field">
              <label htmlFor={`${id}-hebergement`} className="legende">
                Type d’hébergement
              </label>
              <select
                id={`${id}-hebergement`}
                className="services-page__input texte-s"
                value={filters.accommodationType}
                onChange={set('accommodationType')}
              >
                <option value="">Tous les hébergements</option>
                {ACCOMMODATION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {appliesTo(filters, 'activite') && (
            <div className="services-page__field">
              <label htmlFor={`${id}-activite`} className="legende">
                Catégorie d’activité
              </label>
              <select
                id={`${id}-activite`}
                className="services-page__input texte-s"
                value={filters.activityCategory}
                onChange={set('activityCategory')}
              >
                <option value="">Toutes les activités</option>
                {activityCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {appliesTo(filters, 'guide') && (
            <div className="services-page__field">
              <label htmlFor={`${id}-langue`} className="legende">
                Langue du guide
              </label>
              <select
                id={`${id}-langue`}
                className="services-page__input texte-s"
                value={languageValue}
                onChange={set('language')}
              >
                <option value="">Toutes les langues</option>
                {languages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </div>
          )}

          {appliesTo(filters, 'evenement') && (
            <>
              <div className="services-page__field">
                <label htmlFor={`${id}-du`} className="legende">
                  Événements du
                </label>
                <input
                  id={`${id}-du`}
                  type="date"
                  className="services-page__input texte-s"
                  value={filters.from}
                  onChange={set('from')}
                />
              </div>
              <div className="services-page__field">
                <label htmlFor={`${id}-au`} className="legende">
                  au
                </label>
                <input
                  id={`${id}-au`}
                  type="date"
                  className="services-page__input texte-s"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={set('to')}
                  aria-invalid={periodError ? true : undefined}
                  aria-describedby={periodError ? `${id}-au-erreur` : undefined}
                />
              </div>
              {periodError && (
                <p
                  id={`${id}-au-erreur`}
                  className="services-page__field-error legende map-filters__error"
                  role="alert"
                >
                  {periodError}
                </p>
              )}
            </>
          )}

          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              className="map-filters__reset"
              onClick={resetFilters}
            >
              Effacer les filtres
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
