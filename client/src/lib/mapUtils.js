import L from 'leaflet'

// Utilitaires partagés par les cartes Leaflet (ServicesMap, DestinationsMap).
// Ce module importe Leaflet : il ne doit être utilisé que par des composants chargés en React.lazy.

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>'

export const FIT_PADDING = [40, 40]

export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

// Une icône par couleur et par état (normal / sélectionné), créée une seule fois.
const iconCache = new Map()

/**
 * Marqueur en forme de goutte (styles .map-marker dans MapFrame.css).
 * colorVar : nom d'une variable CSS de tokens.css, ex. '--cat-restaurant' ou '--bleu'.
 */
export function getDropIcon(colorVar = '--bleu', selected = false) {
  const key = `${colorVar}|${selected}`
  if (!iconCache.has(key)) {
    const size = selected ? [36, 46] : [28, 36]
    iconCache.set(
      key,
      L.divIcon({
        className: 'map-marker__icon',
        html: `<span class="map-marker${
          selected ? ' map-marker--selected' : ''
        }" style="--marker-color: var(${colorVar})"></span>`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1]],
        popupAnchor: [0, -size[1] + 4],
      }),
    )
  }
  return iconCache.get(key)
}
