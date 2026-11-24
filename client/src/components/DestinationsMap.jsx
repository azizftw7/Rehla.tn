import L from 'leaflet'
import { MapPin } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import { toLatLng } from '../lib/destinationsApi.js'
import { FIT_PADDING, getDropIcon, prefersReducedMotion } from '../lib/mapUtils.js'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import MapFrame, { FocusMarker } from './MapFrame.jsx'
import './DestinationsMap.css'

/** Toute la Tunisie : [[sud, ouest], [nord, est]]. */
const TUNISIA_BOUNDS = [
  [30.2, 7.5],
  [37.6, 11.6],
]
const FIT_MAX_ZOOM = 9
const SELECTED_ZOOM = 10
const NO_DESTINATIONS = []

/** Recadre sur les destinations affichées, ou sur toute la Tunisie s'il n'y en a aucune. */
function FitToDestinations({ placed }) {
  const map = useMap()

  useEffect(() => {
    const animate = !prefersReducedMotion()
    if (placed.length > 0) {
      const bounds = L.latLngBounds(placed.map(({ position }) => position))
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate })
    } else {
      map.fitBounds(TUNISIA_BOUNDS, { animate })
    }
  }, [map, placed])

  return null
}

function PopupMedia({ src, name }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="destinations-map__media arche">
      {src && !failed ? (
        <img src={src} alt={`Vue de ${name}`} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="destinations-map__placeholder" aria-hidden="true">
          <Icon icon={MapPin} size={28} />
        </div>
      )}
    </div>
  )
}

/**
 * Carte de la Tunisie avec un marqueur par destination.
 * - destinations : réponse de GET /api/destinations (location GeoJSON [longitude, latitude])
 * - selectedSlug : destination à mettre en avant (la carte s'y déplace et ouvre sa bulle)
 * - onSelect : appelé quand on clique sur un marqueur
 * - linkQuery : paramètres ajoutés au lien « Voir la carte » (ex. « ?types=guide »)
 */
export default function DestinationsMap({
  destinations = NO_DESTINATIONS,
  selectedSlug,
  onSelect,
  label,
  linkQuery = '',
}) {
  const markersRef = useRef(new Map())

  const placed = useMemo(
    () =>
      destinations
        .map((destination) => ({ destination, position: toLatLng(destination.location) }))
        .filter((item) => item.position),
    [destinations],
  )
  const positions = useMemo(
    () => new Map(placed.map(({ destination, position }) => [destination.slug, position])),
    [placed],
  )

  return (
    <MapFrame
      label={label || 'Carte des destinations en Tunisie'}
      className="destinations-map"
      unavailableText="La liste des destinations reste disponible."
      bounds={TUNISIA_BOUNDS}
    >
      {placed.map(({ destination, position }) => {
        const selected = destination.slug === selectedSlug

        return (
          <Marker
            key={destination.slug}
            position={position}
            title={destination.name}
            icon={getDropIcon('--bleu', selected)}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(destination.slug) }}
            ref={(marker) => {
              if (marker) markersRef.current.set(destination.slug, marker)
              else markersRef.current.delete(destination.slug)
            }}
          >
            <Popup minWidth={220} maxWidth={260}>
              <div className="destinations-map__popup">
                <PopupMedia src={destination.coverImage} name={destination.name} />
                <strong className="destinations-map__name">{destination.name}</strong>
                {destination.region && (
                  <span className="destinations-map__region texte-s">
                    <Icon icon={MapPin} size={14} />
                    {destination.region}
                  </span>
                )}
                {destination.description && (
                  <p className="destinations-map__description texte-s">{destination.description}</p>
                )}
                <Button
                  to={`/destinations/${destination.slug}${linkQuery}`}
                  variant="primary"
                  size="sm"
                >
                  Explorer {destination.name}
                </Button>
              </div>
            </Popup>
          </Marker>
        )
      })}

      <FitToDestinations placed={placed} />
      <FocusMarker
        selectedKey={selectedSlug}
        positions={positions}
        markersRef={markersRef}
        minZoom={SELECTED_ZOOM}
      />
    </MapFrame>
  )
}
