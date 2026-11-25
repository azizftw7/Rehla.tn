import { CalendarRange, Home, MapPin, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { getProfileLabel } from '../data/travelerProfiles.js'
import { formatStay } from '../lib/tripSharesApi.js'
import Icon from './Icon.jsx'
import './TravelerCard.css'

/**
 * Carte d'un voyageur qui partage son déplacement (US5.3, US5.4), sur le modèle de la carte
 * d'exemple de l'accueil. N'affiche que ce que le serveur renvoie, c'est-à-dire ce que le
 * voyageur a rendu visible : jamais d'e-mail ni de téléphone.
 * traveler : { name, profile?, avatarUrl?, city?, languages?, startDate, endDate, message?, overlapDays? }
 * destination : nom de la destination (facultatif), headingLevel : niveau du titre.
 */
export default function TravelerCard({ traveler, destination, headingLevel = 3 }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const name = traveler.name || 'Voyageur'
  const profile = getProfileLabel(traveler.profile)
  const stay = formatStay(traveler.startDate, traveler.endDate)
  const Heading = `h${headingLevel}`
  const showPhoto = traveler.avatarUrl && !photoFailed
  const days = traveler.overlapDays

  return (
    <article className="traveler-card">
      <header className="traveler-card__head">
        <span className="traveler-card__avatar arche" aria-hidden={showPhoto ? undefined : true}>
          {showPhoto ? (
            <img
              src={traveler.avatarUrl}
              alt={`Photo de ${name}`}
              width="48"
              height="56"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="traveler-card__who">
          <Heading className="titre-4 traveler-card__name">{name}</Heading>
          {(profile || traveler.city) && (
            <p className="texte-s traveler-card__profile">
              {profile && <span className="traveler-card__badge legende">{profile}</span>}
              {traveler.city && (
                <span className="traveler-card__city">
                  <Icon icon={Home} size={14} />
                  <span className="visually-hidden">Départ de </span>
                  {traveler.city}
                </span>
              )}
            </p>
          )}
        </div>
      </header>

      {destination && (
        <p className="traveler-card__line texte-s">
          <Icon icon={MapPin} size={18} />
          {destination}
        </p>
      )}
      {stay && (
        <p className="traveler-card__line texte-s">
          <Icon icon={CalendarRange} size={18} />
          {stay}
        </p>
      )}
      {days > 0 && (
        <p className="traveler-card__line traveler-card__line--common texte-s">
          <Icon icon={UsersRound} size={18} />
          {days} jour{days > 1 ? 's' : ''} en commun
        </p>
      )}

      {traveler.message && (
        <p className="traveler-card__message texte-s">« {traveler.message} »</p>
      )}

      {traveler.languages?.length > 0 && (
        <ul className="traveler-card__tags" aria-label="Langues parlées">
          {traveler.languages.map((language) => (
            <li key={language} className="traveler-card__tag">
              {language}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
