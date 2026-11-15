import 'leaflet/dist/leaflet.css'
import { CircleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { prefersReducedMotion, TILE_ATTRIBUTION, TILE_URL } from '../lib/mapUtils.js'
import Icon from './Icon.jsx'
import './MapFrame.css'

/**
 * Cadre commun des cartes Leaflet : bordure et thème du site, tuiles OpenStreetMap,
 * bandeau « Carte indisponible » si les tuiles ne chargent pas.
 * Les props restantes (center, zoom, bounds…) sont transmises à MapContainer.
 */
export default function MapFrame({
  label,
  className = '',
  unavailableText,
  children,
  ...mapProps
}) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false)

  return (
    <div className={`map-frame ${className}`.trim()} role="region" aria-label={label}>
      {tilesUnavailable && (
        <p className="map-frame__banner texte-s" role="status">
          <Icon icon={CircleAlert} size={16} />
          Carte indisponible pour le moment. {unavailableText}
        </p>
      )}

      <MapContainer scrollWheelZoom={false} className="map-frame__canvas" {...mapProps}>
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          eventHandlers={{ tileerror: () => setTilesUnavailable(true) }}
        />
        {children}
      </MapContainer>
    </div>
  )
}

/**
 * Déplace la carte sur le marqueur sélectionné puis ouvre sa bulle
 * (sans animation si l'utilisateur préfère réduire les mouvements).
 */
export function FocusMarker({ selectedKey, positions, markersRef, minZoom }) {
  const map = useMap()

  useEffect(() => {
    if (!selectedKey) return
    const position = positions.get(selectedKey)
    const marker = markersRef.current.get(selectedKey)
    if (!position || !marker) return

    const zoom = Math.max(map.getZoom(), minZoom)
    map.once('moveend', () => marker.openPopup())
    if (prefersReducedMotion()) {
      map.setView(position, zoom, { animate: false })
    } else {
      map.flyTo(position, zoom, { duration: 0.8 })
    }
  }, [map, selectedKey, positions, markersRef, minZoom])

  return null
}
