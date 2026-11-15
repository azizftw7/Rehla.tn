import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import EditServicePage from './EditServicePage.jsx'
import { buildFormData, serviceToForm } from './newServiceForm.js'

// Leaflet ne fonctionne pas dans jsdom : la carte est remplacée par un bouton qui simule un clic.
vi.mock('../../components/LocationPicker.jsx', () => ({
  default: function LocationPickerMock({ position, onChange }) {
    return (
      <div data-testid="carte" data-position={JSON.stringify(position)}>
        <button type="button" onClick={() => onChange([33.9, 10.9])}>
          Simuler un clic sur la carte
        </button>
      </div>
    )
  },
}))

const DESTINATIONS = {
  items: [
    {
      _id: 'd1',
      name: 'Djerba',
      region: 'Médenine',
      location: { type: 'Point', coordinates: [10.8575, 33.8758] },
    },
  ],
  total: 1,
  page: 1,
  pages: 1,
}

const PHOTO_1 = 'https://res.cloudinary.com/demo/image/upload/v1/rehla/services/a.png'
const PHOTO_2 = 'https://res.cloudinary.com/demo/image/upload/v1/rehla/services/b.png'

const SERVICE = {
  _id: 's1',
  type: 'restaurant',
  name: 'Le Jasmin Bleu',
  description: 'Cuisine en terrasse.',
  destination: { _id: 'd1', name: 'Djerba', region: 'Médenine' },
  address: 'Houmt Souk',
  location: { type: 'Point', coordinates: [10.858, 33.876] },
  free: false,
  price: { amount: 40, unit: 'repas' },
  cuisine: 'Tunisienne',
  contact: { phone: '+216 75 000 000' },
  photos: [PHOTO_1, PHOTO_2],
  hidden: false,
}

function MyServicesStub() {
  const location = useLocation()
  return <p data-testid="mes-services">{location.state?.notice}</p>
}

function renderPage(id = 's1') {
  return render(
    <MemoryRouter initialEntries={[`/prestataire/services/${id}/modifier`]}>
      <Routes>
        <Route path="/prestataire/services/:id/modifier" element={<EditServicePage />} />
        <Route path="/prestataire/services" element={<MyServicesStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:apercu')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

describe('EditServicePage — formulaire prérempli', () => {
  it('reprend le formulaire de publication avec les valeurs et les photos du service', async () => {
    mockApi({
      'GET /provider/services/s1': () => jsonResponse({ service: SERVICE }),
      'GET /destinations': () => jsonResponse(DESTINATIONS),
    })
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Chargement du service…')
    expect(await screen.findByLabelText('Nom du service *')).toHaveValue('Le Jasmin Bleu')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Modifier un service' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restaurant' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Nom du service *')).toHaveValue('Le Jasmin Bleu')
    expect(screen.getByLabelText('Description')).toHaveValue('Cuisine en terrasse.')
    // La valeur s'affiche dès que la liste des destinations est chargée.
    await waitFor(() => expect(screen.getByLabelText('Destination *')).toHaveValue('d1'))
    expect(screen.getByLabelText('Prix (DT) *')).toHaveValue(40)
    expect(screen.getByLabelText('Par')).toHaveValue('repas')
    expect(screen.getByLabelText('Type de cuisine *')).toHaveValue('Tunisienne')
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+216 75 000 000')
    expect(screen.getByLabelText('Latitude *')).toHaveValue(33.876)
    expect(screen.getByLabelText('Longitude *')).toHaveValue(10.858)

    const photos = screen.getByRole('list', { name: 'Photos choisies' })
    expect(within(photos).getByAltText('Photo 1 actuellement publiée')).toHaveAttribute(
      'src',
      PHOTO_1,
    )
    expect(within(photos).getByAltText('Photo 2 actuellement publiée')).toBeInTheDocument()
    expect(screen.getByText(/2 \/ 5 photos/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à mes services' })).toHaveAttribute(
      'href',
      '/prestataire/services',
    )
  })

  it('envoie les photos gardées et les nouvelles, puis revient à « Mes services »', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /provider/services/s1': () => jsonResponse({ service: SERVICE }),
      'GET /destinations': () => jsonResponse(DESTINATIONS),
      'PUT /provider/services/s1': () =>
        jsonResponse({ service: { ...SERVICE, name: 'Le Jasmin' } }),
    })
    renderPage()

    const name = await screen.findByLabelText('Nom du service *')
    await user.clear(name)
    await user.type(name, 'Le Jasmin')
    await user.click(screen.getByRole('button', { name: 'Retirer la photo 1 (photo publiée)' }))
    // Retirer une photo publiée ne libère aucun aperçu local.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await user.upload(
      screen.getByLabelText('Ajouter des photos'),
      new File(['x'], 'salle.png', { type: 'image/png' }),
    )
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    expect(await screen.findByTestId('mes-services')).toHaveTextContent(
      'Les modifications de « Le Jasmin » sont enregistrées.',
    )
    const [url, options] = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'PUT')
    expect(url).toMatch(/\/provider\/services\/s1$/)
    const sent = options.body
    expect(sent.get('name')).toBe('Le Jasmin')
    expect(sent.get('type')).toBe('restaurant')
    expect(sent.getAll('keptPhotos')).toEqual([PHOTO_2])
    expect(sent.getAll('photos').map((file) => file.name)).toEqual(['salle.png'])
  })

  it('affiche les erreurs de validation de l’API sous les champs', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /provider/services/s1': () => jsonResponse({ service: SERVICE }),
      'GET /destinations': () => jsonResponse(DESTINATIONS),
      'PUT /provider/services/s1': () =>
        jsonResponse(
          {
            message: 'Données invalides.',
            details: [{ field: 'name', message: 'Le nom du service est obligatoire.' }],
          },
          400,
        ),
    })
    renderPage()

    await user.clear(await screen.findByLabelText('Nom du service *'))
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))

    const name = screen.getByLabelText('Nom du service *')
    expect(await screen.findByText('Le nom du service est obligatoire.')).toBeInTheDocument()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
  })
})

describe('EditServicePage — erreurs de chargement', () => {
  it('indique qu’un service introuvable (ou d’un autre prestataire) n’existe pas', async () => {
    mockApi({
      'GET /provider/services/s9': () => jsonResponse({ message: 'Service introuvable.' }, 404),
    })
    renderPage('s9')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Service introuvable')
    expect(within(alert).getByRole('link', { name: 'Voir mes services' })).toHaveAttribute(
      'href',
      '/prestataire/services',
    )
  })

  it('propose « Réessayer » si le serveur est indisponible', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      'GET /provider/services/s1': () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ message: 'Base de données indisponible.' }, 503)
          : jsonResponse({ service: SERVICE })
      },
      'GET /destinations': () => jsonResponse(DESTINATIONS),
    })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Base de données indisponible.')
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByLabelText('Nom du service *')).toHaveValue('Le Jasmin Bleu')
  })
})

describe('serviceToForm / buildFormData', () => {
  it('convertit un événement gratuit et un guide en valeurs de formulaire', () => {
    const event = serviceToForm({
      type: 'evenement',
      name: 'Festival',
      destination: 'd1',
      location: { coordinates: [10.85, 33.87] },
      free: true,
      event: {
        eventType: 'Festival',
        startDate: '2026-12-12T00:00:00.000Z',
        endDate: '2026-12-14T00:00:00.000Z',
        hours: '20h',
      },
    })
    const guide = serviceToForm({ type: 'guide', languages: ['français', 'arabe'] })

    expect(event.type).toBe('evenement')
    expect(event.free).toBe(true)
    expect(event.values).toMatchObject({
      destination: 'd1',
      startDate: '2026-12-12',
      endDate: '2026-12-14',
      eventType: 'Festival',
      hours: '20h',
      price: '',
      latitude: '33.87',
      longitude: '10.85',
    })
    expect(guide.values.languages).toBe('français, arabe')
  })

  it('envoie les photos publiées dans keptPhotos et les fichiers dans photos', () => {
    const file = new File(['x'], 'neuve.png', { type: 'image/png' })
    const data = buildFormData('restaurant', { name: 'X' }, true, [
      { key: 1, src: PHOTO_1 },
      { key: 2, file },
    ])

    expect(data.getAll('keptPhotos')).toEqual([PHOTO_1])
    expect(data.getAll('photos')).toEqual([file])
  })
})
