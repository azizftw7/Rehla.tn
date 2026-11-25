import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import MyServicesPage from './MyServicesPage.jsx'

const JASMIN = {
  _id: 's1',
  type: 'restaurant',
  name: 'Le Jasmin Bleu',
  destination: { _id: 'd1', name: 'Djerba' },
  cuisine: 'Tunisienne',
  price: { amount: 40, unit: 'repas' },
  photos: [],
  hidden: false,
}
const FELOUQUE = {
  _id: 's2',
  type: 'activite',
  name: 'Balade en felouque',
  destination: { _id: 'd1', name: 'Djerba' },
  activityCategory: 'Plage',
  free: true,
  photos: [],
  hidden: true,
}

const page = (items, extra = {}) => ({ items, total: items.length, page: 1, pages: 1, ...extra })

function renderPage(entry = '/prestataire/services') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/prestataire/services" element={<MyServicesPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MyServicesPage — affichage', () => {
  it('affiche l’en-tête, le bouton « Publier un service » et la liste avec le badge « Masqué »', async () => {
    mockApi({ 'GET /provider/services': () => jsonResponse(page([JASMIN, FELOUQUE])) })
    renderPage()

    expect(screen.getByText('Espace prestataire')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Mes services' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Publier un service' })).toHaveAttribute(
      'href',
      '/prestataire/services/nouveau',
    )
    expect(screen.getByRole('status', { name: 'Chargement de vos services' })).toBeInTheDocument()

    const list = await screen.findByRole('list')
    const [jasmin, felouque] = within(list).getAllByRole('listitem')
    expect(within(jasmin).queryByText('Masqué')).not.toBeInTheDocument()
    expect(within(felouque).getByText('Masqué')).toBeInTheDocument()
    expect(screen.getByText('2 services publiés')).toBeInTheDocument()

    expect(within(jasmin).getByRole('link', { name: 'Modifier « Le Jasmin Bleu »' })).toHaveAttribute(
      'href',
      '/prestataire/services/s1/modifier',
    )
    expect(within(jasmin).getByRole('button', { name: 'Masquer « Le Jasmin Bleu »' })).toBeEnabled()
    expect(
      within(felouque).getByRole('button', { name: 'Afficher « Balade en felouque »' }),
    ).toBeEnabled()
    // Un service masqué n'a pas de fiche publique : son titre mène à la modification.
    expect(within(felouque).getByRole('link', { name: 'Balade en felouque' })).toHaveAttribute(
      'href',
      '/prestataire/services/s2/modifier',
    )
    expect(within(jasmin).getByRole('link', { name: 'Le Jasmin Bleu' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
  })

  it('affiche un appel à l’action quand aucun service n’est publié', async () => {
    mockApi({ 'GET /provider/services': () => jsonResponse(page([])) })
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Vous n’avez encore publié aucun service' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Publier mon premier service' })).toHaveAttribute(
      'href',
      '/prestataire/services/nouveau',
    )
  })

  it('affiche l’erreur avec « Réessayer », qui relance le chargement', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      'GET /provider/services': () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ message: 'Service momentanément indisponible.' }, 503)
          : jsonResponse(page([JASMIN]))
      },
    })
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger vos services')
    expect(alert).toHaveTextContent('Service momentanément indisponible.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Le Jasmin Bleu')).toBeInTheDocument()
  })

  it('pagine et demande la bonne page à l’API', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /provider/services': () => jsonResponse(page([JASMIN], { total: 13, pages: 2 })),
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Suivant' }))

    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)[0]).toMatch(/\/provider\/services\?page=2&limit=12$/),
    )
  })

  it('affiche le message transmis après une modification', async () => {
    mockApi({ 'GET /provider/services': () => jsonResponse(page([JASMIN])) })
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/prestataire/services', state: { notice: 'Modifications enregistrées.' } },
        ]}
      >
        <Routes>
          <Route path="/prestataire/services" element={<MyServicesPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('status')).toHaveTextContent('Modifications enregistrées.')
  })
})

describe('MyServicesPage — masquer / afficher', () => {
  it('masque un service puis le réaffiche', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /provider/services': () => jsonResponse(page([JASMIN])),
      'PATCH /provider/services/s1/visibilite': (body) =>
        jsonResponse({ service: { ...JASMIN, hidden: body.hidden } }),
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Masquer « Le Jasmin Bleu »' }))

    expect(await screen.findByText('Masqué')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      '« Le Jasmin Bleu » est masqué : les voyageurs ne le voient plus.',
    )
    const patch = fetchMock.mock.calls.find(([, options]) => options.method === 'PATCH')
    expect(JSON.parse(patch[1].body)).toEqual({ hidden: true })

    await user.click(screen.getByRole('button', { name: 'Afficher « Le Jasmin Bleu »' }))

    await waitFor(() => expect(screen.queryByText('Masqué')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(
      '« Le Jasmin Bleu » est de nouveau visible par les voyageurs.',
    )
  })

  it('affiche un message clair si l’action échoue', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /provider/services': () => jsonResponse(page([JASMIN])),
      'PATCH /provider/services/s1/visibilite': () =>
        jsonResponse({ message: 'Service introuvable.' }, 404),
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Masquer « Le Jasmin Bleu »' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Service introuvable.')
    expect(screen.queryByText('Masqué')).not.toBeInTheDocument()
  })
})

describe('MyServicesPage — service masqué par la modération (US7.2)', () => {
  it('affiche « Masqué par la modération » sans bouton pour le réafficher', async () => {
    const moderated = { ...JASMIN, hiddenByAdmin: true }
    mockApi({ 'GET /provider/services': () => jsonResponse(page([moderated, FELOUQUE])) })
    renderPage()

    const list = await screen.findByRole('list')
    const [jasmin, felouque] = within(list).getAllByRole('listitem')
    expect(within(jasmin).getByText('Masqué par la modération')).toBeInTheDocument()
    expect(within(jasmin).getByText('Seul l’administrateur peut le réafficher.')).toBeInTheDocument()
    expect(
      within(jasmin).queryByRole('button', { name: /Afficher|Masquer/ }),
    ).not.toBeInTheDocument()
    // La carte mène à la modification, pas à une fiche publique introuvable.
    expect(within(jasmin).getByRole('link', { name: 'Le Jasmin Bleu' })).toHaveAttribute(
      'href',
      '/prestataire/services/s1/modifier',
    )
    expect(within(felouque).queryByText('Masqué par la modération')).not.toBeInTheDocument()
    expect(
      within(felouque).getByRole('button', { name: 'Afficher « Balade en felouque »' }),
    ).toBeInTheDocument()
  })
})

describe('MyServicesPage — suppression', () => {
  it('ouvre une boîte de confirmation accessible, fermée par Échap sans rien supprimer', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({ 'GET /provider/services': () => jsonResponse(page([JASMIN])) })
    renderPage()

    const deleteButton = await screen.findByRole('button', { name: 'Supprimer « Le Jasmin Bleu »' })
    await user.click(deleteButton)

    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce service ?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(/« Le Jasmin Bleu » sera retiré de la carte/)
    expect(within(dialog).getByRole('button', { name: 'Annuler' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteButton).toHaveFocus()
    expect(fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false)
  })

  it('supprime le service après confirmation et recharge la liste', async () => {
    const user = userEvent.setup()
    let deleted = false
    mockApi({
      'GET /provider/services': () => jsonResponse(page(deleted ? [] : [JASMIN])),
      'DELETE /provider/services/s1': () => {
        deleted = true
        return { ok: true, status: 204, json: async () => null }
      },
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer « Le Jasmin Bleu »' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText('Vous n’avez encore publié aucun service')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('« Le Jasmin Bleu » a été supprimé.')
    expect(screen.getByRole('heading', { level: 1, name: 'Mes services' })).toHaveFocus()
  })

  it('garde la boîte ouverte et affiche l’erreur si la suppression échoue', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /provider/services': () => jsonResponse(page([JASMIN])),
      'DELETE /provider/services/s1': () =>
        jsonResponse({ message: 'Impossible de joindre le serveur.' }, 503),
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Supprimer « Le Jasmin Bleu »' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Impossible de joindre le serveur.',
    )
    expect(within(dialog).getByRole('button', { name: 'Supprimer définitivement' })).toBeEnabled()
    expect(screen.getByText('Le Jasmin Bleu', { selector: 'a' })).toBeInTheDocument()
  })
})
