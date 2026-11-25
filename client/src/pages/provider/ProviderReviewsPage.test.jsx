import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import ProviderReviewsPage from './ProviderReviewsPage.jsx'

const UNANSWERED = {
  _id: 'r1',
  rating: 4,
  comment: 'Très calme.',
  author: { _id: 'u1', name: 'Amel T.', profile: 'etudiant' },
  service: { _id: 's1', name: 'Menzel des Palmes Bleues', hidden: false },
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
}
const ANSWERED = {
  _id: 'r2',
  rating: 5,
  comment: 'Superbe.',
  author: { _id: 'u2', name: 'Youssef H.', profile: 'resident' },
  service: { _id: 's2', name: 'Felouque', hidden: true },
  providerReply: { text: 'Merci Youssef !', repliedAt: '2026-11-03T10:00:00.000Z' },
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

const page = (items, extra = {}) =>
  jsonResponse({ items, total: items.length, page: 1, pages: 1, unansweredCount: 1, ...extra })

function renderPage(routes, entry = '/prestataire/avis') {
  const fetchMock = mockApi({
    'GET /provider/reviews': () => page([UNANSWERED, ANSWERED]),
    ...routes,
  })
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/prestataire/avis" element={<ProviderReviewsPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
  return fetchMock
}

const lastQuery = (fetchMock) => new URL(fetchMock.mock.calls.at(-1)[0]).searchParams

describe('ProviderReviewsPage — avis reçus (US6.4)', () => {
  it('liste les avis avec le service, le badge « Sans réponse » et la réponse existante', async () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Avis reçus' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Chargement des avis' })).toBeInTheDocument()

    const list = await screen.findByRole('list', { name: 'Avis reçus' })
    const [first, second] = within(list).getAllByRole('listitem')
    expect(within(first).getByRole('link', { name: 'Menzel des Palmes Bleues' })).toHaveAttribute(
      'href',
      '/services/s1',
    )
    expect(within(first).getByText('Sans réponse')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Répondre à Amel T.' })).toBeInTheDocument()

    // Service masqué : pas de lien vers une fiche invisible.
    expect(within(second).queryByRole('link')).not.toBeInTheDocument()
    expect(within(second).getByText('Masqué')).toBeInTheDocument()
    expect(within(second).getByText('Merci Youssef !')).toBeInTheDocument()
    expect(within(second).getByText('· 3 novembre 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sans réponse/ })).toHaveTextContent('1')
  })

  it('filtre les avis sans réponse (paramètre unanswered, URL ?filtre=sans-reponse)', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage()
    await screen.findByRole('list', { name: 'Avis reçus' })
    expect(lastQuery(fetchMock).get('unanswered')).toBeNull()

    await user.click(screen.getByRole('button', { name: /Sans réponse/ }))
    await waitFor(() => expect(lastQuery(fetchMock).get('unanswered')).toBe('true'))
    expect(screen.getByRole('button', { name: /Sans réponse/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('affiche un état vide adapté au filtre', async () => {
    renderPage(
      { 'GET /provider/reviews': () => page([], { pages: 0, unansweredCount: 0 }) },
      '/prestataire/avis?filtre=sans-reponse',
    )
    expect(
      await screen.findByRole('heading', { name: 'Vous avez répondu à tous les avis' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voir tous les avis' })).toBeInTheDocument()
  })

  it('affiche une erreur avec un bouton « Réessayer »', async () => {
    const user = userEvent.setup()
    let fail = true
    renderPage({
      'GET /provider/reviews': () =>
        fail
          ? jsonResponse({ message: 'Le service est momentanément indisponible.' }, 503)
          : page([UNANSWERED]),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le service est momentanément indisponible.',
    )
    fail = false
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('list', { name: 'Avis reçus' })).toBeInTheDocument()
  })

  it('publie une réponse et met à jour l’avis et le compteur', async () => {
    const user = userEvent.setup()
    let sent
    renderPage({
      'POST /provider/reviews/r1/reply': (body) => {
        sent = body
        return jsonResponse(
          {
            review: {
              ...UNANSWERED,
              providerReply: { text: body.text, repliedAt: '2026-11-20T10:00:00.000Z' },
            },
          },
          201,
        )
      },
    })
    await user.click(await screen.findByRole('button', { name: 'Répondre à Amel T.' }))

    const textarea = screen.getByLabelText('Votre réponse')
    expect(textarea).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Publier la réponse' }))
    expect(screen.getByText('Écrivez votre réponse.')).toBeInTheDocument()

    await user.type(textarea, 'Merci Amel !')
    expect(screen.getByText('12 / 1000 caractères')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publier la réponse' }))

    expect(await screen.findByText(/Votre réponse est publiée/)).toBeInTheDocument()
    expect(sent).toEqual({ text: 'Merci Amel !' })
    expect(screen.getByText('Merci Amel !')).toBeInTheDocument()
    expect(screen.queryByText('Sans réponse', { selector: 'span' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sans réponse/ })).toHaveTextContent('0')
  })

  it('affiche l’erreur de l’API sous le champ', async () => {
    const user = userEvent.setup()
    renderPage({
      'POST /provider/reviews/r1/reply': () =>
        jsonResponse(
          {
            message: 'Données invalides.',
            details: [{ field: 'text', message: 'La réponse ne peut pas dépasser 1000 caractères.' }],
          },
          400,
        ),
    })
    await user.click(await screen.findByRole('button', { name: 'Répondre à Amel T.' }))
    await user.type(screen.getByLabelText('Votre réponse'), 'Merci')
    await user.click(screen.getByRole('button', { name: 'Publier la réponse' }))
    expect(
      await screen.findByText('La réponse ne peut pas dépasser 1000 caractères.'),
    ).toBeInTheDocument()
  })

  it('modifie la réponse existante', async () => {
    const user = userEvent.setup()
    renderPage({
      'PATCH /provider/reviews/r2/reply': (body) =>
        jsonResponse({
          review: { ...ANSWERED, providerReply: { text: body.text, repliedAt: ANSWERED.createdAt } },
        }),
    })
    await user.click(
      await screen.findByRole('button', { name: 'Modifier ma réponse à Youssef H.' }),
    )
    const textarea = screen.getByLabelText('Modifier votre réponse')
    expect(textarea).toHaveValue('Merci Youssef !')
    // Pendant la modification, l'ancienne réponse est remplacée par le formulaire.
    expect(screen.queryByText('Merci Youssef !', { selector: 'p' })).not.toBeInTheDocument()

    await user.clear(textarea)
    await user.type(textarea, 'Merci beaucoup Youssef !')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Votre réponse est modifiée.')).toBeInTheDocument()
    expect(screen.getByText('Merci beaucoup Youssef !')).toBeInTheDocument()
  })

  it('supprime la réponse après confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = renderPage({
      'DELETE /provider/reviews/r2/reply': () => ({ ok: true, status: 204, json: async () => null }),
    })
    await user.click(
      await screen.findByRole('button', { name: 'Supprimer ma réponse à Youssef H.' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Supprimer votre réponse ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(
      fetchMock.mock.calls.some(([, options = {}]) => options.method === 'DELETE'),
    ).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Supprimer ma réponse à Youssef H.' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }),
    )

    expect(await screen.findByText('Votre réponse est supprimée.')).toBeInTheDocument()
    expect(screen.queryByText('Merci Youssef !')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Répondre à Youssef H.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sans réponse/ })).toHaveTextContent('2')
  })
})
