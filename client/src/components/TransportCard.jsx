import { Building2, CalendarClock, Clock } from 'lucide-react'
import { CATEGORIES } from '../data/categories.js'
import { TRANSPORT_TYPE_MAP } from '../data/transportTypes.js'
import {
  formatDuration,
  formatTransportPrice,
  formatTransportSource,
} from '../lib/transportsApi.js'
import Icon from './Icon.jsx'
import './TransportCard.css'

const TRANSPORT_CATEGORY = CATEGORIES.find((cat) => cat.type === 'transport')

/** Fiche d'un moyen de transport (US4.1) : type, trajet, prix, durée, horaires et source. */
export default function TransportCard({ transport, headingLevel = 3 }) {
  const typeInfo = TRANSPORT_TYPE_MAP[transport.type]
  const Heading = `h${headingLevel}`
  const duration = formatDuration(transport.duration)
  const source = formatTransportSource(transport)

  return (
    <article
      className="transport-card"
      style={{ '--transport-accent': `var(${TRANSPORT_CATEGORY.color})` }}
    >
      <div className="transport-card__header">
        <span className="transport-card__type legende">
          <Icon icon={typeInfo?.icon ?? TRANSPORT_CATEGORY.icon} size={16} />
          {typeInfo?.label ?? transport.type}
        </span>
        <p className="transport-card__price titre-4">{formatTransportPrice(transport.price)}</p>
      </div>

      <Heading className="transport-card__route titre-4">
        {transport.from} → {transport.to}
      </Heading>

      <ul className="transport-card__infos texte-s">
        {transport.operator && (
          <li className="transport-card__info">
            <Icon icon={Building2} size={16} />
            <span>
              <span className="visually-hidden">Opérateur : </span>
              {transport.operator}
            </span>
          </li>
        )}
        {duration && (
          <li className="transport-card__info">
            <Icon icon={Clock} size={16} />
            <span>
              <span className="visually-hidden">Durée : </span>
              {duration}
            </span>
          </li>
        )}
        {transport.schedule && (
          <li className="transport-card__info">
            <Icon icon={CalendarClock} size={16} />
            <span>
              <span className="visually-hidden">Horaires : </span>
              {transport.schedule}
            </span>
          </li>
        )}
      </ul>

      {source && <p className="transport-card__source legende">{source}</p>}
    </article>
  )
}
