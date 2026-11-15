import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DestinationsMap from './DestinationsMap.jsx'

// Leaflet ne dessine rien dans jsdom : react-leaflet est remplacé par une fausse carte.
const fakeMap = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  setView: vi.fn(),
  flyTo: vi.fn(),
  once: vi.fn(),
  getZoom: vi.fn(() => 7),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  useMap: () => fakeMap,
}))

const destination = (slug, lng, lat) => ({
  _id: slug,
  slug,
  name: slug,
  region: 'Région',
  location: { type: 'Point', coordinates: [lng, lat] },
})

function renderMap(props) {
  return render(
    <MemoryRouter>
      <DestinationsMap {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Object.values(fakeMap).forEach((fn) => fn.mockClear())
  window.matchMedia = vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

describe('DestinationsMap — cadrage', () => {
  it('cadre les destinations affichées (maxZoom 9)', () => {
    renderMap({
      destinations: [destination('djerba', 10.86, 33.81), destination('tozeur', 8.13, 33.92)],
    })

    const [bounds, options] = fakeMap.fitBounds.mock.calls[0]
    expect(bounds.getSouthWest()).toMatchObject({ lat: 33.81, lng: 8.13 })
    expect(bounds.getNorthEast()).toMatchObject({ lat: 33.92, lng: 10.86 })
    expect(options).toEqual({ padding: [40, 40], maxZoom: 9, animate: true })
  })

  it('revient sur toute la Tunisie quand aucune destination ne correspond', () => {
    renderMap({ destinations: [] })
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      [
        [30.2, 7.5],
        [37.6, 11.6],
      ],
      { animate: true },
    )
  })
})
