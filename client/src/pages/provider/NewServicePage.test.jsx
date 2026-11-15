import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockApi } from '../../test/utils.jsx'
import { buildFormData, checkPhotos } from './newServiceForm.js'
import NewServicePage from './NewServicePage.jsx'

// Leaflet ne fonctionne pas dans jsdom : la carte est remplacée par un bouton qui simule un clic.
vi.mock('../../components/LocationPicker.jsx', () => ({
  default: function LocationPickerMock({ center, position, onChange }) {
    return (
      <div
        data-testid="carte"
        data-center={JSON.stringify(center)}
        data-position={JSON.stringify(position)}
      >
        <button type="button" onClick={() => onChange([33.876, 10.858])}>
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
    {
      _id: 'd2',
      name: 'Tozeur',
      region: 'Tozeur',
      location: { type: 'Point', coordinates: [8.13, 33.92] },
    },
  ],
  total: 2,
  page: 1,
  pages: 1,
}

function ServicePageStub() {
  const location = useLocation()
  return (
    <p data-testid="fiche">
      {location.pathname} | {location.state?.notice}
    </p>
  )
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/prestataire/services/nouveau']}>
      <Routes>
        <Route path="/prestataire/services/nouveau" element={<NewServicePage />} />
        <Route path="/services/:id" element={<ServicePageStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

const image = (name, type = 'image/png', size = 1000) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

let objectUrls = 0
beforeEach(() => {
  objectUrls = 0
  URL.createObjectURL = vi.fn(() => `blob:apercu-${(objectUrls += 1)}`)
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  delete URL.createObjectURL
  delete URL.revokeObjectURL
})

async function fillRestaurant(user) {
  await user.click(screen.getByRole('button', { name: 'Restaurant' }))
  await user.type(screen.getByLabelText('Nom du service *'), 'Le Jasmin Bleu')
  await user.selectOptions(await screen.findByLabelText('Destination *'), 'Djerba (Médenine)')
  await user.type(screen.getByLabelText('Prix (DT) *'), '40')
  await user.type(screen.getByLabelText('Par'), 'repas')
  await user.type(screen.getByLabelText('Type de cuisine *'), 'Tunisienne')
  await user.click(await screen.findByRole('button', { name: 'Simuler un clic sur la carte' }))
}

describe('NewServicePage — formulaire', () => {
  it('affiche les sections et les champs propres au type choisi', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Publier un service' }),
    ).toBeInTheDocument()
    for (const section of [
      'Type de service',
      'Informations',
      'Prix',
      'Contact et vidéo',
      'Photos',
    ]) {
      expect(screen.getByRole('group', { name: section })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Hébergement' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Type d’hébergement *')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Événement' }))
    expect(screen.getByRole('button', { name: 'Événement' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByLabelText('Type d’hébergement *')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Date de début *')).toBeInTheDocument()
    expect(screen.getByLabelText('Date de fin')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guide' }))
    expect(screen.getByLabelText('Langues parlées *')).toBeInTheDocument()
  })

  it('centre la carte sur la destination et remplit la position au clic', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    const carte = await screen.findByTestId('carte')
    expect(carte).toHaveAttribute('data-center', 'null')

    await user.selectOptions(await screen.findByLabelText('Destination *'), 'Tozeur (Tozeur)')
    expect(screen.getByTestId('carte')).toHaveAttribute('data-center', '[33.92,8.13]')

    await user.click(screen.getByRole('button', { name: 'Simuler un clic sur la carte' }))
    expect(screen.getByLabelText('Latitude *')).toHaveValue(33.876)
    expect(screen.getByLabelText('Longitude *')).toHaveValue(10.858)
    expect(screen.getByTestId('carte')).toHaveAttribute('data-position', '[33.876,10.858]')
  })

  it('masque le prix quand le service est gratuit', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    await user.click(screen.getByRole('checkbox', { name: 'Gratuit' }))

    expect(screen.queryByLabelText('Prix (DT) *')).not.toBeInTheDocument()
  })
})

describe('NewServicePage — photos', () => {
  it('affiche un aperçu de chaque photo et permet d’en retirer une avant l’envoi', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    await user.upload(screen.getByLabelText('Ajouter des photos'), [
      image('terrasse.png'),
      image('salle.jpg', 'image/jpeg'),
    ])

    const list = screen.getByRole('list', { name: 'Photos choisies' })
    expect(within(list).getByAltText('Aperçu de la photo 1 : terrasse.png')).toHaveAttribute(
      'src',
      'blob:apercu-1',
    )
    expect(within(list).getByAltText('Aperçu de la photo 2 : salle.jpg')).toBeInTheDocument()
    expect(screen.getByText(/2 \/ 5 photos/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retirer la photo 1 (terrasse.png)' }))

    expect(screen.queryByAltText(/terrasse\.png/)).not.toBeInTheDocument()
    expect(screen.getByAltText('Aperçu de la photo 1 : salle.jpg')).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:apercu-1')
  })

  it('refuse un fichier qui n’est pas une image, avec un message relié au champ', async () => {
    const user = userEvent.setup({ applyAccept: false })
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    const input = screen.getByLabelText('Ajouter des photos')
    await user.upload(input, new File(['%PDF'], 'menu.pdf', { type: 'application/pdf' }))

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      /« menu\.pdf » n’est pas une image JPEG, PNG ou WebP\./,
    )
    expect(screen.queryByRole('list', { name: 'Photos choisies' })).not.toBeInTheDocument()
  })

  it('limite à 5 photos et désactive le champ une fois la limite atteinte', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /destinations': () => jsonResponse(DESTINATIONS) })
    renderPage()

    const input = screen.getByLabelText('Ajouter des photos')
    await user.upload(
      input,
      Array.from({ length: 6 }, (_, i) => image(`p${i}.png`)),
    )

    expect(
      within(screen.getByRole('list', { name: 'Photos choisies' })).getAllByRole('img'),
    ).toHaveLength(5)
    expect(screen.getByText('Vous pouvez ajouter au plus 5 photos.')).toBeInTheDocument()
    expect(input).toBeDisabled()
  })

  it('checkPhotos refuse les photos de plus de 5 Mo', () => {
    const { kept, error } = checkPhotos(
      [],
      [image('grande.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)],
    )

    expect(kept).toEqual([])
    expect(error).toBe('« grande.jpg » dépasse 5 Mo.')
  })
})

describe('NewServicePage — envoi', () => {
  it('envoie un FormData puis redirige vers la fiche avec un message de confirmation', async () => {
    const user = userEvent.setup()
    let resolveCreate
    const fetchMock = mockApi({
      'GET /destinations': () => jsonResponse(DESTINATIONS),
      'POST /provider/services': () =>
        new Promise((resolve) => {
          resolveCreate = () =>
            resolve(jsonResponse({ service: { _id: 's42', name: 'Le Jasmin Bleu' } }, 201))
        }),
    })
    renderPage()

    await fillRestaurant(user)
    await user.upload(screen.getByLabelText('Ajouter des photos'), image('terrasse.png'))
    await user.click(screen.getByRole('button', { name: 'Publier le service' }))

    // Bouton désactivé pendant l'envoi.
    const pending = await screen.findByRole('button', { name: 'Publication en cours…' })
    expect(pending).toBeDisabled()

    const [, options] = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(options.headers['Content-Type']).toBeUndefined()
    const sent = options.body
    expect(Object.fromEntries([...sent.entries()].filter(([key]) => key !== 'photos'))).toEqual({
      type: 'restaurant',
      name: 'Le Jasmin Bleu',
      destination: 'd1',
      price: '40',
      priceUnit: 'repas',
      cuisine: 'Tunisienne',
      latitude: '33.876',
      longitude: '10.858',
      free: 'false',
    })
    expect(sent.getAll('photos').map((file) => file.name)).toEqual(['terrasse.png'])

    resolveCreate()
    await waitFor(() =>
      expect(screen.getByTestId('fiche')).toHaveTextContent(
        '/services/s42 | « Le Jasmin Bleu » est publié : les voyageurs peuvent le voir dès maintenant.',
      ),
    )
  })

  it('affiche chaque erreur du serveur sous son champ et place le focus sur la première', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /destinations': () => jsonResponse(DESTINATIONS),
      'POST /provider/services': () =>
        jsonResponse(
          {
            message: 'Données invalides.',
            details: [
              { field: 'name', message: 'Le nom du service est obligatoire.' },
              { field: 'latitude', message: 'La position doit se trouver en Tunisie.' },
              { field: 'accommodationType', message: "Choisissez un type d'hébergement." },
            ],
          },
          400,
        ),
    })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Publier le service' }))

    const name = screen.getByLabelText('Nom du service *')
    await waitFor(() => expect(name).toHaveFocus())
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Le nom du service est obligatoire.')
    expect(screen.getByLabelText('Latitude *')).toHaveAccessibleDescription(
      'La position doit se trouver en Tunisie.',
    )
    expect(screen.getByLabelText('Type d’hébergement *')).toHaveAccessibleDescription(
      "Choisissez un type d'hébergement.",
    )
    expect(screen.getByRole('button', { name: 'Publier le service' })).toBeEnabled()
  })

  it('affiche un message général si le serveur est indisponible', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /destinations': () => jsonResponse(DESTINATIONS),
      'POST /provider/services': () =>
        jsonResponse(
          {
            message:
              "L'envoi des photos est momentanément indisponible. Réessayez dans quelques instants.",
            details: [],
          },
          503,
        ),
    })
    renderPage()

    await fillRestaurant(user)
    await user.click(screen.getByRole('button', { name: 'Publier le service' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/momentanément indisponible/)
  })

  it('signale l’échec du chargement des destinations et permet de réessayer', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      'GET /destinations': () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ message: 'Base indisponible.' }, 503)
          : jsonResponse(DESTINATIONS)
      },
    })
    renderPage()

    expect(await screen.findByText(/Impossible de charger les destinations/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('option', { name: 'Djerba (Médenine)' })).toBeInTheDocument()
    expect(screen.queryByText(/Impossible de charger les destinations/)).not.toBeInTheDocument()
  })
})

describe('buildFormData', () => {
  it('n’envoie que les champs du type choisi, sans prix si gratuit, langues en liste', () => {
    const data = buildFormData(
      'guide',
      {
        name: ' Slim ',
        price: '80',
        cuisine: 'ignorée',
        languages: 'français, arabe',
        latitude: '33.8',
        longitude: '10.8',
      },
      true,
      [],
    )

    expect(Object.fromEntries(data.entries())).toEqual({
      type: 'guide',
      name: 'Slim',
      languages: 'français, arabe',
      latitude: '33.8',
      longitude: '10.8',
      free: 'true',
    })
  })
})
