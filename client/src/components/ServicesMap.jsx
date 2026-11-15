import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../data/categories.js'
import { toLatLng } from '../lib/destinationsApi.js'
import { FIT_PADDING, getDropIcon, prefersReducedMotion } from '../lib/mapUtils.js'
import { formatServicePrice } from '../lib/servicesApi.js'
import MapFrame, { FocusMarker } from './MapFrame.jsx'
import './ServicesMap.css'

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))
const DEFAULT_ZOOM = 13
const SELECTED_ZOOM = 15
const SINGLE_SERVICE_ZOOM = 15
const FIT_MAX_ZOOM = 16
const NO_SERVICES = []

/**
 * Cadre la carte à chaque changement de la liste (chargement, changement d'onglet) :
 * tous les marqueurs visibles, un seul service en gros plan, ou la destination s'il n'y a rien.
 */
function FitToServices({ placed, centerLat, centerLng }) {
  const map = useMap()

  useEffect(() => {
    const animate = !prefersReducedMotion()
    if (placed.length > 1) {
      const bounds = L.latLngBounds(placed.map(({ position }) => position))
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate })
    } else if (placed.length === 1) {
      map.setView(placed[0].position, SINGLE_SERVICE_ZOOM, { animate })
    } else {
      map.setView([centerLat, centerLng], DEFAULT_ZOOM, { animate })
    }
  }, [map, placed, centerLat, centerLng])

  return null
}

/**
 * Carte Leaflet des services d'une destination.
 * - center : [latitude, longitude] de la destination
 * - services : services de l'API (location GeoJSON [longitude, latitude])
 * - selectedId : service à mettre en avant (la carte s'y déplace et ouvre sa bulle)
 * - onSelect : appelé quand on clique sur un marqueur
 */
export default function ServicesMap({
  center,
  services = NO_SERVICES,
  selectedId,
  onSelect,
  label,
}) {
  const markersRef = useRef(new Map())

  const placed = useMemo(
    () =>
      services
        .map((service) => ({ service, position: toLatLng(service.location) }))
        .filter((item) => item.position),
    [services],
  )
  const positions = useMemo(
    () => new Map(placed.map(({ service, position }) => [service._id, position])),
    [placed],
  )

  return (
    <MapFrame
      label={label || 'Carte des services'}
      className="services-map"
      unavailableText="La liste des services reste disponible."
      center={center}
      zoom={DEFAULT_ZOOM}
    >
      {placed.map(({ service, position }) => {
        const category = CATEGORY_MAP[service.type]
        const colorVar = category?.color || '--bleu'
        const selected = service._id === selectedId
        const price = formatServicePrice(service)

        return (
          <Marker
            key={service._id}
            position={position}
            title={service.name}
            icon={getDropIcon(colorVar, selected)}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelect?.(service._id) }}
            ref={(marker) => {
              if (marker) markersRef.current.set(service._id, marker)
              else markersRef.current.delete(service._id)
            }}
          >
            <Popup>
              <div className="services-map__popup" style={{ '--marker-color': `var(${colorVar})` }}>
                <span className="services-map__popup-category legende">
                  {category?.label || service.type}
                </span>
                <strong className="services-map__popup-name">{service.name}</strong>
                <span className="services-map__popup-price texte-s">
                  {price.main} {price.unit}
                </span>
                <Link to={`/services/${service._id}`} className="services-map__popup-link texte-s">
                  Voir la fiche
                </Link>
              </div>
            </Popup>
          </Marker>
        )
      })}

      <FitToServices placed={placed} centerLat={center[0]} centerLng={center[1]} />
      <FocusMarker
        selectedKey={selectedId}
        positions={positions}
        markersRef={markersRef}
        minZoom={SELECTED_ZOOM}
      />
    </MapFrame>
  )
}
