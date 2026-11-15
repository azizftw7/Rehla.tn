import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServicesMap from './ServicesMap.jsx'

// Leaflet ne dessine rien dans jsdom : react-leaflet est remplacé par une fausse carte
// pour vérifier le cadrage demandé.
const fakeMap = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  setView: vi.fn(),
  flyTo: vi.fn(),
  once: vi.fn(),
  getZoom: vi.fn(() => 13),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: () => null,
  useMap: () => fakeMap,
}))

const CENTER = [36.8687, 10.3417]
const service = (id, lng, lat) => ({
  _id: id,
  type: 'restaurant',
  name: `Service ${id}`,
  location: { type: 'Point', coordinates: [lng, lat] },
})

function renderMap(props) {
  return render(
    <MemoryRouter>
      <ServicesMap center={CENTER} {...props} />
    </MemoryRouter>,
  )
}

function mockReducedMotion(reduce) {
  window.matchMedia = vi.fn((query) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  Object.values(fakeMap).forEach((fn) => fn.mockClear())
  mockReducedMotion(false)
})

describe('ServicesMap — cadrage', () => {
  it('cadre tous les marqueurs quand il y a plusieurs services', () => {
    renderMap({ services: [service('a', 10.3, 36.8), service('b', 10.4, 36.9)] })

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1)
    const [bounds, options] = fakeMap.fitBounds.mock.calls[0]
    expect(bounds.getSouthWest()).toMatchObject({ lat: 36.8, lng: 10.3 })
    expect(bounds.getNorthEast()).toMatchObject({ lat: 36.9, lng: 10.4 })
    expect(options).toEqual({ padding: [40, 40], maxZoom: 16, animate: true })
  })

  it('centre sur le service au zoom 15 quand il est seul', () => {
    renderMap({ services: [service('a', 10.3, 36.8)] })
    expect(fakeMap.setView).toHaveBeenCalledWith([36.8, 10.3], 15, { animate: true })
  })

  it('revient sur la destination au zoom 13 quand il n’y a aucun service', () => {
    renderMap({ services: [] })
    expect(fakeMap.setView).toHaveBeenCalledWith(CENTER, 13, { animate: true })
  })

  it('recadre quand la liste change, sans animation si l’utilisateur le demande', () => {
    mockReducedMotion(true)
    const first = [service('a', 10.3, 36.8), service('b', 10.4, 36.9)]
    const { rerender } = renderMap({ services: first })
    expect(fakeMap.fitBounds.mock.calls[0][1]).toMatchObject({ animate: false })

    // Même liste : pas de nouveau cadrage.
    rerender(
      <MemoryRouter>
        <ServicesMap center={CENTER} services={first} />
      </MemoryRouter>,
    )
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1)

    rerender(
      <MemoryRouter>
        <ServicesMap center={CENTER} services={[service('c', 10.2, 36.7)]} />
      </MemoryRouter>,
    )
    expect(fakeMap.setView).toHaveBeenLastCalledWith([36.7, 10.2], 15, { animate: false })
  })
})
