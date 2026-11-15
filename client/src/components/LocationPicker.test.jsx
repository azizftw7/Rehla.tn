import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import LocationPicker from './LocationPicker.jsx'

// Leaflet ne dessine rien dans jsdom : fausse carte qui garde les gestionnaires d'événements.
const fake = vi.hoisted(() => ({
  map: {
    setView: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 33.8758, lng: 10.8575 })),
  },
  handlers: {},
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ position, title }) => (
    <div data-testid="marker" title={title} data-position={JSON.stringify(position)} />
  ),
  useMap: () => fake.map,
  useMapEvents: (handlers) => {
    fake.handlers = handlers
    return fake.map
  },
}))

const DJERBA = [33.8758, 10.8575]

describe('LocationPicker', () => {
  it('centre la carte sur la destination, ou sur la Tunisie sans destination', () => {
    const { rerender } = render(
      <LocationPicker center={null} position={null} onChange={() => {}} />,
    )
    expect(fake.map.setView).toHaveBeenLastCalledWith([34.2, 9.6], 6, expect.anything())

    rerender(<LocationPicker center={DJERBA} position={null} onChange={() => {}} />)
    expect(fake.map.setView).toHaveBeenLastCalledWith(DJERBA, 13, expect.anything())
  })

  it('un clic sur la carte renvoie la position (arrondie)', () => {
    const onChange = vi.fn()
    render(<LocationPicker center={DJERBA} position={null} onChange={onChange} />)

    fake.handlers.click({ latlng: { lat: 33.123456789, lng: 10.987654321 } })

    expect(onChange).toHaveBeenCalledWith([33.123457, 10.987654])
  })

  it('affiche le marqueur à la position choisie', () => {
    render(<LocationPicker center={DJERBA} position={[33.87, 10.85]} onChange={() => {}} />)

    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '[33.87,10.85]')
  })

  it('le bouton place le marqueur au centre de la carte (alternative au clic)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<LocationPicker center={DJERBA} position={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Placer au centre de la carte' }))

    expect(onChange).toHaveBeenCalledWith([33.8758, 10.8575])
  })
})
