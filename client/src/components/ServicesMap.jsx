import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { CATEGORIES } from '../data/categories.js'
import { toLatLng } from '../lib/destinationsApi.js'
import { formatServicePrice } from '../lib/servicesApi.js'
import Icon from './Icon.jsx'
import './ServicesMap.css'

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((cat) => [cat.type, cat]))
const DEFAULT_ZOOM = 13
const SELECTED_ZOOM = 15

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>'

// Une icône par couleur de catégorie et par état (normal / sélectionné), créée une seule fois.
const iconCache = new Map()

function getMarkerIcon(colorVar, selected) {
  const key = `${colorVar}|${selected}`
  if (!iconCache.has(key)) {
    const size = selected ? [36, 46] : [28, 36]
    iconCache.set(
      key,
      L.divIcon({
        className: 'services-map__icon',
        html: `<span class="services-map__marker${
          selected ? ' services-map__marker--selected' : ''
        }" style="--marker-color: var(${colorVar})"></span>`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1]],
        popupAnchor: [0, -size[1] + 4],
      }),
    )
  }
  return iconCache.get(key)
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

/** Centre la carte sur le service sélectionné puis ouvre sa bulle. */
function FocusSelected({ selectedId, positions, markersRef }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedId) return
    const position = positions.get(selectedId)
    const marker = markersRef.current.get(selectedId)
    if (!position || !marker) return

    const zoom = Math.max(map.getZoom(), SELECTED_ZOOM)
    map.once('moveend', () => marker.openPopup())
    if (prefersReducedMotion()) {
      map.setView(position, zoom, { animate: false })
    } else {
      map.flyTo(position, zoom, { duration: 0.8 })
    }
  }, [map, selectedId, positions, markersRef])

  return null
}

/**
 * Carte Leaflet des services d'une destination.
 * - center : [latitude, longitude] de la destination
 * - services : services de l'API (location GeoJSON [longitude, latitude])
 * - selectedId : service à mettre en avant (la carte s'y déplace et ouvre sa bulle)
 * - onSelect : appelé quand on clique sur un marqueur
 */
export default function ServicesMap({ center, services = [], selectedId, onSelect, label }) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
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
    <div className="services-map" role="region" aria-label={label || 'Carte des services'}>
      {tilesUnavailable && (
        <p className="services-map__banner texte-s" role="status">
          <Icon icon={CircleAlert} size={16} />
          Carte indisponible pour le moment. La liste des services reste disponible.
        </p>
      )}

      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        className="services-map__canvas"
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />

        {placed.map(({ service, position }) => {
          const category = CATEGORY_MAP[service.type]
          const selected = service._id === selectedId
          const price = formatServicePrice(service)

          return (
            <Marker
              key={service._id}
              position={position}
              title={service.name}
              icon={getMarkerIcon(category?.color || '--bleu', selected)}
              zIndexOffset={selected ? 1000 : 0}
              eventHandlers={{ click: () => onSelect?.(service._id) }}
              ref={(marker) => {
                if (marker) markersRef.current.set(service._id, marker)
                else markersRef.current.delete(service._id)
              }}
            >
              <Popup>
                <div
                  className="services-map__popup"
                  style={{ '--marker-color': `var(${category?.color || '--bleu'})` }}
                >
                  <span className="services-map__popup-category legende">
                    {category?.label || service.type}
                  </span>
                  <strong className="services-map__popup-name">{service.name}</strong>
                  <span className="services-map__popup-price texte-s">
                    {price.main} {price.unit}
                  </span>
                  <Link
                    to={`/services/${service._id}`}
                    className="services-map__popup-link texte-s"
                  >
                    Voir la fiche
                  </Link>
                </div>
              </Popup>
            </Marker>
          )
        })}

        <FocusSelected selectedId={selectedId} positions={positions} markersRef={markersRef} />
      </MapContainer>
    </div>
  )
}
