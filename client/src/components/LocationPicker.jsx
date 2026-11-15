import { Crosshair } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Marker, useMap, useMapEvents } from 'react-leaflet'
import { getDropIcon, prefersReducedMotion } from '../lib/mapUtils.js'
import Button from './Button.jsx'
import MapFrame from './MapFrame.jsx'
import './LocationPicker.css'

// Centre de la Tunisie, quand aucune destination n'est choisie.
const TUNISIA_CENTER = [34.2, 9.6]
const TUNISIA_ZOOM = 6
const DESTINATION_ZOOM = 13

/** Recentre la carte quand la destination change ; garde une référence à la carte. */
function MapController({ lat, lng, zoom, mapRef }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])

  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: !prefersReducedMotion() })
  }, [map, lat, lng, zoom])

  return null
}

function ClickToPlace({ onChange }) {
  useMapEvents({
    click: (event) => onChange([event.latlng.lat, event.latlng.lng]),
  })
  return null
}

const round = (value) => Math.round(value * 1e6) / 1e6

/**
 * Petite carte où un clic place le marqueur du service (même goutte que ServicesMap).
 * - center : [latitude, longitude] de la destination choisie (null → toute la Tunisie)
 * - position : [latitude, longitude] du marqueur, ou null
 * - onChange([lat, lng]) : appelé au clic, au déplacement du marqueur ou via le bouton
 * - colorVar : couleur de la catégorie (variable de tokens.css)
 */
export default function LocationPicker({ center, position, onChange, colorVar = '--bleu', label }) {
  const mapRef = useRef(null)
  const mapCenter = center || TUNISIA_CENTER
  const zoom = center ? DESTINATION_ZOOM : TUNISIA_ZOOM

  const place = ([lat, lng]) => onChange([round(lat), round(lng)])

  // Alternative au clic (clavier) : placer le marqueur au centre de la vue actuelle.
  const placeAtCenter = () => {
    const current = mapRef.current?.getCenter()
    place(current ? [current.lat, current.lng] : mapCenter)
  }

  return (
    <div className="location-picker">
      <MapFrame
        label={label || 'Carte : cliquez pour placer le service'}
        className="location-picker__map"
        unavailableText="Saisissez la latitude et la longitude ci-dessous."
        center={mapCenter}
        zoom={zoom}
      >
        <MapController lat={mapCenter[0]} lng={mapCenter[1]} zoom={zoom} mapRef={mapRef} />
        <ClickToPlace onChange={place} />
        {position && (
          <Marker
            position={position}
            title="Position du service"
            icon={getDropIcon(colorVar, true)}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng()
                place([lat, lng])
              },
            }}
          />
        )}
      </MapFrame>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={Crosshair}
        className="location-picker__center"
        onClick={placeAtCenter}
      >
        Placer au centre de la carte
      </Button>
    </div>
  )
}
